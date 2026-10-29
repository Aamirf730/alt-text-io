import { NextRequest, NextResponse } from "next/server";
import { getPolarServer } from "@/lib/polar-environment";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@supabase/supabase-js";
import { safeServerError } from "@/lib/safe-server-log";

/*
 * POST /api/account/sync-email
 *
 * After someone changes their sign-in email, the profile and the Polar
 * customer still hold the old address, so receipts would keep going there.
 * The dashboard calls this once per session: when the profile email differs
 * from the signed-in email, the Polar customer is updated first and the
 * profile second, so a failed Polar update is retried on the next visit.
 *
 * 200 { synced: boolean, polar_updated: boolean }
 * 401 not signed in
 */

const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();

export async function POST(req: NextRequest) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const supabase = getSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const signedInEmail = normalizeEmail(user.email);
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email, polar_customer_id")
            .eq("id", user.id)
            .maybeSingle();
        if (profileError) throw profileError;

        if (!signedInEmail || !profile || normalizeEmail(profile.email) === signedInEmail) {
            return NextResponse.json({ synced: false, polar_updated: false });
        }

        let polarUpdated = false;
        if (profile.polar_customer_id) {
            const accessToken = process.env.POLAR_ACCESS_TOKEN;
            if (!accessToken) {
                return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
            }
            const polar = new Polar({ accessToken, server: getPolarServer() });
            await polar.customers.update({
                id: profile.polar_customer_id,
                customerUpdate: { email: signedInEmail },
            });
            polarUpdated = true;
        }

        const { error: updateError } = await supabase
            .from("profiles")
            .update({ email: signedInEmail, updated_at: new Date().toISOString() })
            .eq("id", user.id);
        if (updateError) throw updateError;

        return NextResponse.json({ synced: true, polar_updated: polarUpdated });
    } catch (error: unknown) {
        console.error("Email sync error:", safeServerError(error));
        return NextResponse.json({ error: "Could not update your billing email. Please try again later." }, { status: 500 });
    }
}
