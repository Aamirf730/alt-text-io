import { NextRequest, NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@supabase/supabase-js";
import { safeServerError } from "@/lib/safe-server-log";

const CHECKOUT_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const SAFE_STATUSES = new Set(["open", "expired", "confirmed", "succeeded", "failed"]);

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
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
        const environment = process.env.POLAR_ENVIRONMENT || "sandbox";

        if (!polarAccessToken) {
            return NextResponse.json({ error: "Checkout verification is not configured" }, { status: 500 });
        }

        const polar = new Polar({
            accessToken: polarAccessToken,
            server: environment === "sandbox" ? "sandbox" : "production",
        });
        const checkout = await polar.checkouts.get({ id: checkoutId });
        const checkoutUserId = String(checkout.metadata?.user_id || "");

        if (!checkoutUserId || checkoutUserId !== user.id) {
            return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
        }

        if (!SAFE_STATUSES.has(checkout.status)) {
            return NextResponse.json({ error: "Checkout status is unavailable" }, { status: 502 });
        }

        return NextResponse.json({ status: checkout.status });
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
