import { NextRequest, NextResponse } from "next/server";
import { getPolarServer } from "@/lib/polar-environment";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@supabase/supabase-js";
import { safeServerError } from "@/lib/safe-server-log";

/*
 * GET /api/checkout-status?checkout_id=...
 *
 * 200 { status, account_updated? }
 *   status: Polar's checkout status, for the checkout owner only.
 *   account_updated: present once status is "succeeded". True when our
 *   webhook has applied the purchase to the signed-in account (the
 *   subscription is bound to the profile, or a credit pack was granted after
 *   this checkout started). /payment-success polls until it is true.
 */
const CHECKOUT_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const SAFE_STATUSES = new Set(["open", "expired", "confirmed", "succeeded", "failed"]);

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

type CheckoutForFulfillment = {
    createdAt?: Date | string | null;
    productId?: string | null;
    subscriptionId?: string | null;
    product?: { isRecurring?: boolean | null } | null;
};

/**
 * Whether the webhook has already applied this checkout to the account.
 * A subscription is applied once subscription.active binds its ID (or, before
 * Polar attaches the ID to the checkout, the same product) to the profile. A
 * pack is applied once a credit-pack grant exists that was created after the
 * checkout started.
 */
async function isPurchaseApplied(
    supabase: ReturnType<typeof getSupabaseClient>,
    userId: string,
    checkout: CheckoutForFulfillment,
): Promise<boolean> {
    const subscriptionId = checkout.subscriptionId ? String(checkout.subscriptionId) : null;
    const isSubscription = Boolean(subscriptionId) || Boolean(checkout.product?.isRecurring);

    if (isSubscription) {
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("subscription_id, polar_product_id, subscription_plan")
            .eq("id", userId)
            .maybeSingle();

        if (error || !profile) return false;
        if (subscriptionId) return profile.subscription_id === subscriptionId;
        return Boolean(
            checkout.productId
            && profile.polar_product_id === checkout.productId
            && profile.subscription_plan !== "free",
        );
    }

    const createdAt = checkout.createdAt ? new Date(checkout.createdAt) : null;
    let query = supabase
        .from("credit_pack_grants")
        .select("payment_id")
        .eq("user_id", userId);
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
        query = query.gte("created_at", createdAt.toISOString());
    }
    const { data: grants, error } = await query.limit(1);

    if (error) return false;
    return Array.isArray(grants) && grants.length > 0;
}

export async function GET(request: NextRequest) {
    const checkoutId = request.nextUrl.searchParams.get("checkout_id")?.trim();

    if (!checkoutId || !CHECKOUT_ID_PATTERN.test(checkoutId)) {
        return NextResponse.json({ error: "A valid checkout ID is required" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    const sessionToken = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!sessionToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const supabase = getSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken);

        if (authError || !user) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;

        if (!polarAccessToken) {
            return NextResponse.json({ error: "Checkout verification is not configured" }, { status: 500 });
        }

        const polar = new Polar({
            accessToken: polarAccessToken,
            server: getPolarServer(),
        });
        const checkout = await polar.checkouts.get({ id: checkoutId });
        const checkoutUserId = String(checkout.metadata?.user_id || "");

        if (!checkoutUserId || checkoutUserId !== user.id) {
            return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
        }

        if (!SAFE_STATUSES.has(checkout.status)) {
            return NextResponse.json({ error: "Checkout status is unavailable" }, { status: 502 });
        }

        if (checkout.status !== "succeeded") {
            return NextResponse.json({ status: checkout.status });
        }

        const accountUpdated = await isPurchaseApplied(supabase, user.id, checkout);
        return NextResponse.json({ status: checkout.status, account_updated: accountUpdated });
    } catch (error: unknown) {
        console.error(
            "Checkout verification error:",
            safeServerError(error),
        );
        return NextResponse.json(
            { error: "Could not verify this checkout. Please try again." },
            { status: 502 },
        );
    }
}
