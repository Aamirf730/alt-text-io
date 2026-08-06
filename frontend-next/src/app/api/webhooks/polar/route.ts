import { Webhooks } from "@polar-sh/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { extractPolarBillingSnapshot } from "@/lib/polar-billing";
import { isPolarSubscriptionProduct, resolvePolarPlanId } from "@/lib/polar-plan-mapping";

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
// Updated Feb 2026: Lite/Standard/Pro plans
const CREDITS_MAP: Record<string, number> = {
    // New plan names (Feb 2026)
    lite_monthly: 150,
    standard_monthly: 400,
    pro_monthly: 1000,
    // Annual subscriptions (monthly credits × 12)
    lite_annual: 1800,      // 150 × 12
    standard_annual: 4800,  // 400 × 12
    pro_annual: 12000,      // 1000 × 12
    // Legacy aliases (maps old tier names to new credits)
    tier1_monthly: 150,
    tier2_monthly: 400,
    tier3_monthly: 1000,
    tier1_annual: 1800,
    tier2_annual: 4800,
    tier3_annual: 12000,
    // One-time purchases (Feb 2026 update)
    small_pack: 100,   // $5 for 100 images
    credit_pack: 250,  // $10 for 250 images
};

// Monthly credit allowance for annual plans (used by pg_cron monthly drip)
const MONTHLY_CREDITS_MAP: Record<string, number> = {
    tier1: 150,
    tier2: 400,
    tier3: 1000,
};

function logWebhookReceived(eventName: string, data: any) {
    console.log(`${eventName} webhook received`, {
        id: data?.id,
        status: data?.status,
        product: data?.product?.name,
        hasCustomerEmail: Boolean(data?.customer?.email),
        customerId: data?.customer?.id,
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

async function recordPayment(payment: Record<string, unknown>) {
    const { error } = await getSupabase()
        .from("payments")
        .insert(payment);

    if (!error) {
        console.log(`✓ Recorded payment ${String(payment.payment_id)}`);
        return;
    }

    // A replayed Polar webhook is already fulfilled if this payment exists.
    // The unique index added by the accompanying migration makes this safe.
    if (isUniqueViolation(error)) {
        console.log(`↺ Payment ${String(payment.payment_id)} was already recorded`);
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
        console.warn(`Could not record marketing event ${eventName}:`, error.message);
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
        providerObjectId,
        reason,
        candidateUserId: row.candidate_user_id,
        customerId: row.customer_id,
        customerEmail: row.customer_email,
        subscriptionId: row.subscription_id,
        paymentId: row.payment_id,
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

    const paymentId = `polar_ord_${refund.orderId}`;
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
    metadata?: Record<string, string | number | boolean | null | undefined>
): number {
    // First check metadata for explicit credits
    if (metadata?.credits) {
        const raw = metadata.credits;
        const asNum = typeof raw === "number" ? raw : parseInt(String(raw), 10);
        return Number.isFinite(asNum) ? asNum : 0;
    }

    // Try to match by product name pattern
    const normalizedName = productName.toLowerCase().replace(/\s+/g, "_");

    for (const [key, credits] of Object.entries(CREDITS_MAP)) {
        if (normalizedName.includes(key)) {
            return credits;
        }
    }

    // Fallback based on common naming patterns
    // New naming: lite/standard/pro
    if (normalizedName.includes("lite")) {
        return normalizedName.includes("annual") ? 1800 : 150;
    }
    if (normalizedName.includes("standard")) {
        return normalizedName.includes("annual") ? 4800 : 400;
    }
    if (normalizedName.includes("pro")) {
        return normalizedName.includes("annual") ? 12000 : 1000;
    }
    // Legacy naming: tier1/tier2/tier3
    if (normalizedName.includes("tier1") || normalizedName.includes("tier_1")) {
        return normalizedName.includes("annual") ? 1800 : 150;
    }
    if (normalizedName.includes("tier2") || normalizedName.includes("tier_2")) {
        return normalizedName.includes("annual") ? 4800 : 400;
    }
    if (normalizedName.includes("tier3") || normalizedName.includes("tier_3")) {
        return normalizedName.includes("annual") ? 12000 : 1000;
    }
    if (normalizedName.includes("small")) {
        return 100;
    }
    if (normalizedName.includes("credit") || normalizedName.includes("pack")) {
        return 250;
    }

    console.warn(`Unknown product: ${productName}, defaulting to 0 credits`);
    return 0;
}

// Helper to update user credits
async function updateUserCredits(
    userId: string,
    credits: number,
    isSubscription: boolean,
    paymentId?: string,
) {
    console.log(`Updating credits for user ${userId}: +${credits} credits, isSubscription: ${isSubscription}`);

    if (isSubscription) {
        // Reset plan credits while preserving unspent promotional and paid
        // pack balances.
        const { data: profile, error: fetchError } = await getSupabase()
            .from("profiles")
            .select("bonus_credits_remaining, purchased_credits_remaining")
            .eq("id", userId)
            .single();

        if (fetchError) {
            console.error("Error fetching persistent credit balances:", fetchError);
            throw fetchError;
        }

        const bonusCredits = Number(profile?.bonus_credits_remaining || 0);
        const purchasedCredits = Number(profile?.purchased_credits_remaining || 0);
        const { error } = await getSupabase()
            .from("profiles")
            .update({
                credits_remaining: credits + bonusCredits + purchasedCredits,
                total_processed: 0,
                subscription_status: "active",
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) {
            console.error("Error updating subscription credits:", error);
            throw error;
        }
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
            console.error("Error updating one-time credits:", error);
            throw error;
        }

        if (!data?.success) {
            throw new Error(data?.error || "Credit-pack grant failed");
        }
    }

    console.log(`Successfully updated credits for user ${userId}`);
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

            const isSubscription = isPolarSubscriptionProduct(productName, mergedMetadata);
            const billingSnapshot = extractPolarBillingSnapshot(order);
            const subscriptionId = order.subscriptionId || (order as { subscription_id?: string | null }).subscription_id || null;
            const paymentId = `polar_ord_${order.id}`;
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
            const planId = resolvePolarPlanId(productName, mergedMetadata);
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
                order_id: order.id,
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
                // Fulfill first. The grant RPC is idempotent by payment ID, so
                // a retry after a bookkeeping failure cannot double-credit.
                console.log(`✓ Processing one-time purchase: ${productName}`);
                const credits = getCreditsForProduct(productName, mergedMetadata);

                if (credits > 0) {
                    await updateUserCredits(userId, credits, false, paymentId);
                    console.log(`✓ Added ${credits} credits to user ${userId} for one-time purchase "${productName}"`);
                } else {
                    console.warn(`No credits found for product: ${productName}`);
                }

                // Record only after fulfillment. Non-duplicate failures are
                // thrown so Polar retries; the grant and payment are both
                // idempotent on that retry.
                await recordPayment(payment);
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
                await getSupabase()
                    .from("profiles")
                    .update({
                        polar_customer_id: order.customer.id,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", userId);
            }

            // Check if this is a subscription purchase
            // Subscriptions should ONLY be handled by onSubscriptionActive to prevent double allocation
            if (isSubscription) {
                console.log(`⚠️ Skipping credit allocation in onOrderPaid for subscription "${productName}" - will be handled by onSubscriptionActive`);
                return;
            }
        } catch (error) {
            console.error("Error processing order paid webhook:", error);
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

            // Get product details early for logging
            const productName = subscription.product?.name || "";
            console.log(`✓ Processing subscription activation: ${productName} for ${customerEmail}`);

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

            // Determine planId
            const isAnnual = productName.toLowerCase().includes("annual");
            const mergedMetadata = {
                ...(subscription.product?.metadata || {}),
                ...(subscription.metadata || {}),
            } as Record<string, string | number | boolean>;
            const planId = resolvePolarPlanId(productName, mergedMetadata);

            const rawCredits = getCreditsForProduct(productName, mergedMetadata);

            // Determine billing cycle
            const billingCycle = isAnnual ? "annual" : "monthly";

            // For Monthly Drip, annual plans only get the monthly portion initially (e.g. 150 instead of 1800)
            const creditsToGrant = isAnnual ? (MONTHLY_CREDITS_MAP[planId] || rawCredits) : rawCredits;

            if (creditsToGrant > 0) {
                await updateUserCredits(userId, creditsToGrant, true);
                console.log(`✓ Set ${creditsToGrant} credits for user ${userId} for subscription "${productName}" (${billingCycle} drip)`);
            } else {
                console.warn(`No credits found for subscription product: ${productName}`);
            }

            // Update profile with subscription info and drip metadata
            const monthlyAllowance = MONTHLY_CREDITS_MAP[planId] || null;

            await getSupabase()
                .from("profiles")
                .update({
                    subscription_plan: planId,
                    subscription_status: "active",
                    subscription_id: subscription.id,
                    polar_customer_id: subscription.customer?.id || null,
                    billing_cycle: billingCycle,
                    monthly_credit_allowance: billingCycle === "annual" ? monthlyAllowance : null,
                    next_billing_date: getSubscriptionEnd(subscription),
                    credits_last_renewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

            console.log(`✓ Configured profile for ${planId} (${billingCycle}) for user ${userId}`);

        } catch (error) {
            console.error("Error processing subscription active webhook:", error);
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
                console.warn(`Ignoring cancellation for stale subscription ${subscription.id}`);
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

            console.log(`Subscription cancellation scheduled for user ${profile.id} at ${subscriptionEnd || "provider-reported end"}`);
        } catch (error) {
            console.error("Error processing subscription canceled webhook:", error);
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
                console.warn(`Ignoring revocation for stale subscription ${subscription.id}`);
                return;
            }

            await downgradeProfileToFree(profile, subscription.id);
            await recordMarketingEvent("subscription_revoked", profile.id, profile.email, {
                provider: "polar",
                subscription_id: subscription.id,
                product_name: subscription.product?.name || "",
                ended_at: toIsoDate(subscription.endedAt || subscription.endsAt),
            }, { throwOnError: true });

            console.log(`Subscription revoked and downgraded to free for user ${profile.id}`);
        } catch (error) {
            console.error("Error processing subscription revoked webhook:", error);
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
                console.warn(`Ignoring uncancellation for stale subscription ${subscription.id}`);
                return;
            }

            const productName = subscription.product?.name || "";
            const mergedMetadata = {
                ...(subscription.product?.metadata || {}),
                ...(subscription.metadata || {}),
            } as Record<string, string | number | boolean>;
            const planId = resolvePolarPlanId(productName, mergedMetadata);
            const isAnnual = productName.toLowerCase().includes("annual");

            await updateProfile(profile.id, {
                subscription_plan: planId,
                subscription_status: "active",
                subscription_id: subscription.id,
                polar_customer_id: subscription.customer?.id || profile.polar_customer_id,
                billing_cycle: isAnnual ? "annual" : "monthly",
                monthly_credit_allowance: isAnnual ? (MONTHLY_CREDITS_MAP[planId] || null) : null,
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
            console.error("Error processing subscription uncanceled webhook:", error);
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

            const paymentId = `polar_ord_${order.id}`;
            const refundedAmount = Number(order.refundedAmount || 0);
            const totalAmount = Number(order.totalAmount || 0);
            const isFullRefund = order.status === "refunded"
                || (totalAmount > 0 && refundedAmount >= totalAmount);
            const productName = order.product?.name || "";
            const mergedMetadata = {
                ...(order.product?.metadata || {}),
                ...(order.metadata || {}),
            } as Record<string, string | number | boolean>;
            const isSubscription = Boolean(order.subscriptionId)
                || isPolarSubscriptionProduct(productName, mergedMetadata);

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
                    order_id: order.id,
                    subscription_id: order.subscriptionId,
                    product_name: productName,
                    refunded_amount: refundedAmount,
                    total_amount: totalAmount,
                    full_refund: isFullRefund,
                }, { throwOnError: true });
            }
        } catch (error) {
            console.error("Error processing order refunded webhook:", error);
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
            console.error("Error processing refund created webhook:", error);
            throw error;
        }
    },

    // A refund may be pending when refund.created arrives. Reprocess the
    // provider's final status so a later success cannot leave benefits active.
    onRefundUpdated: async (payload) => {
        try {
            await processRefund(payload.data, "Refund updated", "refund_updated");
        } catch (error) {
            console.error("Error processing refund updated webhook:", error);
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

                    const isAnnual = productName.toLowerCase().includes("annual");
                    const mergedMetadata = {
                        ...(subscription.product?.metadata || {}),
                        ...(subscription.metadata || {}),
                    } as Record<string, string | number | boolean>;

                    const rawCredits = getCreditsForProduct(productName, mergedMetadata);

                    // Determine planId
                    const planId = resolvePolarPlanId(productName, mergedMetadata);

                    // Billing cycle check
                    const billingCycle = isAnnual ? "annual" : "monthly";

                    // Check for profile-level credit override (for legacy plans like Nedra's $20/2300)
                    const profileOverride = user.monthly_credit_allowance;
                    // For Monthly Drip, annual renewals only get the monthly portion initially
                    const creditsToGrant = (profileOverride && profileOverride > 0)
                        ? profileOverride
                        : (isAnnual ? (MONTHLY_CREDITS_MAP[planId] || rawCredits) : rawCredits);

                    console.log(`Processing subscription update for ${customerEmail}:`, {
                        productName,
                        creditsToGrant,
                        storedSubscriptionId: user.subscription_id,
                        incomingSubscriptionId: subscription.id,
                        currentPeriodStart: subscription.currentPeriodStart,
                        currentPeriodEnd: subscription.currentPeriodEnd,
                    });

                    // Check if this is a renewal by comparing subscription_id OR if subscription_id is null (legacy)
                    const isMatchingSubscription = user.subscription_id === subscription.id || user.subscription_id === null;

                    // Detect renewal: check if current_period_start is after the last renewal
                    const currentPeriodStart = new Date(subscription.currentPeriodStart);
                    const lastRenewed = user.credits_last_renewed_at ? new Date(user.credits_last_renewed_at) : null;
                    const isRenewal = !lastRenewed || currentPeriodStart > lastRenewed;

                    if (creditsToGrant > 0 && isMatchingSubscription && isRenewal) {
                        // Subscription credits are a per-cycle allowance, not a
                        // rollover balance. Preserve only the ledgers that are
                        // explicitly persistent across cycles.
                        const persistentCredits =
                            (user.bonus_credits_remaining || 0)
                            + (user.purchased_credits_remaining || 0);
                        const newCredits = creditsToGrant + persistentCredits;

                        console.log(`✓ Renewal detected! Resetting plan allowance to ${creditsToGrant} credits (persistent ledgers: ${persistentCredits}, total: ${newCredits})`);

                        const { error: updateError } = await getSupabase()
                            .from("profiles")
                            .update({
                                credits_remaining: newCredits,
                                total_processed: 0,
                                subscription_status: "active",
                                subscription_id: subscription.id,
                                next_billing_date: subscription.currentPeriodEnd,
                                // Update metadata for drip
                                billing_cycle: billingCycle,
                                monthly_credit_allowance: billingCycle === "annual" ? (MONTHLY_CREDITS_MAP[planId] || null) : null,
                                credits_last_renewed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", userId);

                        if (updateError) {
                            throw updateError;
                        }

                        console.log(`✓ Renewed subscription credits for user ${userId}: +${creditsToGrant} credits (total: ${newCredits})`);

                        // Revenue is recorded by onOrderPaid from Polar's
                        // canonical order ID. This lifecycle event only
                        // updates access and credits; inserting a timestamped
                        // payment ID here would double-count renewals.
                } else {
                    console.log(`Skipping credit update: isMatchingSubscription=${isMatchingSubscription}, isRenewal=${isRenewal}, credits=${creditsToGrant}`);
                }
            }
        } catch (error) {
            console.error("Error processing subscription updated webhook:", error);
            throw error;
        }
    },
} satisfies Omit<Parameters<typeof Webhooks>[0], "webhookSecret">;

export const POST = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    ...polarWebhookHandlers,
});
