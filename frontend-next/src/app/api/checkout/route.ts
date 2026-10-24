import { NextRequest, NextResponse } from "next/server";
import { getPolarServer } from "@/lib/polar-environment";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@supabase/supabase-js";
import { getConfiguredPolarProductIds, getCreditPackProductIds } from "@/lib/polar-products";
import { isCreditPackEligible } from "@/lib/credit-pack-eligibility";
import {
    hasLivePaidSubscription,
    SUBSCRIPTION_EXISTS_CODE,
    SUBSCRIPTION_EXISTS_MESSAGE,
} from "@/lib/subscription-status";
import { safeServerError } from "@/lib/safe-server-log";

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get("products");

    if (!productId) {
        return NextResponse.json({ error: "No products specified" }, { status: 400 });
    }

    const configuredProductIds = getConfiguredPolarProductIds();
    const creditPackProductIds = getCreditPackProductIds();

    if (configuredProductIds.size === 0) {
        return NextResponse.json({ error: "Checkout products are not configured" }, { status: 503 });
    }

    if (!configuredProductIds.has(productId)) {
        return NextResponse.json({ error: "Unknown checkout product" }, { status: 400 });
    }

    try {
        const authHeader = request.headers.get("authorization");
        const sessionToken = authHeader?.replace(/^Bearer\s+/i, "").trim();

        if (!sessionToken) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const supabase = getSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken);

        if (authError || !user) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const customerEmail = user.email?.trim().toLowerCase();

        if (!customerEmail) {
            return NextResponse.json({ error: "Authenticated account has no email" }, { status: 400 });
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("polar_customer_id, subscription_plan, subscription_status, billing_cycle")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (!profile) {
            return NextResponse.json({ error: "Account profile is not ready" }, { status: 409 });
        }

        // Plan changes for an existing subscriber go through the Polar
        // customer portal. A second checkout would start a parallel
        // subscription while the old one keeps billing.
        if (!creditPackProductIds.has(productId) && hasLivePaidSubscription(profile)) {
            return NextResponse.json(
                { error: SUBSCRIPTION_EXISTS_MESSAGE, code: SUBSCRIPTION_EXISTS_CODE },
                { status: 409 },
            );
        }

        if (
            creditPackProductIds.has(productId) &&
            !isCreditPackEligible(profile)
        ) {
            return NextResponse.json(
                { error: "This account cannot buy credit packs right now. Please contact support." },
                { status: 403 },
            );
        }

        const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.alt-text.pro").replace(/\/$/, "");
        const successUrl = `${siteUrl}/payment-success?checkout_id={CHECKOUT_ID}`;

        if (!polarAccessToken) {
            return NextResponse.json({ error: "POLAR_ACCESS_TOKEN not configured" }, { status: 500 });
        }

        const polar = new Polar({
            accessToken: polarAccessToken,
            server: getPolarServer(),
        });

        const checkout = await polar.checkouts.create({
            products: [productId],
            successUrl,
            customerEmail,
            metadata: {
                user_id: user.id,
            },
            ...(profile.polar_customer_id
                ? { customerId: profile.polar_customer_id }
                : { externalCustomerId: user.id }),
        });

        const wantsJson =
            searchParams.get("format") === "json" ||
            request.headers.get("accept")?.includes("application/json");

        if (wantsJson) {
            return NextResponse.json({ url: checkout.url });
        }

        return NextResponse.redirect(checkout.url);
    } catch (error: unknown) {
        console.error("Checkout error:", safeServerError(error));
        return NextResponse.json(
            { error: "Checkout failed. Please try again or contact support." },
            { status: 500 }
        );
    }
}
