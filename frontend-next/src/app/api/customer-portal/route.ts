import { CustomerPortal } from "@polar-sh/nextjs";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper to get Supabase client (lazy initialization)
const getSupabaseClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export const GET = CustomerPortal({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    getCustomerId: async (req: NextRequest) => {
        // Get user from Authorization header or cookie
        const authHeader = req.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");

        if (!token) {
            // Try to get from URL params as fallback
            const customerId = req.nextUrl.searchParams.get("customerId");
            return customerId || "";
        }

        try {
            const supabase = getSupabaseClient();

            // Verify user and get their Polar customer ID
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                console.error("Error getting user:", error);
                return "";
            }

            // Get user's Polar customer ID from profile
            const { data: profile } = await supabase
                .from("profiles")
                .select("polar_customer_id")
                .eq("id", user.id)
                .single();

            return profile?.polar_customer_id || "";
        } catch (error) {
            console.error("Error in getCustomerId:", error);
            return "";
        }
    },
    server: process.env.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
});
