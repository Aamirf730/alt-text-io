import { Webhooks } from "@polar-sh/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

async function recordMarketingEvent(
    eventName: string,
    userId: string,
    userEmail: string | null,
    properties: Record<string, string | number | boolean | null | undefined>
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

    if (error) {
        console.warn(`Could not record marketing event ${eventName}:`, error.message);
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
async function updateUserCredits(userId: string, credits: number, isSubscription: boolean) {
    console.log(`Updating credits for user ${userId}: +${credits} credits, isSubscription: ${isSubscription}`);

    if (isSubscription) {
        // For subscriptions, reset credits to subscription amount
        const { error } = await getSupabase()
            .from("profiles")
            .update({
                credits_remaining: credits,
                subscription_status: "active",
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) {
            console.error("Error updating subscription credits:", error);
            throw error;
        }
    } else {
        // For one-time purchases, add credits to existing
        const { data: profile, error: fetchError } = await getSupabase()
            .from("profiles")
            .select("credits_remaining")
            .eq("id", userId)
            .single();

        if (fetchError) {
            console.error("Error fetching profile:", fetchError);
            throw fetchError;
        }

        const newCredits = (profile?.credits_remaining || 0) + credits;

        const { error } = await getSupabase()
            .from("profiles")
            .update({
                credits_remaining: newCredits,
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) {
            console.error("Error updating one-time credits:", error);
            throw error;
        }
    }

    console.log(`Successfully updated credits for user ${userId}`);
}

export const POST = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

    // Handle successful order payment (one-time purchases ONLY)
    // Note: Subscriptions are handled by onSubscriptionActive to prevent double allocation
    onOrderPaid: async (payload) => {
        try {
            const order = payload.data;
            logWebhookReceived("Order paid", order);
            const customerEmail = order.customer?.email;

            if (!customerEmail) {
                console.error("No customer email in order");
                return;
            }

            // Get product details early to check if this is a subscription
            const productName = order.product?.name || "";

            const mergedMetadata = {
                ...(order.product?.metadata || {}),
                ...(order.metadata || {}),
            } as Record<string, string | number | boolean>;

            const isSubscription = isPolarSubscriptionProduct(productName, mergedMetadata);

            // Find user by email
            const { data: users, error: userError } = await getSupabase()
                .from("profiles")
                .select("id")
                .eq("email", customerEmail);

            // If no profile with email, try auth.users
            let userId: string | null = null;
            if (!users || users.length === 0) {
                const { data: authData } = await getSupabase().auth.admin.listUsers();
                const authUser = authData?.users.find(u => u.email === customerEmail);
                userId = authUser?.id || null;
            } else {
                userId = users[0].id;
            }

            if (!userId) {
                console.error(`No user found for email: ${customerEmail}`);
                return;
            }

            // RECORD PAYMENT: Ensure every payment is recorded for admin dashboard stats
            // Polar amount is in cents
            const anyOrder = order as any;
            const paymentAmount = (anyOrder.amount || 0) / 100;
            const currency = anyOrder.currency?.toUpperCase() || "USD";
            const planId = resolvePolarPlanId(productName, mergedMetadata);

            const { error: paymentError } = await getSupabase()
                .from("payments")
                .insert({
                    user_id: userId,
                    payment_id: `polar_ord_${order.id}`,
                    subscription_id: anyOrder.subscription_id || anyOrder.subscriptionId || null,
                    plan_id: planId,
                    amount: paymentAmount,
                    currency: currency,
                    status: "completed",
                    payment_method: "polar",
                    created_at: new Date().toISOString(),
                });

            if (paymentError) {
                console.error(`Error recording payment for user ${userId}:`, paymentError);
            } else {
                console.log(`✓ Recorded payment of ${currency} ${paymentAmount} for user ${userId} (Order ID: ${order.id})`);
            }

            await recordMarketingEvent("purchase_completed", userId, customerEmail, {
                provider: "polar",
                product_name: productName,
                plan_id: planId,
                amount: paymentAmount,
                currency,
                order_id: order.id,
                is_subscription: isSubscription,
            });

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

            // Only process one-time purchases (credit packs) from this point
            console.log(`✓ Processing one-time purchase: ${productName}`);

            // Prefer product metadata (configured in Polar catalog), allow order metadata to override.
            const credits = getCreditsForProduct(productName, mergedMetadata);

            if (credits > 0) {
                await updateUserCredits(userId, credits, false);
                console.log(`✓ Added ${credits} credits to user ${userId} for one-time purchase "${productName}"`);
            } else {
                console.warn(`No credits found for product: ${productName}`);
            }
        } catch (error) {
            console.error("Error processing order paid webhook:", error);
        }
    },

    // Handle subscription activation
    onSubscriptionActive: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription active", subscription);
            const customerEmail = subscription.customer?.email;

            if (!customerEmail) {
                console.error("No customer email in subscription");
                return;
            }

            // Get product details early for logging
            const productName = subscription.product?.name || "";
            console.log(`✓ Processing subscription activation: ${productName} for ${customerEmail}`);

            // Find user by email
            const { data: users } = await getSupabase()
                .from("profiles")
                .select("id")
                .eq("email", customerEmail);

            let userId: string | null = null;
            if (!users || users.length === 0) {
                const { data: authData } = await getSupabase().auth.admin.listUsers();
                const authUser = authData?.users.find(u => u.email === customerEmail);
                userId = authUser?.id || null;
            } else {
                userId = users[0].id;
            }

            if (!userId) {
                console.error(`No user found for email: ${customerEmail}`);
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
                    credits_last_renewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

            console.log(`✓ Configured profile for ${planId} (${billingCycle}) for user ${userId}`);

        } catch (error) {
            console.error("Error processing subscription active webhook:", error);
        }
    },

    // Handle subscription cancellation
    onSubscriptionCanceled: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription canceled", subscription);
            const customerEmail = subscription.customer?.email;

            if (!customerEmail) {
                console.error("No customer email in subscription");
                return;
            }

            // Find user by email
            const { data: users } = await getSupabase()
                .from("profiles")
                .select("id")
                .eq("email", customerEmail);

            let userId: string | null = null;
            if (!users || users.length === 0) {
                const { data: authData } = await getSupabase().auth.admin.listUsers();
                const authUser = authData?.users.find(u => u.email === customerEmail);
                userId = authUser?.id || null;
            } else {
                userId = users[0].id;
            }

            if (!userId) {
                console.error(`No user found for email: ${customerEmail}`);
                return;
            }

            // Update profile to reflect cancellation and stop monthly drip
            await getSupabase()
                .from("profiles")
                .update({
                    subscription_status: "cancelled",
                    billing_cycle: null,
                    monthly_credit_allowance: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

            await recordMarketingEvent("subscription_canceled", userId, customerEmail, {
                provider: "polar",
                subscription_id: subscription.id,
                product_name: subscription.product?.name || "",
            });

            console.log(`Subscription cancelled for user ${userId}`);
        } catch (error) {
            console.error("Error processing subscription canceled webhook:", error);
        }
    },

    // Handle subscription updates (renewals)
    onSubscriptionUpdated: async (payload) => {
        try {
            const subscription = payload.data;
            logWebhookReceived("Subscription updated", subscription);

            // Check if this is a renewal (status is active and we have current period info)
            if (subscription.status === "active") {
                const customerEmail = subscription.customer?.email;

                if (!customerEmail) {
                    console.warn("No customer email in subscription update");
                    return;
                }

                // Find user - use subscription_id (not polar_subscription_id which doesn't exist)
                const { data: users } = await getSupabase()
                    .from("profiles")
                    .select("id, subscription_id, credits_remaining, credits_last_renewed_at, monthly_credit_allowance")
                    .eq("email", customerEmail);

                if (users && users.length > 0) {
                    const user = users[0];
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
                        // Calculate new credits with rollover
                        const existingCredits = user.credits_remaining || 0;
                        const newCredits = creditsToGrant + existingCredits;

                        console.log(`✓ Renewal detected! Adding ${creditsToGrant} credits (rollover: ${existingCredits}, total: ${newCredits})`);

                        // Update credits with rollover support
                        const { error: updateError } = await getSupabase()
                            .from("profiles")
                            .update({
                                credits_remaining: newCredits,
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
                            console.error("Error updating renewal credits:", updateError);
                        } else {
                            console.log(`✓ Renewed subscription credits for user ${userId}: +${creditsToGrant} credits (total: ${newCredits})`);
                        }

                        // Record renewal payment
                        const anySubscription = subscription as any;
                        const amount = (anySubscription.amount || 0) / 100;

                        await getSupabase()
                            .from("payments")
                            .insert({
                                user_id: userId,
                                payment_id: `polar_renewal_${subscription.id}_${Date.now()}`,
                                subscription_id: subscription.id,
                                plan_id: planId,
                                amount: amount,
                                currency: anySubscription.currency?.toUpperCase() || "USD",
                                status: "completed",
                                payment_method: "polar",
                                created_at: new Date().toISOString(),
                            });

                        console.log(`✓ Recorded renewal payment for ${planId}`);
                    } else {
                        console.log(`Skipping credit update: isMatchingSubscription=${isMatchingSubscription}, isRenewal=${isRenewal}, credits=${creditsToGrant}`);
                    }
                } else {
                    console.warn(`No user found for email: ${customerEmail}`);
                }
            }
        } catch (error) {
            console.error("Error processing subscription updated webhook:", error);
        }
    },
});
