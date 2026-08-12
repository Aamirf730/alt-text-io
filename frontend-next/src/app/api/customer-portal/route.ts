import { NextRequest, NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@supabase/supabase-js";
import { safeServerError } from "@/lib/safe-server-log";

const getSupabaseClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function GET(req: NextRequest) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN;

    if (!accessToken) {
        return NextResponse.json({ error: "Billing portal is not configured" }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const supabase = getSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("polar_customer_id")
            .eq("id", user.id)
            .single();

        if (profileError || !profile?.polar_customer_id) {
            return NextResponse.json({ error: "No billing customer found for this account" }, { status: 404 });
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
        const polar = new Polar({
            accessToken,
            server: process.env.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
        });

        const { customerPortalUrl } = await polar.customerSessions.create({
            customerId: profile.polar_customer_id,
            returnUrl: `${siteUrl}/dashboard`,
        });

        const wantsJson =
            req.nextUrl.searchParams.get("format") === "json" ||
            req.headers.get("accept")?.includes("application/json");

        if (wantsJson) {
            return NextResponse.json({ url: customerPortalUrl });
        }

        return NextResponse.redirect(customerPortalUrl);
    } catch (error) {
        console.error("Customer portal error:", safeServerError(error));
        return NextResponse.json({ error: "Unable to open billing portal" }, { status: 500 });
    }
}
