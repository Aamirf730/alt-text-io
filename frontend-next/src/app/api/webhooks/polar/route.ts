import { Webhooks } from "@polar-sh/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { extractPolarBillingSnapshot } from "@/lib/polar-billing";
import {
    isPolarSubscriptionProduct,
    resolvePolarBillingCycle,
    resolvePolarPlanId,
} from "@/lib/polar-plan-mapping";
import { safeServerError } from "@/lib/safe-server-log";

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
// Updated Aug 2026: Lite/Standard/Pro/Agency plans
const CREDITS_MAP: Record<string, number> = {
    // Current plan names
    lite_monthly: 150,
    standard_monthly: 1000,
    pro_monthly: 2000,
    agency_monthly: 3500,
    // Annual subscriptions (monthly credits × 12)
    lite_annual: 1800,      // 150 × 12
    standard_annual: 12000, // 1000 × 12
    pro_annual: 24000,      // 2000 × 12
    agency_annual: 42000,   // 3500 × 12
    // Plan-id aliases
    tier1_monthly: 150,
    tier2_monthly: 1000,
    tier3_monthly: 2000,
    tier4_monthly: 3500,
    tier1_annual: 1800,
    tier2_annual: 12000,
    tier3_annual: 24000,
    tier4_annual: 42000,
    // One-time purchases (prices unchanged; credits increased)
    small_pack: 500,   // $5
    credit_pack: 1200, // $10
};

// Monthly allowance per plan. Used by the annual drip and monthly plans.
const MONTHLY_CREDITS_MAP: Record<string, number> = {
    tier1: 150,
    tier2: 1000,
    tier3: 2000,
    tier4: 3500,
};

function logWebhookReceived(eventName: string, data: any) {
    console.log(`${eventName} webhook received`, {
        status: data?.status,
    });
}

function safeErrorMessage(error: unknown): string {
    return safeServerError(error);
}

function isUniqueViolation(error: unknown): boolean {
    return Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
    );
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

async function recordMarketingEvent(
    eventName: string,
    userId: string,
    userEmail: string | null,
    properties: Record<string, string | number | boolean | null | undefined>,
    options: { throwOnError?: boolean } = {}
) {
    const { error } = await getSupabase()
        .from("marketing_events")
        .insert({
            event_name: eventName,
            source: "polar_webhook",
            user_id: userId,
            user_email: userEmail,
            properties,
            occurred_at: new Date().toISOString(),
        });

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

type BillingProfile = {
    id: string;
    email: string | null;
    subscription_id: string | null;
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
    "polar_customer_id",
    "polar_product_id",
    "bonus_credits_remaining",
    "purchased_credits_remaining",
    "credits_remaining",
    "credits_last_renewed_at",
    "monthly_credit_allowance",
    "next_billing_date",
].join(", ");

type BillingField = "id" | "subscription_id" | "polar_customer_id" | "email";
const AUTH_LOOKUP_PAGE_SIZE = 1000;
const MAX_AUTH_LOOKUP_PAGES = 100;

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
    const query = getSupabase()
        .from("profiles")
        .select(BILLING_PROFILE_COLUMNS);

    const filteredQuery = field === "email"
        ? query.ilike(field, escapeIlikePattern(value))
        : query.eq(field, value);
    const { data, error } = await filteredQuery.limit(1);

    if (error) {
        throw error;
    }

    return (data?.[0] as unknown as BillingProfile | undefined) || null;
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
}): Promise<BillingProfile | null> {
    const normalizedUserId = normalizeUserId(userId);
    if (normalizedUserId) {
        // Metadata is created by our authenticated checkout endpoint. If it is
        // present but stale, queue the event rather than rebinding it to an
        // unrelated account via a mutable email address.
        return findProfileByBillingField("id", normalizedUserId);
    }

    if (subscriptionId) {
        const profile = await findProfileByBillingField("subscription_id", subscriptionId);
        if (profile) return profile;
    }

    if (customerId) {
        const profile = await findProfileByBillingField("polar_customer_id", customerId);
        if (profile) return profile;
    }

    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) {
        const profile = await findProfileByBillingField("email", normalizedEmail);
        if (profile) return profile;

        for (let page = 1; page <= MAX_AUTH_LOOKUP_PAGES + 1; page += 1) {
            const { data: authData, error: authError } = await getSupabase().auth.admin.listUsers({
                page,
                perPage: AUTH_LOOKUP_PAGE_SIZE,
            });
            if (authError) {
                throw authError;
            }

            const batch = authData?.users || [];
            if (page > MAX_AUTH_LOOKUP_PAGES) {
                if (batch.length === 0) break;
                throw new Error("Auth user pagination limit reached while resolving a Polar billing identity");
            }

            const authUser = batch.find((user) => normalizeEmail(user.email) === normalizedEmail);
            if (authUser?.id) {
                return findProfileByBillingField("id", authUser.id);
            }

            if (batch.length < AUTH_LOOKUP_PAGE_SIZE) {
                break;
            }
        }
    }

    return null;
}

function getProviderObjectId(payload: any): string {
    const directId = payload?.id || payload?.orderId || payload?.subscriptionId;
    if (directId) return String(directId);

    return createHash("sha256")
        .update(JSON.stringify(payload || {}))
        .digest("hex");
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
    const providerObjectId = getProviderObjectId(payload);
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
}): Promise<BillingProfile | null> {
    const profile = await findBillingProfile({ userId, email, subscriptionId, customerId });
    if (profile) return profile;

    await recordPaymentReconciliation({
        eventName,
        payload,
        reason,
        userId,
        customerEmail: email,
        customerId,
        subscriptionId,
        paymentId,
    });
    return null;
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

function matchesSubscription(profile: BillingProfile, subscriptionId?: string | null): boolean {
    return !subscriptionId || !profile.subscription_id || profile.subscription_id === subscriptionId;
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
    subscriptionId?: string | null,
): Promise<void> {
    const { data, error } = await getSupabase().rpc("revoke_subscription_access", {
        p_user_id: profile.id,
        p_subscription_id: subscriptionId || null,
    });

    if (error) {
        throw error;
    }

    if (!data?.success) {
        throw new Error(data?.error || "Subscription revocation failed");
    }
}

async function markPaymentStatus(paymentId: string, status: string): Promise<void> {
    const { error } = await getSupabase()
        .from("payments")
        .update({
            status,
            updated_at: new Date().toISOString(),
        })
        .eq("payment_id", paymentId)
        .eq("payment_method", "polar");

    if (error) {
        throw error;
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

async function processRefund(
    refund: any,
    webhookName: string,
    eventName: string,
): Promise<void> {
    logWebhookReceived(webhookName, refund);

    const orderId = getOrderIdFromRefund(refund);
    if (!orderId) {
        await queueMissingOrderIdReconciliation(eventName, refund);
        return;
    }

    const paymentId = `polar_ord_${orderId}`;
    const profile = await findOrQueueBillingProfile({
        eventName,
        payload: refund,
        reason: !getProviderUserId(refund) && !normalizeEmail(refund.customer?.email)
            ? "missing_customer_identity"
            : "profile_not_found",
        userId: getProviderUserId(refund),
        email: refund.customer?.email,
        subscriptionId: refund.subscriptionId,
        customerId: refund.customerId,
        paymentId,
    });
    const succeeded = refund.status === "succeeded";

    if (succeeded) {
        await markPaymentStatus(paymentId, "refunded");

        if (refund.revokeBenefits && refund.subscriptionId && profile && matchesSubscription(profile, refund.subscriptionId)) {
            await downgradeProfileToFree(profile, refund.subscriptionId);
        } else if (refund.revokeBenefits && !refund.subscriptionId) {
            await revokeCreditPack(paymentId);
        }
    }

    if (profile) {
        await recordMarketingEvent(eventName, profile.id, profile.email, {
            provider: "polar",
            refund_id: refund.id,
            order_id: refund.orderId,
            subscription_id: refund.subscriptionId,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            reason: refund.reason,
            revoke_benefits: refund.revokeBenefits,
        }, { throwOnError: true });
    }
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

    const sameSubscription =
        Boolean(subscriptionId) && profile.subscription_id === subscriptionId;
    const sameProduct =
        !profile.polar_product_id || !productId || profile.polar_product_id === productId;

    return sameSubscription && sameProduct ? pinned : catalogueAllowance;
}

// Helper to update user credits
async function updateUserCredits(
    userId: string,
    credits: number,
    isSubscription: boolean,
    paymentId?: string,
) {
    if (isSubscription) {
        throw new Error("Subscription credit activation must use activateSubscriptionProfile");
    } else {
        if (!paymentId) {
            throw new Error("One-time credit purchases require a payment ID");
        }

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

const polarWebhookHandlers = {

    // Handle successful order payment and subscription revenue bookkeeping.
    // Credit allocation for subscriptions is handled by the subscription
    // lifecycle callbacks so it cannot happen twice.
    onOrderPaid: async (payload) => {
        try {
            const order = payload.data;
            logWebhookReceived("Order paid", order);
            const customerEmail = normalizeEmail(order.customer?.email);

            // Get product details early to check if this is a subscription
            const productName = order.product?.name || "";

            const mergedMetadata = {
                ...(order.product?.metadata || {}),
                ...(order.metadata || {}),
            } as Record<string, string | number | boolean>;

            const billingSnapshot = extractPolarBillingSnapshot(order);
            const productId = billingSnapshot.productId || normalizeProviderId(order.product?.id);
            const isSubscription = isPolarSubscriptionProduct(productName, mergedMetadata, productId);
            const subscriptionId = order.subscriptionId || (order as { subscription_id?: string | null }).subscription_id || null;
            const orderId = getOrderIdFromOrder(order);
            if (!orderId) {
                await queueMissingOrderIdReconciliation("order.paid", order);
                return;
            }
            const paymentId = `polar_ord_${orderId}`;
            const profile = await findOrQueueBillingProfile({
                eventName: "order.paid",
                payload: order,
                reason: !getProviderUserId(order) && !customerEmail
                    ? "missing_customer_identity"
                    : "profile_not_found",
                userId: getProviderUserId(order),
                email: customerEmail,
                subscriptionId,
                customerId: order.customer?.id,
                paymentId,
            });

            if (!profile) return;

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

            // Order-paid is the canonical revenue event for subscriptions.
            // The order ID is stable across webhook retries, while
            // subscription.updated is a lifecycle event and must not create a
            // second payment row for the same paid period.
            if (isSubscription) {
                await recordPayment(payment);
                await recordMarketingEvent(
                    "purchase_completed",
                    userId,
                    resolvedEmail,
                    marketingProperties,
                    { throwOnError: true }
                );
            }

            if (!isSubscription) {
                // Record the provider order first. The unique payment ID makes
                // retries safe, and the grant RPC below is idempotent so a
                // retry can recover if the first delivery stopped after this
                // insert but before fulfillment.
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
                    return;
                }

                await updateUserCredits(userId, credits, false, paymentId);
                console.log("One-time credit purchase fulfilled");

                await recordMarketingEvent(
                    "purchase_completed",
                    userId,
                    resolvedEmail,
                    marketingProperties,
                    { throwOnError: true }
                );
            }

            // Save customer ID if available
            if (order.customer?.id) {
                await updateProfile(userId, {
                    polar_customer_id: order.customer.id,
                    updated_at: new Date().toISOString(),
                });
            }

            // Check if this is a subscription purchase
            // Subscriptions should ONLY be handled by onSubscriptionActive to prevent double allocation
            if (isSubscription) {
                console.log("Subscription order recorded; access is handled by the subscription lifecycle event");
                return;
            }
        } catch (error) {
            console.error("Error processing order paid webhook:", safeErrorMessage(error));
            // Do not swallow credit-allocation failures. Returning 200 here
            // would prevent Polar from retrying a payment that was not
            // recorded or granted successfully.
            throw error;
        }
    },

    // Handle subscription activation
    onSubscriptionActive: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription active", subscription);
            const customerEmail = normalizeEmail(subscription.customer?.email);

            // Get product details early for plan resolution.
            const productName = subscription.product?.name || "";

            const profile = await findOrQueueBillingProfile({
                eventName: "subscription.active",
                payload: subscription,
                reason: !getProviderUserId(subscription) && !customerEmail
                    ? "missing_customer_identity"
                    : "profile_not_found",
                userId: getProviderUserId(subscription),
                email: customerEmail,
                subscriptionId: subscription.id,
                customerId: subscription.customer?.id,
            });
            const userId = profile?.id || null;

            if (!userId) {
                return;
            }

            const mergedMetadata = {
                ...(subscription.product?.metadata || {}),
                ...(subscription.metadata || {}),
            } as Record<string, string | number | boolean>;
            const productId = getPolarProductId(subscription);
            const isAnnual = resolvePolarBillingCycle(productName, mergedMetadata, productId) === "annual";
            const planId = resolvePolarPlanId(productName, mergedMetadata, productId);

            const rawCredits = getCreditsForProduct(productName, mergedMetadata, productId);

            const billingCycle = isAnnual ? "annual" : "monthly";
            const monthlyAllowance = resolveMonthlyAllowance({
                profile: profile!,
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
                userId,
                subscriptionId: subscription.id,
                planId,
                polarCustomerId: subscription.customer?.id || null,
                polarProductId: productId,
                billingCycle,
                monthlyCreditAllowance: monthlyAllowance,
                nextBillingDate: getSubscriptionEnd(subscription),
            });

            console.log(`Subscription profile configured for ${planId} (${billingCycle})`);

        } catch (error) {
            console.error("Error processing subscription active webhook:", safeErrorMessage(error));
            throw error;
        }
    },

    // Handle subscription cancellation
    onSubscriptionCanceled: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription canceled", subscription);
            const customerEmail = normalizeEmail(subscription.customer?.email);

            const profile = await findOrQueueBillingProfile({
                eventName: "subscription.canceled",
                payload: subscription,
                reason: !getProviderUserId(subscription) && !customerEmail
                    ? "missing_customer_identity"
                    : "profile_not_found",
                userId: getProviderUserId(subscription),
                email: customerEmail,
                subscriptionId: subscription.id,
                customerId: subscription.customer?.id,
            });

            if (!profile) {
                return;
            }

            if (!matchesSubscription(profile, subscription.id)) {
                console.warn("Ignoring cancellation for a stale subscription");
                return;
            }

            const subscriptionEnd = getSubscriptionEnd(subscription) || profile.next_billing_date;

            // Polar sends subscription.canceled when cancellation is requested,
            // while the customer may retain access until this period ends. Keep
            // the paid plan and annual drip metadata until subscription.revoked.
            await updateProfile(profile.id, {
                subscription_status: "cancelled",
                next_billing_date: subscriptionEnd,
                updated_at: new Date().toISOString(),
            });

            await recordMarketingEvent("subscription_canceled", profile.id, profile.email || customerEmail, {
                provider: "polar",
                subscription_id: subscription.id,
                product_name: subscription.product?.name || "",
                ends_at: subscriptionEnd,
            }, { throwOnError: true });

            console.log("Subscription cancellation scheduled for the end of the paid period");
        } catch (error) {
            console.error("Error processing subscription canceled webhook:", safeErrorMessage(error));
            throw error;
        }
    },

    // Handle the point where Polar ends access. This is deliberately separate
    // from subscription.canceled, which only schedules non-renewal.
    onSubscriptionRevoked: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription revoked", subscription);

            const profile = await findOrQueueBillingProfile({
                eventName: "subscription.revoked",
                payload: subscription,
                reason: !getProviderUserId(subscription) && !normalizeEmail(subscription.customer?.email)
                    ? "missing_customer_identity"
                    : "profile_not_found",
                userId: getProviderUserId(subscription),
                email: subscription.customer?.email,
                subscriptionId: subscription.id,
                customerId: subscription.customer?.id,
            });

            if (!profile) {
                return;
            }

            if (!matchesSubscription(profile, subscription.id)) {
                console.warn("Ignoring revocation for a stale subscription");
                return;
            }

            await downgradeProfileToFree(profile, subscription.id);
            await recordMarketingEvent("subscription_revoked", profile.id, profile.email, {
                provider: "polar",
                subscription_id: subscription.id,
                product_name: subscription.product?.name || "",
                ended_at: toIsoDate(subscription.endedAt || subscription.endsAt),
            }, { throwOnError: true });

            console.log("Revoked subscription downgraded to the free plan");
        } catch (error) {
            console.error("Error processing subscription revoked webhook:", safeErrorMessage(error));
            throw error;
        }
    },

    // Restore paid-plan metadata when a customer reverses a pending
    // cancellation. Credits are not granted here because no new billing
    // period has started.
    onSubscriptionUncanceled: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription uncanceled", subscription);

            const profile = await findOrQueueBillingProfile({
                eventName: "subscription.uncanceled",
                payload: subscription,
                reason: !getProviderUserId(subscription) && !normalizeEmail(subscription.customer?.email)
                    ? "missing_customer_identity"
                    : "profile_not_found",
                userId: getProviderUserId(subscription),
                email: subscription.customer?.email,
                subscriptionId: subscription.id,
                customerId: subscription.customer?.id,
            });

            if (!profile) {
                return;
            }

            if (!matchesSubscription(profile, subscription.id)) {
                console.warn("Ignoring uncancellation for a stale subscription");
                return;
            }

            const productName = subscription.product?.name || "";
            const mergedMetadata = {
                ...(subscription.product?.metadata || {}),
                ...(subscription.metadata || {}),
            } as Record<string, string | number | boolean>;
            const productId = getPolarProductId(subscription);
            const planId = resolvePolarPlanId(productName, mergedMetadata, productId);
            const isAnnual = resolvePolarBillingCycle(productName, mergedMetadata, productId) === "annual";
            const monthlyAllowance = resolveMonthlyAllowance({
                profile,
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
            }, { throwOnError: true });
        } catch (error) {
            console.error("Error processing subscription uncanceled webhook:", safeErrorMessage(error));
            throw error;
        }
    },

    // Handle full/partial refunds for both subscription orders and one-time
    // credit packs. A full order refund revokes benefits; partial refunds are
    // recorded but do not remove an entire pack.
    onOrderRefunded: async (payload) => {
        try {
            const order = payload.data;
            logWebhookReceived("Order refunded", order);

            const orderId = getOrderIdFromOrder(order);
            if (!orderId) {
                await queueMissingOrderIdReconciliation("order.refunded", order);
                return;
            }

            const paymentId = `polar_ord_${orderId}`;
            const refundedAmount = Number(order.refundedAmount || 0);
            const totalAmount = Number(order.totalAmount || 0);
            const isFullRefund = order.status === "refunded"
                || (totalAmount > 0 && refundedAmount >= totalAmount);
            const productName = order.product?.name || "";
            const mergedMetadata = {
                ...(order.product?.metadata || {}),
                ...(order.metadata || {}),
            } as Record<string, string | number | boolean>;
            const productId = normalizeProviderId(order.product?.id);
            const isSubscription = Boolean(order.subscriptionId)
                || isPolarSubscriptionProduct(productName, mergedMetadata, productId);

            await markPaymentStatus(
                paymentId,
                order.status === "partially_refunded" ? "partially_refunded" : "refunded",
            );

            const profile = await findOrQueueBillingProfile({
                eventName: "order.refunded",
                payload: order,
                reason: !getProviderUserId(order) && !normalizeEmail(order.customer?.email)
                    ? "missing_customer_identity"
                    : "profile_not_found",
                userId: getProviderUserId(order),
                email: order.customer?.email,
                subscriptionId: order.subscriptionId,
                customerId: order.customer?.id,
                paymentId,
            });

            if (isFullRefund && isSubscription && profile && matchesSubscription(profile, order.subscriptionId)) {
                await downgradeProfileToFree(profile, order.subscriptionId);
            } else if (isFullRefund && !isSubscription) {
                await revokeCreditPack(paymentId);
            }

            if (profile) {
                await recordMarketingEvent("order_refunded", profile.id, profile.email, {
                    provider: "polar",
                    order_id: orderId,
                    subscription_id: order.subscriptionId,
                    product_name: productName,
                    refunded_amount: refundedAmount,
                    total_amount: totalAmount,
                    full_refund: isFullRefund,
                }, { throwOnError: true });
            }
        } catch (error) {
            console.error("Error processing order refunded webhook:", safeErrorMessage(error));
            throw error;
        }
    },

    // refund.created can arrive before or after order.refunded. Only a
    // succeeded refund with revoke_benefits=true changes access/credits; the
    // database RPC makes duplicate deliveries harmless.
    onRefundCreated: async (payload) => {
        try {
            await processRefund(payload.data, "Refund created", "refund_created");
        } catch (error) {
            console.error("Error processing refund created webhook:", safeErrorMessage(error));
            throw error;
        }
    },

    // A refund may be pending when refund.created arrives. Reprocess the
    // provider's final status so a later success cannot leave benefits active.
    onRefundUpdated: async (payload) => {
        try {
            await processRefund(payload.data, "Refund updated", "refund_updated");
        } catch (error) {
            console.error("Error processing refund updated webhook:", safeErrorMessage(error));
            throw error;
        }
    },

    // Handle subscription updates (renewals)
    onSubscriptionUpdated: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription updated", subscription);

            // Check if this is a renewal (status is active and we have current period info)
            if (subscription.status === "active") {
                const customerEmail = normalizeEmail(subscription.customer?.email);
                const user = await findOrQueueBillingProfile({
                    eventName: "subscription.updated",
                    payload: subscription,
                    reason: !getProviderUserId(subscription) && !customerEmail
                        ? "missing_customer_identity"
                        : "profile_not_found",
                    userId: getProviderUserId(subscription),
                    email: customerEmail,
                    subscriptionId: subscription.id,
                    customerId: subscription.customer?.id,
                });

                if (!user) return;

                const userId = user.id;
                const productName = subscription.product?.name || "";

                const mergedMetadata = {
                    ...(subscription.product?.metadata || {}),
                    ...(subscription.metadata || {}),
                } as Record<string, string | number | boolean>;

                const productId = getPolarProductId(subscription);
                const rawCredits = getCreditsForProduct(productName, mergedMetadata, productId);
                const planId = resolvePolarPlanId(productName, mergedMetadata, productId);
                const isAnnual = resolvePolarBillingCycle(productName, mergedMetadata, productId) === "annual";
                const billingCycle = isAnnual ? "annual" : "monthly";
                const monthlyAllowance = resolveMonthlyAllowance({
                    profile: user,
                    planId,
                    productId,
                    subscriptionId: subscription.id,
                    productCredits: rawCredits,
                    isAnnual,
                });

                if (monthlyAllowance > 0) {
                    const renewalResult = await renewSubscriptionCredits({
                        userId,
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
                    } else {
                        console.log(
                            `Skipping credit update: reason=${renewalResult.reason || "already_processed"}`
                        );
                    }

                    // Revenue is recorded by onOrderPaid from Polar's
                    // canonical order ID. This lifecycle event only updates
                    // access and credits; inserting a payment row here would
                    // double-count renewals.
                } else {
                    console.log("Skipping credit update: no monthly allowance resolved");
                }
            }
        } catch (error) {
            console.error("Error processing subscription updated webhook:", safeErrorMessage(error));
            throw error;
        }
    },
} satisfies Omit<Parameters<typeof Webhooks>[0], "webhookSecret">;

const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET;

if (!polarWebhookSecret) {
    console.error("POLAR_WEBHOOK_SECRET is not configured; Polar webhooks are disabled");
}

export const POST = polarWebhookSecret
    ? Webhooks({
        webhookSecret: polarWebhookSecret,
        ...polarWebhookHandlers,
    })
    : async () => new Response(
        JSON.stringify({ success: false, error: "Webhook service unavailable" }),
        {
            status: 503,
            headers: { "content-type": "application/json" },
        },
    );
