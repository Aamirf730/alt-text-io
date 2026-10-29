import { NextRequest, NextResponse } from "next/server";
import { getPolarServer } from "@/lib/polar-environment";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@supabase/supabase-js";
import { safeServerError } from "@/lib/safe-server-log";

/*
 * GET /api/customer-portal
 *
 * Opens the Polar customer portal for any signed-in user with a Polar
 * customer: subscribers, credit-pack buyers and former subscribers alike.
 * The customer is the profile's stored polar_customer_id or, failing that,
 * the Polar customer whose external ID is this user's ID (our checkout sets
 * it). The ID always comes from the session, never from the request.
 *
 * 200 { url } (JSON) or a redirect to the portal
 * 401 not signed in
 * 404 { error: "no_billing_account" } when the user has no Polar customer
 */

const getSupabaseClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

function isNotFound(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const record = error as { statusCode?: unknown; status?: unknown; error?: unknown; name?: unknown };
    return record.statusCode === 404
        || record.status === 404
        || record.error === "ResourceNotFound"
        || record.name === "ResourceNotFound";
}

const noBillingAccount = () => NextResponse.json(
    {
        error: "no_billing_account",
        message: "There is no billing account for this user yet. It is created with your first purchase.",
    },
    { status: 404 },
);

export async function GET(req: NextRequest) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN;

    if (!accessToken) {
        return NextResponse.json({ error: "Billing portal is not configured" }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

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
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        const polar = new Polar({
            accessToken,
            server: getPolarServer(),
        });

        let customerId = String(profile?.polar_customer_id || "").trim() || null;

        if (!customerId) {
            try {
                const customer = await polar.customers.getExternal({ externalId: user.id });
                customerId = customer?.id ? String(customer.id) : null;
            } catch (lookupError) {
                if (isNotFound(lookupError)) {
                    return noBillingAccount();
                }
                throw lookupError;
            }

            if (!customerId) {
                return noBillingAccount();
            }

            if (profile) {
                // Remember it so the next visit (and the webhook's customer
                // lookup) does not need the Polar round trip.
                const { error: saveError } = await supabase
                    .from("profiles")
                    .update({ polar_customer_id: customerId, updated_at: new Date().toISOString() })
                    .eq("id", user.id)
                    .is("polar_customer_id", null);
                if (saveError) {
                    console.warn("Could not store Polar customer ID:", safeServerError(saveError));
                }
            }
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
        let customerPortalUrl: string;
        try {
            ({ customerPortalUrl } = await polar.customerSessions.create({
                customerId,
                returnUrl: `${siteUrl}/dashboard`,
            }));
        } catch (sessionError) {
            if (isNotFound(sessionError)) {
                return noBillingAccount();
            }
            throw sessionError;
        }

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
