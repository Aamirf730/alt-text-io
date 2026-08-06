import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const state: {
        user: { id: string; email: string | null } | null;
        authError: Error | null;
        profile: { polar_customer_id: string | null } | null;
        profileError: Error | null;
        checkoutArgs: Record<string, unknown> | null;
    } = {
        user: { id: "user_1", email: "Verified@Example.com" },
        authError: null,
        profile: { polar_customer_id: null },
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
        mocks.state.user = { id: "user_1", email: "Verified@Example.com" };
        mocks.state.authError = null;
        mocks.state.profile = { polar_customer_id: null };
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
            customerEmail: "verified@example.com",
            externalCustomerId: "user_1",
            metadata: { user_id: "user_1" },
        });
        expect(mocks.state.checkoutArgs).not.toHaveProperty("customerEmail", "attacker@example.com");
    });
});
