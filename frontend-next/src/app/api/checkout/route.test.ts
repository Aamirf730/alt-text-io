import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const state: {
        user: { id: string; email: string | null } | null;
        authError: Error | null;
        profile: {
            polar_customer_id: string | null;
            subscription_plan?: string;
            subscription_status?: string;
            billing_cycle?: string | null;
        } | null;
        profileError: Error | null;
        checkoutArgs: Record<string, unknown> | null;
    } = {
        user: { id: "user_1", email: "Verified@Example.com" },
        authError: null,
        profile: {
            polar_customer_id: null,
            subscription_plan: "tier1",
            subscription_status: "active",
            billing_cycle: "monthly",
        },
        profileError: null,
        checkoutArgs: null,
    };

    const profileQuery = {
        select: vi.fn(() => profileQuery),
        eq: vi.fn(() => profileQuery),
        maybeSingle: vi.fn(async () => ({
            data: state.profile,
            error: state.profileError,
        })),
    };

    const client = {
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: state.user },
                error: state.authError,
            })),
        },
        from: vi.fn(() => profileQuery),
    };

    const createCheckout = vi.fn(async (args: Record<string, unknown>) => {
        state.checkoutArgs = args;
        return { url: "https://sandbox.polar.sh/checkout/chk_1" };
    });

    const Polar = vi.fn(() => ({
        checkouts: { create: createCheckout },
    }));

    return { state, client, createCheckout, Polar };
});

vi.mock("@polar-sh/sdk", () => ({ Polar: mocks.Polar }));
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => mocks.client),
}));

import { GET } from "./route";

describe("checkout identity binding", () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
        process.env.POLAR_ACCESS_TOKEN = "polar-test-token";
        process.env.POLAR_ENVIRONMENT = "sandbox";
        process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
        process.env.NEXT_PUBLIC_POLAR_TIER1_MONTHLY = "prod_1";
        process.env.NEXT_PUBLIC_POLAR_SMALL_PACK = "prod_small";
        process.env.NEXT_PUBLIC_POLAR_CREDIT_PACK = "prod_large";
        process.env.NEXT_PUBLIC_POLAR_BULK_PACK = "prod_bulk";
        process.env.NEXT_PUBLIC_POLAR_LEGACY_TIER3_MONTHLY = "prod_legacy_pro";
        delete process.env.NEXT_PUBLIC_POLAR_TIER3_MONTHLY;
        mocks.state.user = { id: "user_1", email: "Verified@Example.com" };
        mocks.state.authError = null;
        mocks.state.profile = {
            polar_customer_id: null,
            subscription_plan: "tier1",
            subscription_status: "active",
            billing_cycle: "monthly",
        };
        mocks.state.profileError = null;
        mocks.state.checkoutArgs = null;
        vi.clearAllMocks();
    });

    it("requires a bearer session before creating a Polar checkout", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=prod_1",
        ));

        expect(response.status).toBe(401);
        expect(mocks.createCheckout).not.toHaveBeenCalled();
    });

    it("rejects an invalid session", async () => {
        mocks.state.user = null;
        mocks.state.authError = new Error("invalid token");

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=prod_1",
            { headers: { Authorization: "Bearer invalid-token" } },
        ));

        expect(response.status).toBe(401);
        expect(mocks.createCheckout).not.toHaveBeenCalled();
    });

    it("rejects product IDs that are not configured by the application", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=attacker_product",
            { headers: { Authorization: "Bearer verified-session-token" } },
        ));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "Unknown checkout product" });
        expect(mocks.createCheckout).not.toHaveBeenCalled();
    });

    it("binds checkout metadata and customer identity to the authenticated account", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=prod_1&customerEmail=attacker@example.com&format=json",
            {
                headers: {
                    Authorization: "Bearer verified-session-token",
                    Accept: "application/json",
                },
            },
        ));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ url: "https://sandbox.polar.sh/checkout/chk_1" });
        expect(mocks.createCheckout).toHaveBeenCalledOnce();
        expect(mocks.state.checkoutArgs).toMatchObject({
            products: ["prod_1"],
            successUrl: "http://localhost:3000/payment-success?checkout_id={CHECKOUT_ID}",
            customerEmail: "verified@example.com",
            externalCustomerId: "user_1",
            metadata: { user_id: "user_1" },
        });
        expect(mocks.state.checkoutArgs).not.toHaveProperty("customerEmail", "attacker@example.com");
    });

    it("rejects legacy products that are no longer on sale", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=prod_legacy_pro&format=json",
            { headers: { Authorization: "Bearer verified-session-token" } },
        ));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "Unknown checkout product" });
        expect(mocks.createCheckout).not.toHaveBeenCalled();
    });

    it.each(["prod_small", "prod_large", "prod_bulk"])(
        "allows an eligible monthly subscriber to buy %s",
        async (productId) => {
            const response = await GET(new NextRequest(
                `http://localhost/api/checkout?products=${productId}&format=json`,
                {
                    headers: {
                        Authorization: "Bearer verified-session-token",
                        Accept: "application/json",
                    },
                },
            ));

            expect(response.status).toBe(200);
            expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
                products: [productId],
            }));
        },
    );

    it("allows a free account to buy a credit pack", async () => {
        mocks.state.profile = {
            polar_customer_id: null,
            subscription_plan: "free",
            subscription_status: "active",
            billing_cycle: null,
        };

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=prod_bulk&format=json",
            { headers: { Authorization: "Bearer verified-session-token" } },
        ));

        expect(response.status).toBe(200);
        expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
            products: ["prod_bulk"],
        }));
    });

    it("rejects a revoked account attempting to buy a credit pack", async () => {
        mocks.state.profile = {
            polar_customer_id: null,
            subscription_plan: "tier2",
            subscription_status: "revoked",
            billing_cycle: "monthly",
        };

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=prod_small&format=json",
            { headers: { Authorization: "Bearer verified-session-token" } },
        ));

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
            error: "This account cannot buy credit packs right now. Please contact support.",
        });
        expect(mocks.createCheckout).not.toHaveBeenCalled();
    });

    it("allows an eligible annual subscriber to buy a credit pack", async () => {
        mocks.state.profile = {
            polar_customer_id: null,
            subscription_plan: "tier2",
            subscription_status: "active",
            billing_cycle: "annual",
        };

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout?products=prod_large&format=json",
            { headers: { Authorization: "Bearer verified-session-token" } },
        ));

        expect(response.status).toBe(200);
        expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
            products: ["prod_large"],
        }));
    });
});
