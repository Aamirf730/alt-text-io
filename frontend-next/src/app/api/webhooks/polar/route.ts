import { Webhooks } from "@polar-sh/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

// Helper to get credits from product name or metadata
function getCreditsForProduct(productName: string, metadata?: Record<string, string>): number {
    // First check metadata for explicit credits
    if (metadata?.credits) {
        return parseInt(metadata.credits, 10);
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
                polar_customer_id: userId.startsWith('cus_') ? userId : undefined, // userId might be customerId in some contexts, but let's be safe
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
        console.log("Order paid webhook received:", JSON.stringify(payload, null, 2));

        try {
            const order = payload.data;
            const customerEmail = order.customer?.email;

            if (!customerEmail) {
                console.error("No customer email in order");
                return;
            }

            // Get product details early to check if this is a subscription
            const productName = order.product?.name || "";

            // NEW: Normalize product name for reliable subscription check
            const normalizedProductName = productName.toLowerCase().replace(/\s+/g, "_");

            const isSubscription =
                normalizedProductName.includes('tier1') ||
                normalizedProductName.includes('tier2') ||
                normalizedProductName.includes('tier3') ||
                normalizedProductName.includes('tier_1') ||
                normalizedProductName.includes('tier_2') ||
                normalizedProductName.includes('tier_3') ||
                normalizedProductName.includes('monthly') ||
                normalizedProductName.includes('annual') ||
                order.product?.metadata?.type === 'subscription';

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
            const planId = productName.toLowerCase().includes("tier1") ? "tier1" :
                productName.toLowerCase().includes("tier2") ? "tier2" :
                    productName.toLowerCase().includes("tier3") ? "tier3" :
                        productName.toLowerCase().includes("small") ? "small_pack" :
                            productName.toLowerCase().includes("credit") ? "credit_pack" : "free";

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
                console.log(`⚠️ Skipping credit allocation in onOrderPaid for subscription "${productName}" (normalized: "${normalizedProductName}") - will be handled by onSubscriptionActive`);
                return;
            }

            // Only process one-time purchases (credit packs) from this point
            console.log(`✓ Processing one-time purchase: ${productName}`);

            const credits = getCreditsForProduct(productName, order.metadata as Record<string, string>);

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
        console.log("Subscription active webhook received:", JSON.stringify(payload, null, 2));

        try {
            const subscription = payload.data;
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

            const credits = getCreditsForProduct(productName, subscription.metadata as Record<string, string>);

            if (credits > 0) {
                await updateUserCredits(userId, credits, true);
                console.log(`✓ Set ${credits} credits for user ${userId} for subscription "${productName}"`);
            } else {
                console.warn(`No credits found for subscription product: ${productName}`);
            }

            // Update subscription plan in profile
            const planId = productName.toLowerCase().includes("tier1") ? "tier1" :
                productName.toLowerCase().includes("tier2") ? "tier2" :
                    productName.toLowerCase().includes("tier3") ? "tier3" : "free";

            await getSupabase()
                .from("profiles")
                .update({
                    subscription_plan: planId,
                    subscription_status: "active",
                    subscription_id: subscription.id,
                    polar_customer_id: subscription.customer?.id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

            console.log(`✓ Updated subscription plan to ${planId} for user ${userId}`);

        } catch (error) {
            console.error("Error processing subscription active webhook:", error);
        }
    },

    // Handle subscription cancellation
    onSubscriptionCanceled: async (payload) => {
        console.log("Subscription canceled webhook received:", JSON.stringify(payload, null, 2));

        try {
            const subscription = payload.data;
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

            // Update profile to reflect cancellation
            await getSupabase()
                .from("profiles")
                .update({
                    subscription_status: "cancelled",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

            console.log(`Subscription cancelled for user ${userId}`);
        } catch (error) {
            console.error("Error processing subscription canceled webhook:", error);
        }
    },

    // Handle subscription updates (renewals)
    onSubscriptionUpdated: async (payload) => {
        console.log("Subscription updated webhook received:", JSON.stringify(payload, null, 2));

        try {
            const subscription = payload.data;

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
                    .select("id, subscription_id, credits_remaining, credits_last_renewed_at")
                    .eq("email", customerEmail);

                if (users && users.length > 0) {
                    const user = users[0];
                    const userId = user.id;
                    const productName = subscription.product?.name || "";
                    const credits = getCreditsForProduct(productName);

                    console.log(`Processing subscription update for ${customerEmail}:`, {
                        productName,
                        credits,
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

                    if (credits > 0 && isMatchingSubscription && isRenewal) {
                        // Calculate new credits with rollover
                        const existingCredits = user.credits_remaining || 0;
                        const newCredits = credits + existingCredits;

                        console.log(`✓ Renewal detected! Adding ${credits} credits (rollover: ${existingCredits}, total: ${newCredits})`);

                        // Update credits with rollover support
                        const { error: updateError } = await getSupabase()
                            .from("profiles")
                            .update({
                                credits_remaining: newCredits,
                                subscription_status: "active",
                                subscription_id: subscription.id,
                                next_billing_date: subscription.currentPeriodEnd,
                                credits_last_renewed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", userId);

                        if (updateError) {
                            console.error("Error updating renewal credits:", updateError);
                        } else {
                            console.log(`✓ Renewed subscription credits for user ${userId}: +${credits} credits (total: ${newCredits})`);
                        }

                        // Record renewal payment
                        const planId = productName.toLowerCase().includes("tier1") ? "tier1" :
                            productName.toLowerCase().includes("tier2") ? "tier2" :
                                productName.toLowerCase().includes("tier3") ? "tier3" : "free";

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
                        console.log(`Skipping credit update: isMatchingSubscription=${isMatchingSubscription}, isRenewal=${isRenewal}, credits=${credits}`);
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
