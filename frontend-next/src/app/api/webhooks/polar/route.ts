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
const CREDITS_MAP: Record<string, number> = {
    // Monthly subscriptions
    tier1_monthly: 1000,
    tier2_monthly: 2300,
    tier3_monthly: 3500,
    // Annual subscriptions (total for year)
    tier1_annual: 12000,
    tier2_annual: 27600,
    tier3_annual: 42000,
    // One-time purchases
    small_pack: 350,
    credit_pack: 550,
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
    if (normalizedName.includes("tier1") || normalizedName.includes("tier_1")) {
        return normalizedName.includes("annual") ? 12000 : 1000;
    }
    if (normalizedName.includes("tier2") || normalizedName.includes("tier_2")) {
        return normalizedName.includes("annual") ? 27600 : 2300;
    }
    if (normalizedName.includes("tier3") || normalizedName.includes("tier_3")) {
        return normalizedName.includes("annual") ? 42000 : 3500;
    }
    if (normalizedName.includes("small")) {
        return 350;
    }
    if (normalizedName.includes("credit") || normalizedName.includes("pack")) {
        return 550;
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

            // Check if this is a subscription purchase
            // Subscriptions should ONLY be handled by onSubscriptionActive to prevent double allocation
            const isSubscription =
                productName.toLowerCase().includes('tier1') ||
                productName.toLowerCase().includes('tier2') ||
                productName.toLowerCase().includes('tier3') ||
                productName.toLowerCase().includes('tier_1') ||
                productName.toLowerCase().includes('tier_2') ||
                productName.toLowerCase().includes('tier_3') ||
                productName.toLowerCase().includes('monthly') ||
                productName.toLowerCase().includes('annual') ||
                order.product?.metadata?.type === 'subscription';

            if (isSubscription) {
                console.log(`⚠️ Skipping onOrderPaid for subscription "${productName}" - will be handled by onSubscriptionActive to prevent double allocation`);
                return;
            }

            // Only process one-time purchases (credit packs) from this point
            console.log(`✓ Processing one-time purchase: ${productName}`);

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
                    polar_subscription_id: subscription.id,
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
                    return;
                }

                // Find user
                const { data: users } = await getSupabase()
                    .from("profiles")
                    .select("id, polar_subscription_id")
                    .eq("email", customerEmail);

                if (users && users.length > 0) {
                    const userId = users[0].id;
                    const productName = subscription.product?.name || "";
                    const credits = getCreditsForProduct(productName);

                    // Only reset credits if this looks like a renewal
                    if (credits > 0 && users[0].polar_subscription_id === subscription.id) {
                        await updateUserCredits(userId, credits, true);
                        console.log(`Renewed subscription credits for user ${userId}: ${credits} credits`);
                    }
                }
            }
        } catch (error) {
            console.error("Error processing subscription updated webhook:", error);
        }
    },
});
