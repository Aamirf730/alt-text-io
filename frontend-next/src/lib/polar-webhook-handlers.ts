import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { extractPolarBillingSnapshot } from "@/lib/polar-billing";
import {
    isPolarSubscriptionProduct,
    resolvePolarBillingCycle,
    resolvePolarPlanId,
} from "@/lib/polar-plan-mapping";
import { safeServerError } from "@/lib/safe-server-log";

/*
 * Polar billing event handlers.
 *
 * The webhook route (app/api/webhooks/polar/route.ts) calls these with the
 * verified Polar payload. The admin reconciliation route replays a stored
 * payload through the same functions with an operator-chosen profile
 * (`context.forcedProfile`), so both paths share one implementation.
 */

// Lazy initialization for Supabase client
let supabaseClient: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient => {
    if (!supabaseClient) {
        supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return supabaseClient;
};

// Credit mapping based on product/plan
// Updated Oct 2026: Starter/Growth/Agency plans; Pro (tier3) is retired from
// sale. Legacy subscribers keep the allowance pinned on their profile while
// their original Polar subscription and product stay active.
const CREDITS_MAP: Record<string, number> = {
    tier1_monthly: 500,   // Starter $5
    tier2_monthly: 1500,  // Growth $12
    tier3_monthly: 2000,  // Legacy Pro
    tier4_monthly: 5000,  // Agency $29
    // Annual subscriptions (monthly credits × 12)
    tier1_annual: 6000,
    tier2_annual: 18000,
    tier3_annual: 24000,
    tier4_annual: 60000,
    // One-time purchases
    small_pack: 1000,   // $12
    credit_pack: 5000,  // $45
    bulk_pack: 15000,   // $99
};

// Monthly allowance per plan. Used by the annual drip and monthly plans.
const MONTHLY_CREDITS_MAP: Record<string, number> = {
    tier1: 500,
    tier2: 1500,
    tier3: 2000,
    tier4: 5000,
};

/**
 * What a handler did with an event. The webhook ignores it; the admin
 * replay uses it to decide whether a reconciliation row can be resolved.
 */
export type PolarHandlerOutcome = {
    outcome: "applied" | "ignored" | "queued";
    reason?: string;
};

export type PolarHandlerContext = {
    /**
     * Set only by the admin reconciliation replay. The event is applied to
     * this profile instead of resolving one from the payload, and an
     * operator-confirmed profile without a stored subscription ID may adopt
     * the event's subscription.
     */
    forcedProfile?: BillingProfile | null;
};

const applied = (reason?: string): PolarHandlerOutcome => ({ outcome: "applied", ...(reason ? { reason } : {}) });
const ignored = (reason: string): PolarHandlerOutcome => ({ outcome: "ignored", reason });
const queued = (reason: string): PolarHandlerOutcome => ({ outcome: "queued", reason });

function logWebhookReceived(eventName: string, data: any) {
    console.log(`${eventName} webhook received`, {
        status: data?.status,
    });
}

function isUniqueViolation(error: unknown): boolean {
    return Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
    );
}

function isMissingFunction(error: unknown): boolean {
    const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    return code === "PGRST202" || code === "42883";
}

async function recordPayment(payment: Record<string, unknown>) {
    const { error } = await getSupabase()
        .from("payments")
        .insert(payment);

    if (!error) {
        console.log("Payment recorded");
        return;
    }

    // A replayed Polar webhook has already recorded this payment. The caller
    // still runs idempotent fulfillment so an interruption between the insert
    // and the grant can be recovered by Polar's retry.
    if (isUniqueViolation(error)) {
        console.log("Payment replay detected; continuing idempotent fulfillment");
        return;
    }

    throw error;
}

/**
 * Lifecycle events (cancel, revoke, refund) are redelivered by Polar. A
 * dedupe key (event name plus the provider object and state) backed by the
 * unique index on marketing_events.dedupe_key turns a replay into a no-op.
 */
async function recordMarketingEvent(
    eventName: string,
    userId: string,
    userEmail: string | null,
    properties: Record<string, string | number | boolean | null | undefined>,
    options: { throwOnError?: boolean; dedupeKey?: string | null } = {}
) {
    const row = {
        event_name: eventName,
        source: "polar_webhook",
        user_id: userId,
        user_email: userEmail,
        properties,
        occurred_at: new Date().toISOString(),
        ...(options.dedupeKey ? { dedupe_key: options.dedupeKey } : {}),
    };

    const { error } = options.dedupeKey
        ? await getSupabase()
            .from("marketing_events")
            .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
        : await getSupabase()
            .from("marketing_events")
            .insert(row);

    if (error && isUniqueViolation(error)) {
        console.log(`↺ Marketing event ${eventName} was already recorded`);
        return;
    }

    if (error) {
        console.warn(`Could not record marketing event ${eventName}:`, safeServerError(error));
        if (options.throwOnError) {
            throw error;
        }
    }
}

function buildDedupeKey(eventName: string, ...parts: unknown[]): string | null {
    const normalized = parts.map((part) => {
        if (part instanceof Date) return part.toISOString();
        if (part === null || part === undefined) return "";
        return String(part).trim();
    });
    if (!normalized[0]) return null;
    return ["polar", eventName, ...normalized].join(":").slice(0, 500);
}

export type BillingProfile = {
    id: string;
    email: string | null;
    subscription_id: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    polar_customer_id: string | null;
    polar_product_id: string | null;
    bonus_credits_remaining: number | null;
    purchased_credits_remaining: number | null;
    credits_remaining: number | null;
    credits_last_renewed_at: string | null;
    monthly_credit_allowance: number | null;
    next_billing_date: string | null;
};

const BILLING_PROFILE_COLUMNS = [
    "id",
    "email",
    "subscription_id",
    "subscription_plan",
    "subscription_status",
    "polar_customer_id",
    "polar_product_id",
    "bonus_credits_remaining",
    "purchased_credits_remaining",
    "credits_remaining",
    "credits_last_renewed_at",
    "monthly_credit_allowance",
    "next_billing_date",
].join(", ");

type BillingField = "id" | "subscription_id" | "polar_customer_id";

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
}

function normalizeUserId(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized && normalized.length <= 200 ? normalized : null;
}

function getProviderUserId(payload: any): string | null {
    return normalizeUserId(payload?.metadata?.user_id);
}

function escapeIlikePattern(value: string): string {
    return value.replace(/[\\%_]/g, "\\$&");
}

async function findProfileByBillingField(
    field: BillingField,
    value: string,
): Promise<BillingProfile | null> {
    const { data, error } = await getSupabase()
        .from("profiles")
        .select(BILLING_PROFILE_COLUMNS)
        .eq(field, value)
        .limit(1);

    if (error) {
        throw error;
    }

    return (data?.[0] as unknown as BillingProfile | undefined) || null;
}

/** Loads the billing view of one profile, for the admin replay. */
export async function loadBillingProfileById(userId: string): Promise<BillingProfile | null> {
    const normalized = normalizeUserId(userId);
    if (!normalized) return null;
    return findProfileByBillingField("id", normalized);
}

/**
 * How a profile was matched to a Polar payload. Checkout metadata, a stored
 * subscription or customer ID are identities we wrote ourselves; an email
 * match is the weakest (mutable, user-entered) and never binds a
 * subscription on its own.
 */
type ProfileMatchSource = "metadata_user_id" | "subscription_id" | "polar_customer_id" | "email";

type ProfileLookup = {
    profile: BillingProfile | null;
    ambiguous?: boolean;
    matchSource?: ProfileMatchSource;
};

type EmailCandidate = { user_id: string; match_source: string };

/**
 * Email is the weakest billing identity: it is mutable and, in older
 * profiles, not guaranteed to be unique case-insensitively. Prefer an exact
 * match on a confirmed Auth email, then a profile email that belongs to a
 * confirmed Auth user. More than one candidate is never guessed; the event
 * goes to reconciliation instead.
 */
async function findProfileByEmail(email: string): Promise<ProfileLookup> {
    const { data, error } = await getSupabase().rpc("find_billing_user_ids_by_email", {
        p_email: email,
    });

    if (error && !isMissingFunction(error)) {
        throw error;
    }

    if (!error) {
        const candidates = (Array.isArray(data) ? data : []) as EmailCandidate[];
        const authMatches = new Set(
            candidates.filter((row) => row.match_source === "auth_email").map((row) => row.user_id),
        );
        const allMatches = new Set(candidates.map((row) => row.user_id));
        const preferred = authMatches.size > 0 ? authMatches : allMatches;

        if (preferred.size > 1) {
            return { profile: null, ambiguous: true };
        }

        const [userId] = Array.from(preferred);
        return {
            profile: userId ? await findProfileByBillingField("id", userId) : null,
            matchSource: "email",
        };
    }

    // Database not yet migrated: fall back to a bounded profile lookup. Two
    // rows means the email is ambiguous, so do not pick one.
    const { data: rows, error: profileError } = await getSupabase()
        .from("profiles")
        .select(BILLING_PROFILE_COLUMNS)
        .ilike("email", escapeIlikePattern(email))
        .limit(2);

    if (profileError) {
        throw profileError;
    }

    const matches = (rows || []) as unknown as BillingProfile[];
    if (matches.length > 1) {
        return { profile: null, ambiguous: true };
    }
    return { profile: matches[0] || null, matchSource: "email" };
}

async function findBillingProfile({
    userId,
    email,
    subscriptionId,
    customerId,
}: {
    userId?: string | null;
    email?: string | null;
    subscriptionId?: string | null;
    customerId?: string | null;
}): Promise<ProfileLookup> {
    const normalizedUserId = normalizeUserId(userId);
    if (normalizedUserId) {
        // Metadata is created by our authenticated checkout endpoint. If it is
        // present but stale, queue the event rather than rebinding it to an
        // unrelated account via a mutable email address.
        return {
            profile: await findProfileByBillingField("id", normalizedUserId),
            matchSource: "metadata_user_id",
        };
    }

    if (subscriptionId) {
        const profile = await findProfileByBillingField("subscription_id", subscriptionId);
        if (profile) return { profile, matchSource: "subscription_id" };
    }

    if (customerId) {
        const profile = await findProfileByBillingField("polar_customer_id", customerId);
        if (profile) return { profile, matchSource: "polar_customer_id" };
    }

    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) {
        return findProfileByEmail(normalizedEmail);
    }

    return { profile: null };
}

function hashPayload(payload: any): string {
    return createHash("sha256")
        .update(JSON.stringify(payload || {}))
        .digest("hex");
}

/**
 * Key for the payment_reconciliation unique index (provider, event_name,
 * provider_object_id). An order or refund ID identifies one event, but a
 * subscription ID recurs on every renewal and lifecycle change: keyed by the
 * bare subscription ID, next month's queued renewal hit the unique index and
 * was silently dropped. Subscription events are keyed by the subscription
 * plus the event's own identity (period start and modification time), so a
 * redelivery of the same event still dedupes while each new period or
 * change gets its own row.
 */
function getProviderObjectId(eventName: string, payload: any): string {
    if (eventName.startsWith("subscription.") && payload?.id) {
        const eventParts = [
            toIsoDate(payload.currentPeriodStart ?? payload.current_period_start),
            toIsoDate(payload.modifiedAt ?? payload.modified_at),
        ].filter(Boolean);
        const eventIdentity = eventParts.length > 0
            ? eventParts.join(":")
            : hashPayload(payload).slice(0, 32);
        return `${String(payload.id)}:${eventIdentity}`;
    }

    const directId = payload?.id || payload?.orderId || payload?.subscriptionId;
    if (directId) return String(directId);

    return hashPayload(payload);
}

function normalizeProviderId(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const normalized = String(value).trim();
    return normalized && normalized.length <= 200 ? normalized : null;
}

function getOrderIdFromOrder(order: any): string | null {
    return normalizeProviderId(order?.id || order?.orderId || order?.order_id);
}

function getOrderIdFromRefund(refund: any): string | null {
    // A refund's `id` identifies the refund, not the order. Never use it as a
    // payment key when Polar omits the order relationship.
    return normalizeProviderId(refund?.orderId || refund?.order_id);
}

async function recordPaymentReconciliation({
    eventName,
    payload,
    reason,
    userId,
    customerEmail,
    customerId,
    subscriptionId,
    paymentId,
}: {
    eventName: string;
    payload: any;
    reason: string;
    userId?: string | null;
    customerEmail?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    paymentId?: string | null;
}): Promise<void> {
    const providerObjectId = getProviderObjectId(eventName, payload);
    const row = {
        provider: "polar",
        event_name: eventName,
        provider_object_id: providerObjectId,
        candidate_user_id: normalizeUserId(userId),
        customer_id: customerId || null,
        customer_email: normalizeEmail(customerEmail),
        subscription_id: subscriptionId || null,
        payment_id: paymentId || null,
        reason,
        payload: payload || {},
        status: "open",
    };

    const { error } = await getSupabase()
        .from("payment_reconciliation")
        .insert(row);

    if (error && !isUniqueViolation(error)) {
        throw error;
    }

    console.error("[PaymentReconciliation] Unmatched Polar payload", {
        eventName,
        reason,
        hasProviderObjectId: Boolean(providerObjectId),
        hasCandidateUserId: Boolean(row.candidate_user_id),
        hasCustomerId: Boolean(row.customer_id),
        hasCustomerEmail: Boolean(row.customer_email),
        hasSubscriptionId: Boolean(row.subscription_id),
        hasPaymentId: Boolean(row.payment_id),
        alreadyQueued: Boolean(error && isUniqueViolation(error)),
    });
}

async function findOrQueueBillingProfile({
    eventName,
    payload,
    reason,
    userId,
    email,
    subscriptionId,
    customerId,
    paymentId,
}: {
    eventName: string;
    payload: any;
    reason: string;
    userId?: string | null;
    email?: string | null;
    subscriptionId?: string | null;
    customerId?: string | null;
    paymentId?: string | null;
}): Promise<ProfileLookup> {
    const lookup = await findBillingProfile({ userId, email, subscriptionId, customerId });
    if (lookup.profile) return lookup;

    await recordPaymentReconciliation({
        eventName,
        payload,
        reason: lookup.ambiguous ? "ambiguous_email_match" : reason,
        userId,
        customerEmail: email,
        customerId,
        subscriptionId,
        paymentId,
    });
    return { profile: null, ambiguous: lookup.ambiguous };
}

/** The forced profile (admin replay) wins; otherwise resolve or queue. */
async function resolveProfile(
    context: PolarHandlerContext,
    lookup: Parameters<typeof findOrQueueBillingProfile>[0],
): Promise<BillingProfile | null> {
    if (context.forcedProfile) return context.forcedProfile;
    return (await findOrQueueBillingProfile(lookup)).profile;
}

type ResolvedSubscriptionProfile = {
    profile: BillingProfile;
    /** Matched by an identity we issued, not by email (see hasStrongIdentity). */
    strongIdentity: boolean;
};

function getPolarExternalCustomerId(payload: any): string | null {
    return normalizeUserId(
        payload?.customer?.externalId
        ?? payload?.customer?.external_id
        ?? payload?.externalCustomerId
        ?? payload?.external_customer_id,
    );
}

/**
 * A strong identity is one we created: checkout metadata.user_id, the
 * stored Polar customer ID or subscription ID, or a Polar customer whose
 * externalId is the profile ID. Email is never strong.
 */
function hasStrongIdentity(
    lookup: ProfileLookup,
    profile: BillingProfile,
    payload: any,
): boolean {
    if (
        lookup.matchSource === "metadata_user_id"
        || lookup.matchSource === "polar_customer_id"
        || lookup.matchSource === "subscription_id"
    ) {
        return true;
    }
    return getPolarExternalCustomerId(payload) === profile.id;
}

/** resolveProfile for subscription lifecycle events, keeping the match source. */
async function resolveSubscriptionProfile(
    context: PolarHandlerContext,
    lookup: Parameters<typeof findOrQueueBillingProfile>[0],
): Promise<ResolvedSubscriptionProfile | null> {
    if (context.forcedProfile) {
        return { profile: context.forcedProfile, strongIdentity: false };
    }
    const result = await findOrQueueBillingProfile(lookup);
    if (!result.profile) return null;
    return {
        profile: result.profile,
        strongIdentity: hasStrongIdentity(result, result.profile, lookup.payload),
    };
}

function identityReason(payload: any, email: unknown): string {
    return !getProviderUserId(payload) && !normalizeEmail(email)
        ? "missing_customer_identity"
        : "profile_not_found";
}

async function queueMissingOrderIdReconciliation(
    eventName: string,
    payload: any,
): Promise<void> {
    await recordPaymentReconciliation({
        eventName,
        payload,
        reason: "missing_order_id",
        userId: getProviderUserId(payload),
        customerEmail: payload?.customer?.email,
        customerId: payload?.customerId || payload?.customer?.id,
        subscriptionId: payload?.subscriptionId,
        paymentId: null,
    });
}

function isFreeProfile(profile: BillingProfile): boolean {
    return String(profile.subscription_plan || "").trim().toLowerCase() === "free";
}

/**
 * True only when the event's subscription is the one bound to the profile.
 *
 * A profile without a stored subscription ID never matches a concrete event
 * subscription by default: revocation clears the ID, so treating null as a
 * wildcard let late `canceled`/`uncanceled`/`updated` events rewrite Free
 * accounts. Two narrow exceptions bind an unbound *paid* profile:
 * - a legacy profile whose stored Polar product is the event's product;
 * - an operator replay that explicitly chose this profile.
 */
export function matchesSubscription(
    profile: BillingProfile,
    subscriptionId: string | null | undefined,
    options: { productId?: string | null; trustUnbound?: boolean } = {},
): boolean {
    const eventSubscriptionId = normalizeProviderId(subscriptionId);
    if (!eventSubscriptionId) return false;

    if (profile.subscription_id) {
        return profile.subscription_id === eventSubscriptionId;
    }

    if (isFreeProfile(profile)) return false;
    if (options.trustUnbound) return true;

    return Boolean(
        profile.polar_product_id
        && options.productId
        && profile.polar_product_id === options.productId,
    );
}

/**
 * Binds an event's subscription to an unbound paid profile. The update is
 * conditional (still unbound, still not Free) so a concurrent event cannot
 * be overwritten; losing that race throws so Polar retries against the
 * profile as it now is. Only the subscription ID is written: the Polar
 * product is written by the lifecycle RPCs, after the monthly allowance has
 * been resolved against the profile's previous product (a product change
 * must not keep a legacy pinned allowance).
 */
async function bindSubscriptionToProfile(
    profile: BillingProfile,
    subscriptionId: string,
): Promise<BillingProfile> {
    const { data, error } = await getSupabase()
        .from("profiles")
        .update({
            subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .is("subscription_id", null)
        .neq("subscription_plan", "free")
        .select("id");

    if (error) {
        throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Profile subscription changed while binding; retry the event");
    }

    console.log("Bound Polar subscription to an unbound paid profile");
    return { ...profile, subscription_id: subscriptionId };
}

type SubscriptionGuardResult =
    | { outcome: PolarHandlerOutcome; profile?: undefined }
    | { outcome?: undefined; profile: BillingProfile };

/**
 * Shared guard for subscription lifecycle events. Returns the profile to
 * apply the event to, or the outcome to return.
 *
 * - A profile bound to the event's subscription proceeds.
 * - A Free profile is never bound here (only subscription.active does that).
 * - An unbound paid profile is bound to the event's subscription, then the
 *   event is applied, when the event is tied to it by its legacy Polar
 *   product, by a strong identity (checkout metadata, customer ID, Polar
 *   externalId), or by an operator replay that chose this profile.
 * - An unbound paid profile matched only by email is queued for an operator.
 */
async function guardSubscriptionEvent({
    eventName,
    subscription,
    profile,
    context,
    ignoreFreeProfiles,
    strongIdentity,
}: {
    eventName: string;
    subscription: any;
    profile: BillingProfile;
    context: PolarHandlerContext;
    ignoreFreeProfiles: boolean;
    strongIdentity: boolean;
}): Promise<SubscriptionGuardResult> {
    if (ignoreFreeProfiles && isFreeProfile(profile)) {
        // Activation is handled only by subscription.active. A late lifecycle
        // event for a revoked (Free) profile must not mark it cancelled or
        // restore a paid plan.
        console.warn(`Ignoring ${eventName} for a Free profile`);
        return { outcome: ignored("free_profile") };
    }

    const subscriptionId = normalizeProviderId(subscription.id);
    const productId = getPolarProductId(subscription);
    if (subscriptionId && matchesSubscription(profile, subscriptionId, {
        productId,
        trustUnbound: Boolean(context.forcedProfile) || strongIdentity,
    })) {
        return {
            profile: profile.subscription_id
                ? profile
                : await bindSubscriptionToProfile(profile, subscriptionId),
        };
    }

    if (!profile.subscription_id && !isFreeProfile(profile) && !context.forcedProfile) {
        await recordPaymentReconciliation({
            eventName,
            payload: subscription,
            reason: "subscription_not_bound",
            userId: profile.id,
            customerEmail: subscription.customer?.email,
            customerId: subscription.customer?.id,
            subscriptionId: subscription.id,
        });
        return { outcome: queued("subscription_not_bound") };
    }

    console.warn(`Ignoring ${eventName} for a stale subscription`);
    return { outcome: ignored("stale_subscription") };
}

function toIsoDate(value: unknown): string | null {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getSubscriptionEnd(subscription: any): string | null {
    return toIsoDate(subscription.endsAt || subscription.currentPeriodEnd);
}

async function updateProfile(userId: string, values: Record<string, unknown>): Promise<void> {
    const { error } = await getSupabase()
        .from("profiles")
        .update(values)
        .eq("id", userId);

    if (error) {
        throw error;
    }
}

async function downgradeProfileToFree(
    profile: BillingProfile,
    subscriptionId: string,
): Promise<void> {
    const { data, error } = await getSupabase().rpc("revoke_subscription_access", {
        p_user_id: profile.id,
        p_subscription_id: subscriptionId,
    });

    if (error) {
        throw error;
    }

    if (!data?.success) {
        throw new Error(data?.error || "Subscription revocation failed");
    }
}

type PaymentRefundResult = {
    success: boolean;
    payment_found?: boolean;
    full_refund?: boolean;
    status?: string;
    refunded_amount?: number;
    error?: string;
};

function centsToAmount(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const cents = Number(value);
    return Number.isFinite(cents) ? Number((cents / 100).toFixed(2)) : null;
}

/**
 * Records refund totals on the payment row through one RPC for both refund
 * paths. order.refunded passes Polar's cumulative order totals; refund.*
 * passes the single refund, which is stored by refund ID and summed. The
 * payment keeps `partially_refunded` until the refunded total reaches the
 * order's pre-tax amount (Polar's own rule), and totals never decrease.
 */
async function recordPaymentRefund(args: {
    paymentId: string;
    refundId?: string | null;
    refundAmount?: number | null;
    refundTaxAmount?: number | null;
    refundStatus?: string | null;
    orderRefundedAmount?: number | null;
    orderRefundedTaxAmount?: number | null;
    orderStatus?: string | null;
}): Promise<PaymentRefundResult> {
    const { data, error } = await getSupabase().rpc("record_payment_refund", {
        p_payment_id: args.paymentId,
        p_refund_id: args.refundId ?? null,
        p_refund_amount: args.refundAmount ?? null,
        p_refund_tax_amount: args.refundTaxAmount ?? null,
        p_refund_status: args.refundStatus ?? null,
        p_order_refunded_amount: args.orderRefundedAmount ?? null,
        p_order_refunded_tax_amount: args.orderRefundedTaxAmount ?? null,
        p_order_status: args.orderStatus ?? null,
    });

    if (error) {
        throw error;
    }

    const result = data as PaymentRefundResult | null;
    if (!result?.success) {
        throw new Error(result?.error || "Refund recording failed");
    }

    return result;
}

/**
 * Thrown when a refund arrives before its payment row exists. Retryable:
 * the webhook answers non-200 so Polar redelivers the refund later.
 */
export class RefundBeforePaymentError extends Error {
    readonly retryable = true;

    constructor(eventName: string) {
        super(`${eventName}: payment not recorded yet; retry the refund later`);
        this.name = "RefundBeforePaymentError";
    }
}

async function revokeCreditPack(paymentId: string): Promise<void> {
    const { data, error } = await getSupabase().rpc("revoke_credit_pack_purchase", {
        p_payment_id: paymentId,
    });

    if (error) {
        throw error;
    }

    if (!data?.success) {
        throw new Error(data?.error || "Credit-pack revocation failed");
    }
}

/**
 * refund.created / refund.updated. These carry the merchant's "revoke
 * benefits" choice, so they are the only refund path that changes access.
 *
 * - Benefits are revoked only for a succeeded refund with revokeBenefits
 *   that brings the order to a full refund.
 * - A partial refund never removes access or credits. For credit packs we
 *   deliberately revoke nothing on a partial refund (rather than a
 *   proportional share): partial refunds are goodwill or price adjustments,
 *   and the full-refund path still claws back the unused pack balance.
 * - Subscription access is revoked only for the refund's own subscription
 *   when it is the one bound to the profile.
 */
export async function handleRefund(
    refund: any,
    eventName: "refund_created" | "refund_updated",
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived(eventName === "refund_created" ? "Refund created" : "Refund updated", refund);

    const orderId = getOrderIdFromRefund(refund);
    if (!orderId) {
        await queueMissingOrderIdReconciliation(eventName, refund);
        return queued("missing_order_id");
    }

    const paymentId = `polar_ord_${orderId}`;
    const subscriptionId = normalizeProviderId(refund.subscriptionId);
    const profile = await resolveProfile(context, {
        eventName,
        payload: refund,
        reason: identityReason(refund, refund.customer?.email),
        userId: getProviderUserId(refund),
        email: refund.customer?.email,
        subscriptionId,
        customerId: refund.customerId,
        paymentId,
    });

    const refundResult = await recordPaymentRefund({
        paymentId,
        refundId: normalizeProviderId(refund.id),
        refundAmount: centsToAmount(refund.amount),
        refundTaxAmount: centsToAmount(refund.taxAmount),
        refundStatus: typeof refund.status === "string" ? refund.status : null,
    });

    const succeeded = refund.status === "succeeded";
    if (succeeded && refundResult.payment_found === false) {
        // The refund row is stored, but the payment it belongs to is not
        // (order.paid not delivered yet, or queued). Fail so Polar retries
        // once the payment exists and the refund can be applied to it.
        throw new RefundBeforePaymentError(eventName);
    }

    const outcome: PolarHandlerOutcome = profile ? applied() : queued("profile_not_found");

    if (succeeded && refund.revokeBenefits) {
        if (!refundResult.full_refund) {
            console.log("Partial refund recorded; benefits are kept");
        } else if (subscriptionId) {
            if (profile && matchesSubscription(profile, subscriptionId, {
                trustUnbound: Boolean(context.forcedProfile),
            })) {
                await downgradeProfileToFree(profile, subscriptionId);
            } else {
                console.warn("Refunded subscription is not bound to the profile; access unchanged");
            }
        } else {
            // No grant exists for a non-pack order, so this is a no-op there.
            await revokeCreditPack(paymentId);
        }
    }

    if (profile) {
        await recordMarketingEvent(eventName, profile.id, profile.email, {
            provider: "polar",
            refund_id: refund.id,
            order_id: orderId,
            subscription_id: subscriptionId,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            reason: refund.reason,
            revoke_benefits: refund.revokeBenefits,
            full_refund: Boolean(refundResult.full_refund),
        }, {
            throwOnError: true,
            dedupeKey: buildDedupeKey(eventName, refund.id || orderId, refund.status),
        });
    }

    return outcome;
}

/**
 * True when the order is already fully refunded: Polar's own order status,
 * or refunds recorded against the payment (payment_refunds rows stored by a
 * refund.* that arrived before the payment, or the payment row's status).
 * When a refund exists, record_payment_refund recomputes the payment's
 * refund totals and decides "full" with the same rule as the refund path.
 */
async function isOrderFullyRefunded(order: any, paymentId: string): Promise<boolean> {
    const orderStatus = typeof order?.status === "string" ? order.status.toLowerCase() : "";
    if (orderStatus === "refunded") return true;

    const supabase = getSupabase();
    const [{ data: refunds, error: refundsError }, { data: payments, error: paymentError }] = await Promise.all([
        supabase
            .from("payment_refunds")
            .select("refund_id")
            .eq("payment_id", paymentId)
            .eq("status", "succeeded")
            .limit(1),
        supabase
            .from("payments")
            .select("status")
            .eq("payment_id", paymentId)
            .limit(1),
    ]);

    if (refundsError) throw refundsError;
    if (paymentError) throw paymentError;

    const paymentStatus = String((payments as Array<{ status?: string }> | null)?.[0]?.status || "").toLowerCase();
    const hasRefund = (Array.isArray(refunds) && refunds.length > 0)
        || paymentStatus === "refunded"
        || paymentStatus === "partially_refunded"
        || orderStatus === "partially_refunded"
        || Number(order?.refundedAmount || 0) > 0;
    if (!hasRefund) return false;

    const result = await recordPaymentRefund({
        paymentId,
        orderRefundedAmount: centsToAmount(order?.refundedAmount || 0),
        orderRefundedTaxAmount: centsToAmount(order?.refundedTaxAmount || 0),
        orderStatus: orderStatus || null,
    });
    return Boolean(result.full_refund);
}

// Helper to get credits from product name or metadata
function getCreditsForProduct(
    productName: string,
    metadata?: Record<string, string | number | boolean | null | undefined>,
    productId?: string | null,
): number {
    // First check metadata for explicit credits
    if (metadata?.credits) {
        const raw = metadata.credits;
        const asNum = typeof raw === "number" ? raw : parseInt(String(raw), 10);
        return Number.isFinite(asNum) ? asNum : 0;
    }

    // Resolve the product through the explicit Polar ID/metadata/name mapping.
    // This keeps "Small Credit Pack" on the 500-credit path instead of letting
    // a broad substring match classify it as the 1,200-credit pack.
    const resolvedPlanId = resolvePolarPlanId(productName, metadata, productId);
    if (resolvedPlanId === "small_pack") return CREDITS_MAP.small_pack;
    if (resolvedPlanId === "credit_pack") return CREDITS_MAP.credit_pack;
    if (resolvedPlanId === "bulk_pack") return CREDITS_MAP.bulk_pack;

    const billingCycle = resolvePolarBillingCycle(productName, metadata, productId);
    const planCredits = CREDITS_MAP[`${resolvedPlanId}_${billingCycle}`];
    if (planCredits) return planCredits;

    console.warn("Unknown Polar product; defaulting to 0 credits");
    return 0;
}

function getPolarProductId(subscription: any): string | null {
    const id = subscription?.product?.id || subscription?.productId || null;
    return id ? String(id) : null;
}

function mergeMetadata(source: any): Record<string, string | number | boolean> {
    return {
        ...(source?.product?.metadata || {}),
        ...(source?.metadata || {}),
    } as Record<string, string | number | boolean>;
}

/**
 * Resolve the monthly allowance for a billing event.
 *
 * A legacy customer keeps the allowance pinned on their profile only while
 * both the Polar subscription and product remain unchanged. A new checkout
 * or product switch adopts the current catalogue allowance.
 */
function resolveMonthlyAllowance({
    profile,
    planId,
    productId,
    subscriptionId,
    productCredits,
    isAnnual,
}: {
    profile: BillingProfile;
    planId: string;
    productId: string | null;
    subscriptionId: string | null;
    productCredits: number;
    isAnnual: boolean;
}): number {
    const catalogueAllowance =
        MONTHLY_CREDITS_MAP[planId]
        || (isAnnual ? Math.round(productCredits / 12) : productCredits);

    const pinned = Number(profile.monthly_credit_allowance || 0);
    if (pinned <= 0) return catalogueAllowance;

    const sameProduct =
        !profile.polar_product_id || !productId || profile.polar_product_id === productId;
    // A legacy profile can lack a stored subscription ID; the pinned
    // allowance still applies while the exact same Polar product renews.
    const sameSubscription =
        Boolean(subscriptionId) && (
            profile.subscription_id === subscriptionId
            || (!profile.subscription_id && Boolean(profile.polar_product_id) && profile.polar_product_id === productId)
        );

    return sameSubscription && sameProduct ? pinned : catalogueAllowance;
}

async function grantCreditPack(userId: string, credits: number, paymentId: string) {
    // Credit packs are persistent credits. The database function updates
    // both the aggregate balance and the persistent ledger atomically,
    // and ignores duplicate webhook deliveries for the same payment.
    const { data, error } = await getSupabase().rpc("grant_credit_pack_purchase", {
        p_user_id: userId,
        p_payment_id: paymentId,
        p_credits: credits,
    });

    if (error) {
        console.error("Error updating one-time credits:", safeServerError(error));
        throw error;
    }

    if (!data?.success) {
        throw new Error(data?.error || "Credit-pack grant failed");
    }
}

async function activateSubscriptionProfile({
    userId,
    subscriptionId,
    planId,
    polarCustomerId,
    polarProductId,
    billingCycle,
    monthlyCreditAllowance,
    nextBillingDate,
}: {
    userId: string;
    subscriptionId: string;
    planId: string;
    polarCustomerId: string | null;
    polarProductId: string | null;
    billingCycle: "monthly" | "annual";
    monthlyCreditAllowance: number;
    nextBillingDate: string | null;
}) {
    const { data, error } = await getSupabase().rpc("activate_subscription_profile", {
        p_user_id: userId,
        p_subscription_id: subscriptionId,
        p_subscription_plan: planId,
        p_polar_customer_id: polarCustomerId,
        p_polar_product_id: polarProductId,
        p_billing_cycle: billingCycle,
        p_monthly_credit_allowance: monthlyCreditAllowance,
        p_next_billing_date: nextBillingDate,
    });

    if (error) {
        console.error("Error activating subscription profile:", safeServerError(error));
        throw error;
    }

    if (!data?.success) {
        throw new Error(data?.error || "Subscription activation failed");
    }
}

type SubscriptionRenewalResult = {
    success: boolean;
    renewed?: boolean;
    already_processed?: boolean;
    reason?: string;
    error?: string;
};

async function renewSubscriptionCredits({
    userId,
    subscriptionId,
    planId,
    currentPeriodStart,
    polarProductId,
    billingCycle,
    monthlyCreditAllowance,
    nextBillingDate,
}: {
    userId: string;
    subscriptionId: string;
    planId: string;
    currentPeriodStart: string | null;
    polarProductId: string | null;
    billingCycle: "monthly" | "annual";
    monthlyCreditAllowance: number;
    nextBillingDate: string | null;
}): Promise<SubscriptionRenewalResult> {
    const { data, error } = await getSupabase().rpc("renew_subscription_credits", {
        p_user_id: userId,
        p_subscription_id: subscriptionId,
        p_subscription_plan: planId,
        p_current_period_start: currentPeriodStart,
        p_polar_product_id: polarProductId,
        p_billing_cycle: billingCycle,
        p_monthly_credit_allowance: monthlyCreditAllowance,
        p_next_billing_date: nextBillingDate,
    });

    if (error) {
        console.error("Error renewing subscription credits:", safeServerError(error));
        throw error;
    }

    const result = data as SubscriptionRenewalResult | null;
    if (!result?.success) {
        throw new Error(result?.error || "Subscription renewal failed");
    }

    return result;
}

type SubscriptionPlanChangeResult = {
    success: boolean;
    changed?: boolean;
    reason?: string;
    error?: string;
};

// Applies a product switch made inside the current billing period (for
// example an upgrade in the Polar customer portal). The RPC is a no-op when
// the profile already matches, so replays and plain status updates are safe.
async function changeSubscriptionPlan({
    userId,
    subscriptionId,
    planId,
    polarProductId,
    billingCycle,
    monthlyCreditAllowance,
    nextBillingDate,
}: {
    userId: string;
    subscriptionId: string;
    planId: string;
    polarProductId: string | null;
    billingCycle: "monthly" | "annual";
    monthlyCreditAllowance: number;
    nextBillingDate: string | null;
}): Promise<SubscriptionPlanChangeResult> {
    const { data, error } = await getSupabase().rpc("change_subscription_plan", {
        p_user_id: userId,
        p_subscription_id: subscriptionId,
        p_subscription_plan: planId,
        p_polar_product_id: polarProductId,
        p_billing_cycle: billingCycle,
        p_monthly_credit_allowance: monthlyCreditAllowance,
        p_next_billing_date: nextBillingDate,
    });

    if (error) {
        console.error("Error changing subscription plan:", safeServerError(error));
        throw error;
    }

    const result = data as SubscriptionPlanChangeResult | null;
    if (!result?.success) {
        throw new Error(result?.error || "Subscription plan change failed");
    }

    return result;
}

// Handle successful order payment and subscription revenue bookkeeping.
// Credit allocation for subscriptions is handled by the subscription
// lifecycle callbacks so it cannot happen twice.
export async function handleOrderPaid(
    order: any,
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived("Order paid", order);
    const customerEmail = normalizeEmail(order.customer?.email);

    // Get product details early to check if this is a subscription
    const productName = order.product?.name || "";
    const mergedMetadata = mergeMetadata(order);

    const billingSnapshot = extractPolarBillingSnapshot(order);
    const productId = billingSnapshot.productId || normalizeProviderId(order.product?.id);
    const isSubscription = isPolarSubscriptionProduct(productName, mergedMetadata, productId);
    const subscriptionId = order.subscriptionId || (order as { subscription_id?: string | null }).subscription_id || null;
    const orderId = getOrderIdFromOrder(order);
    if (!orderId) {
        await queueMissingOrderIdReconciliation("order.paid", order);
        return queued("missing_order_id");
    }
    const paymentId = `polar_ord_${orderId}`;
    const profile = await resolveProfile(context, {
        eventName: "order.paid",
        payload: order,
        reason: identityReason(order, customerEmail),
        userId: getProviderUserId(order),
        email: customerEmail,
        subscriptionId,
        customerId: order.customer?.id,
        paymentId,
    });

    if (!profile) return queued("profile_not_found");

    const userId = profile.id;
    const resolvedEmail = profile.email || customerEmail;

    const paymentAmount = billingSnapshot.paymentAmount;
    const currency = billingSnapshot.currency;
    const planId = resolvePolarPlanId(productName, mergedMetadata, productId);
    const payment = {
        user_id: userId,
        payment_id: paymentId,
        subscription_id: subscriptionId,
        plan_id: planId,
        amount: paymentAmount,
        currency,
        polar_product_id: billingSnapshot.productId,
        product_name: billingSnapshot.productName || productName,
        discount_id: billingSnapshot.discountId,
        discount_code: billingSnapshot.discountCode,
        discount_name: billingSnapshot.discountName,
        discount_amount: billingSnapshot.discountAmount,
        tax_amount: billingSnapshot.taxAmount,
        status: "completed",
        payment_method: "polar",
        created_at: new Date().toISOString(),
    };

    const marketingProperties = {
        provider: "polar",
        product_id: billingSnapshot.productId,
        product_name: billingSnapshot.productName || productName,
        plan_id: planId,
        amount: paymentAmount,
        currency,
        order_id: orderId,
        discount_id: billingSnapshot.discountId,
        discount_code: billingSnapshot.discountCode,
        discount_name: billingSnapshot.discountName,
        discount_amount: billingSnapshot.discountAmount,
        is_subscription: isSubscription,
    };

    // Order-paid is the canonical revenue event for subscriptions. The order
    // ID is stable across webhook retries, while subscription.updated is a
    // lifecycle event and must not create a second payment row for the same
    // paid period.
    if (isSubscription) {
        await recordPayment(payment);
        await recordMarketingEvent(
            "purchase_completed",
            userId,
            resolvedEmail,
            marketingProperties,
            { throwOnError: true, dedupeKey: buildDedupeKey("purchase_completed", orderId) }
        );
    } else {
        // Record the provider order first. The unique payment ID makes
        // retries safe, and the grant RPC below is idempotent so a retry can
        // recover if the first delivery stopped after this insert but before
        // fulfillment.
        await recordPayment(payment);

        const credits = getCreditsForProduct(productName, mergedMetadata, productId);

        if (credits <= 0) {
            await recordPaymentReconciliation({
                eventName: "order.paid",
                payload: order,
                reason: "unknown_one_time_product",
                userId,
                customerEmail: resolvedEmail,
                customerId: order.customer?.id,
                subscriptionId,
                paymentId,
            });
            return queued("unknown_one_time_product");
        }

        if (await isOrderFullyRefunded(order, paymentId)) {
            // A refund was recorded before (or while) this order was
            // fulfilled, e.g. refund.* arrived first or an admin replays an
            // old order.paid. Keep the payment row, grant nothing.
            console.log("Credit pack not granted: the order is fully refunded");
            return applied("order_fully_refunded");
        }

        await grantCreditPack(userId, credits, paymentId);
        console.log("One-time credit purchase fulfilled");

        await recordMarketingEvent(
            "purchase_completed",
            userId,
            resolvedEmail,
            marketingProperties,
            { throwOnError: true, dedupeKey: buildDedupeKey("purchase_completed", orderId) }
        );
    }

    // Save customer ID if available
    if (order.customer?.id) {
        await updateProfile(userId, {
            polar_customer_id: order.customer.id,
            updated_at: new Date().toISOString(),
        });
    }

    if (isSubscription) {
        // Subscriptions are activated only by subscription.active to prevent
        // double allocation.
        console.log("Subscription order recorded; access is handled by the subscription lifecycle event");
    }

    return applied();
}

// Handle subscription activation. This is the only event that binds a new
// subscription to a profile (including a Free one).
export async function handleSubscriptionActive(
    subscription: any,
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived("Subscription active", subscription);
    const customerEmail = normalizeEmail(subscription.customer?.email);
    const productName = subscription.product?.name || "";

    const profile = await resolveProfile(context, {
        eventName: "subscription.active",
        payload: subscription,
        reason: identityReason(subscription, customerEmail),
        userId: getProviderUserId(subscription),
        email: customerEmail,
        subscriptionId: subscription.id,
        customerId: subscription.customer?.id,
    });

    if (!profile) {
        return queued("profile_not_found");
    }

    const mergedMetadata = mergeMetadata(subscription);
    const productId = getPolarProductId(subscription);
    const isAnnual = resolvePolarBillingCycle(productName, mergedMetadata, productId) === "annual";
    const planId = resolvePolarPlanId(productName, mergedMetadata, productId);
    const rawCredits = getCreditsForProduct(productName, mergedMetadata, productId);
    const billingCycle = isAnnual ? "annual" : "monthly";
    const monthlyAllowance = resolveMonthlyAllowance({
        profile,
        planId,
        productId,
        subscriptionId: subscription.id,
        productCredits: rawCredits,
        isAnnual,
    });

    if (monthlyAllowance <= 0) {
        console.warn("No credits found for Polar subscription product");
    }

    await activateSubscriptionProfile({
        userId: profile.id,
        subscriptionId: subscription.id,
        planId,
        // The RPC keeps the stored customer ID when this is null.
        polarCustomerId: subscription.customer?.id || subscription.customerId || null,
        polarProductId: productId,
        billingCycle,
        monthlyCreditAllowance: monthlyAllowance,
        nextBillingDate: getSubscriptionEnd(subscription),
    });

    console.log(`Subscription profile configured for ${planId} (${billingCycle})`);
    return applied();
}

// Handle subscription cancellation
export async function handleSubscriptionCanceled(
    subscription: any,
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived("Subscription canceled", subscription);
    const customerEmail = normalizeEmail(subscription.customer?.email);

    const resolved = await resolveSubscriptionProfile(context, {
        eventName: "subscription.canceled",
        payload: subscription,
        reason: identityReason(subscription, customerEmail),
        userId: getProviderUserId(subscription),
        email: customerEmail,
        subscriptionId: subscription.id,
        customerId: subscription.customer?.id,
    });

    if (!resolved) {
        return queued("profile_not_found");
    }

    const guard = await guardSubscriptionEvent({
        eventName: "subscription.canceled",
        subscription,
        profile: resolved.profile,
        context,
        ignoreFreeProfiles: true,
        strongIdentity: resolved.strongIdentity,
    });
    if (guard.outcome) return guard.outcome;
    const profile = guard.profile;

    const subscriptionEnd = getSubscriptionEnd(subscription) || profile.next_billing_date;

    // Polar sends subscription.canceled when cancellation is requested,
    // while the customer may retain access until this period ends. Keep the
    // paid plan and annual drip metadata until subscription.revoked.
    await updateProfile(profile.id, {
        subscription_status: "cancelled",
        subscription_id: subscription.id,
        next_billing_date: subscriptionEnd,
        updated_at: new Date().toISOString(),
    });

    await recordMarketingEvent("subscription_canceled", profile.id, profile.email || customerEmail, {
        provider: "polar",
        subscription_id: subscription.id,
        product_name: subscription.product?.name || "",
        ends_at: subscriptionEnd,
    }, {
        throwOnError: true,
        dedupeKey: buildDedupeKey(
            "subscription_canceled",
            subscription.id,
            toIsoDate(subscription.canceledAt) || subscriptionEnd,
        ),
    });

    console.log("Subscription cancellation scheduled for the end of the paid period");
    return applied();
}

// Handle the point where Polar ends access. This is deliberately separate
// from subscription.canceled, which only schedules non-renewal.
export async function handleSubscriptionRevoked(
    subscription: any,
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived("Subscription revoked", subscription);

    const resolved = await resolveSubscriptionProfile(context, {
        eventName: "subscription.revoked",
        payload: subscription,
        reason: identityReason(subscription, subscription.customer?.email),
        userId: getProviderUserId(subscription),
        email: subscription.customer?.email,
        subscriptionId: subscription.id,
        customerId: subscription.customer?.id,
    });

    if (!resolved) {
        return queued("profile_not_found");
    }

    // A Free profile with no bound subscription is already revoked; the
    // guard returns "ignored" for it via the strict subscription match.
    const guard = await guardSubscriptionEvent({
        eventName: "subscription.revoked",
        subscription,
        profile: resolved.profile,
        context,
        ignoreFreeProfiles: false,
        strongIdentity: resolved.strongIdentity,
    });
    if (guard.outcome) return guard.outcome;
    const profile = guard.profile;

    await downgradeProfileToFree(profile, subscription.id);
    await recordMarketingEvent("subscription_revoked", profile.id, profile.email, {
        provider: "polar",
        subscription_id: subscription.id,
        product_name: subscription.product?.name || "",
        ended_at: toIsoDate(subscription.endedAt || subscription.endsAt),
    }, {
        throwOnError: true,
        dedupeKey: buildDedupeKey("subscription_revoked", subscription.id),
    });

    console.log("Revoked subscription downgraded to the free plan");
    return applied();
}

// Restore paid-plan metadata when a customer reverses a pending
// cancellation. Credits are not granted here because no new billing period
// has started.
export async function handleSubscriptionUncanceled(
    subscription: any,
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived("Subscription uncanceled", subscription);

    const resolved = await resolveSubscriptionProfile(context, {
        eventName: "subscription.uncanceled",
        payload: subscription,
        reason: identityReason(subscription, subscription.customer?.email),
        userId: getProviderUserId(subscription),
        email: subscription.customer?.email,
        subscriptionId: subscription.id,
        customerId: subscription.customer?.id,
    });

    if (!resolved) {
        return queued("profile_not_found");
    }

    const guard = await guardSubscriptionEvent({
        eventName: "subscription.uncanceled",
        subscription,
        profile: resolved.profile,
        context,
        ignoreFreeProfiles: true,
        strongIdentity: resolved.strongIdentity,
    });
    if (guard.outcome) return guard.outcome;
    const profile = guard.profile;

    const productName = subscription.product?.name || "";
    const mergedMetadata = mergeMetadata(subscription);
    const productId = getPolarProductId(subscription);
    const planId = resolvePolarPlanId(productName, mergedMetadata, productId);
    const isAnnual = resolvePolarBillingCycle(productName, mergedMetadata, productId) === "annual";
    // Resolved against the profile as it was before a binding in the guard,
    // so a newly bound legacy profile keeps its pinned allowance only for
    // its own stored Polar product.
    const monthlyAllowance = resolveMonthlyAllowance({
        profile: resolved.profile,
        planId,
        productId,
        subscriptionId: subscription.id,
        productCredits: getCreditsForProduct(productName, mergedMetadata, productId),
        isAnnual,
    });

    await updateProfile(profile.id, {
        subscription_plan: planId,
        subscription_status: "active",
        subscription_id: subscription.id,
        polar_customer_id: subscription.customer?.id || profile.polar_customer_id,
        polar_product_id: productId || profile.polar_product_id,
        billing_cycle: isAnnual ? "annual" : "monthly",
        monthly_credit_allowance: monthlyAllowance,
        next_billing_date: getSubscriptionEnd(subscription) || profile.next_billing_date,
        updated_at: new Date().toISOString(),
    });

    await recordMarketingEvent("subscription_uncanceled", profile.id, profile.email, {
        provider: "polar",
        subscription_id: subscription.id,
        product_name: productName,
        ends_at: getSubscriptionEnd(subscription) || profile.next_billing_date,
    }, {
        throwOnError: true,
        dedupeKey: buildDedupeKey(
            "subscription_uncanceled",
            subscription.id,
            toIsoDate(subscription.modifiedAt) || getSubscriptionEnd(subscription),
        ),
    });

    return applied();
}

// order.refunded carries Polar's cumulative refund totals but not the
// merchant's revoke-benefits choice. It records amounts and status only;
// access and credits change only through refund.* (see handleRefund).
export async function handleOrderRefunded(
    order: any,
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived("Order refunded", order);

    const orderId = getOrderIdFromOrder(order);
    if (!orderId) {
        await queueMissingOrderIdReconciliation("order.refunded", order);
        return queued("missing_order_id");
    }

    const paymentId = `polar_ord_${orderId}`;
    const refundedAmount = Number(order.refundedAmount || 0);
    const totalAmount = Number(order.totalAmount || 0);
    const subscriptionId = normalizeProviderId(order.subscriptionId);

    const refundResult = await recordPaymentRefund({
        paymentId,
        orderRefundedAmount: centsToAmount(refundedAmount),
        orderRefundedTaxAmount: centsToAmount(order.refundedTaxAmount || 0),
        orderStatus: typeof order.status === "string" ? order.status : null,
    });

    if (refundResult.payment_found === false && refundedAmount > 0) {
        // Polar's cumulative totals have nowhere to go until order.paid has
        // recorded the payment. Retry rather than drop them.
        throw new RefundBeforePaymentError("order.refunded");
    }

    const profile = await resolveProfile(context, {
        eventName: "order.refunded",
        payload: order,
        reason: identityReason(order, order.customer?.email),
        userId: getProviderUserId(order),
        email: order.customer?.email,
        subscriptionId,
        customerId: order.customer?.id,
        paymentId,
    });

    if (!profile) return queued("profile_not_found");

    await recordMarketingEvent("order_refunded", profile.id, profile.email, {
        provider: "polar",
        order_id: orderId,
        subscription_id: subscriptionId,
        product_name: order.product?.name || "",
        refunded_amount: refundedAmount,
        total_amount: totalAmount,
        full_refund: Boolean(refundResult.full_refund),
    }, {
        throwOnError: true,
        dedupeKey: buildDedupeKey("order_refunded", orderId, refundedAmount),
    });

    return applied();
}

// Handle subscription updates (renewals, in-period plan changes, past due).
export async function handleSubscriptionUpdated(
    subscription: any,
    context: PolarHandlerContext = {},
): Promise<PolarHandlerOutcome> {
    logWebhookReceived("Subscription updated", subscription);

    const status = String(subscription.status || "").toLowerCase();
    const isPastDue = status === "past_due" || status === "unpaid";
    if (status !== "active" && !isPastDue) {
        return ignored(`status_${status || "unknown"}`);
    }

    const customerEmail = normalizeEmail(subscription.customer?.email);
    const resolved = await resolveSubscriptionProfile(context, {
        eventName: "subscription.updated",
        payload: subscription,
        reason: identityReason(subscription, customerEmail),
        userId: getProviderUserId(subscription),
        email: customerEmail,
        subscriptionId: subscription.id,
        customerId: subscription.customer?.id,
    });

    if (!resolved) return queued("profile_not_found");

    const guard = await guardSubscriptionEvent({
        eventName: "subscription.updated",
        subscription,
        profile: resolved.profile,
        context,
        ignoreFreeProfiles: true,
        strongIdentity: resolved.strongIdentity,
    });
    if (guard.outcome) return guard.outcome;
    const profile = guard.profile;

    if (isPastDue) {
        // A failed renewal payment. Keep the plan (Polar retries the charge
        // and will send active or revoked), but stop showing the account as
        // in good standing. The annual drip skips past_due profiles.
        if (profile.subscription_status !== "past_due") {
            await updateProfile(profile.id, {
                subscription_status: "past_due",
                subscription_id: subscription.id,
                updated_at: new Date().toISOString(),
            });
        }
        console.log("Subscription marked past due");
        return applied("past_due");
    }

    const productName = subscription.product?.name || "";
    const mergedMetadata = mergeMetadata(subscription);
    const productId = getPolarProductId(subscription);
    const rawCredits = getCreditsForProduct(productName, mergedMetadata, productId);
    const planId = resolvePolarPlanId(productName, mergedMetadata, productId);
    const isAnnual = resolvePolarBillingCycle(productName, mergedMetadata, productId) === "annual";
    const billingCycle = isAnnual ? "annual" : "monthly";
    // Resolved against the profile as it was before a binding in the guard,
    // so a newly bound legacy profile keeps its pinned allowance only for
    // its own stored Polar product.
    const monthlyAllowance = resolveMonthlyAllowance({
        profile: resolved.profile,
        planId,
        productId,
        subscriptionId: subscription.id,
        productCredits: rawCredits,
        isAnnual,
    });

    if (monthlyAllowance <= 0) {
        console.log("Skipping credit update: no monthly allowance resolved");
        return ignored("no_monthly_allowance");
    }

    const renewalResult = await renewSubscriptionCredits({
        userId: profile.id,
        subscriptionId: subscription.id,
        planId,
        currentPeriodStart: toIsoDate(subscription.currentPeriodStart),
        polarProductId: productId,
        billingCycle,
        monthlyCreditAllowance: monthlyAllowance,
        nextBillingDate: getSubscriptionEnd(subscription),
    });

    if (renewalResult.renewed) {
        console.log("Subscription allowance renewed");
    } else if (renewalResult.reason === "subscription_mismatch") {
        // The profile is bound to another subscription. Nothing was applied;
        // an admin replay must not resolve its row on this outcome.
        console.warn("Skipping credit update: reason=subscription_mismatch");
        return ignored("subscription_mismatch");
    } else if (renewalResult.reason === "period_already_processed") {
        // Same period: this may be a plan switch made in the customer portal,
        // which must take effect now rather than at the next renewal.
        const changeResult = await changeSubscriptionPlan({
            userId: profile.id,
            subscriptionId: subscription.id,
            planId,
            polarProductId: productId,
            billingCycle,
            monthlyCreditAllowance: monthlyAllowance,
            nextBillingDate: getSubscriptionEnd(subscription),
        });
        console.log(
            changeResult.changed
                ? "Subscription plan changed within the current period"
                : `No plan change applied: reason=${changeResult.reason || "no_change"}`
        );
        if (changeResult.reason === "subscription_mismatch") {
            return ignored("subscription_mismatch");
        }

        // A retried charge succeeded within a period that was already
        // granted: the account is back in good standing.
        if (profile.subscription_status === "past_due") {
            await updateProfile(profile.id, {
                subscription_status: "active",
                updated_at: new Date().toISOString(),
            });
        }
    } else {
        console.log(
            `Skipping credit update: reason=${renewalResult.reason || "already_processed"}`
        );
        return ignored(renewalResult.reason || "not_renewed");
    }

    // Revenue is recorded by handleOrderPaid from Polar's canonical order ID.
    // This lifecycle event only updates access and credits; inserting a
    // payment row here would double-count renewals.
    return applied();
}

type StoredEventHandler = (payload: any, context: PolarHandlerContext) => Promise<PolarHandlerOutcome>;

/**
 * Handlers keyed by the `event_name` stored in payment_reconciliation.
 */
export const POLAR_EVENT_HANDLERS: Record<string, StoredEventHandler> = {
    "order.paid": handleOrderPaid,
    "order.refunded": handleOrderRefunded,
    "subscription.active": handleSubscriptionActive,
    "subscription.canceled": handleSubscriptionCanceled,
    "subscription.revoked": handleSubscriptionRevoked,
    "subscription.uncanceled": handleSubscriptionUncanceled,
    "subscription.updated": handleSubscriptionUpdated,
    refund_created: (payload, context) => handleRefund(payload, "refund_created", context),
    refund_updated: (payload, context) => handleRefund(payload, "refund_updated", context),
};

export function isReplayableEvent(eventName: string): boolean {
    return Object.prototype.hasOwnProperty.call(POLAR_EVENT_HANDLERS, eventName);
}

/**
 * Re-runs a stored Polar payload against an operator-chosen profile. The
 * handlers are idempotent (unique payment IDs, idempotent grant/renewal
 * RPCs, deduplicated marketing events), so a repeated replay is harmless.
 */
export async function replayPolarEvent(
    eventName: string,
    payload: unknown,
    profile: BillingProfile,
): Promise<PolarHandlerOutcome> {
    const handler = POLAR_EVENT_HANDLERS[eventName];
    if (!handler) {
        throw new Error(`Unsupported Polar event: ${eventName}`);
    }
    return handler(payload, { forcedProfile: profile });
}
