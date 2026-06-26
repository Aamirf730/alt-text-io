import { NextRequest, NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get("products");
    const customerEmail = searchParams.get("customerEmail");

    if (!productId) {
        return NextResponse.json({ error: "No products specified" }, { status: 400 });
    }

    try {
        const accessToken = process.env.POLAR_ACCESS_TOKEN;
        const environment = process.env.POLAR_ENVIRONMENT || "sandbox";
        const successUrl = process.env.NEXT_PUBLIC_SITE_URL
            ? `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success`
            : "https://www.alt-text.pro/payment-success";

        if (!accessToken) {
            return NextResponse.json({ error: "POLAR_ACCESS_TOKEN not configured" }, { status: 500 });
        }

        if (process.env.NODE_ENV !== "production") {
            console.log("Checkout API called with product:", productId);
            console.log("Polar environment:", environment);
        }

        const polar = new Polar({
            accessToken,
            server: environment === "sandbox" ? "sandbox" : "production",
        });

        const checkout = await polar.checkouts.create({
            products: [productId],
            successUrl,
            customerEmail: customerEmail || undefined,
        });

        return NextResponse.redirect(checkout.url);
    } catch (error: unknown) {
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: "Checkout failed. Please try again or contact support." },
            { status: 500 }
        );
    }
}
