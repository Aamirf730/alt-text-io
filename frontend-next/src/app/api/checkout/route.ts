import { NextRequest, NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@supabase/supabase-js";

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
            .select("polar_customer_id")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (!profile) {
            return NextResponse.json({ error: "Account profile is not ready" }, { status: 409 });
        }

        const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
        const environment = process.env.POLAR_ENVIRONMENT || "sandbox";
        const successUrl = process.env.NEXT_PUBLIC_SITE_URL
            ? `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success`
            : "https://www.alt-text.pro/payment-success";

        if (!polarAccessToken) {
            return NextResponse.json({ error: "POLAR_ACCESS_TOKEN not configured" }, { status: 500 });
        }

        if (process.env.NODE_ENV !== "production") {
            console.log("Checkout API called with product:", productId);
            console.log("Polar environment:", environment);
        }

        const polar = new Polar({
            accessToken: polarAccessToken,
            server: environment === "sandbox" ? "sandbox" : "production",
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
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: "Checkout failed. Please try again or contact support." },
            { status: 500 }
        );
    }
}
