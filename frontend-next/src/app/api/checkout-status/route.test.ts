import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const state: {
        user: { id: string } | null;
        authError: Error | null;
        checkout: { status: string; metadata: Record<string, unknown> };
    } = {
        user: { id: "user_1" },
        authError: null,
        checkout: { status: "succeeded", metadata: { user_id: "user_1" } },
    };

    const client = {
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: state.user },
                error: state.authError,
            })),
        },
    };
    const getCheckout = vi.fn(async () => state.checkout);
    const Polar = vi.fn(() => ({ checkouts: { get: getCheckout } }));

    return { state, client, getCheckout, Polar };
});

vi.mock("@polar-sh/sdk", () => ({ Polar: mocks.Polar }));
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => mocks.client),
}));

import { GET } from "./route";

describe("checkout status verification", () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
        process.env.POLAR_ACCESS_TOKEN = "polar-test-token";
        process.env.POLAR_ENVIRONMENT = "sandbox";
        mocks.state.user = { id: "user_1" };
        mocks.state.authError = null;
        mocks.state.checkout = { status: "succeeded", metadata: { user_id: "user_1" } };
        vi.clearAllMocks();
    });

    it("requires an authenticated session", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/checkout-status?checkout_id=chk_123",
        ));

        expect(response.status).toBe(401);
        expect(mocks.getCheckout).not.toHaveBeenCalled();
    });

    it("returns the provider status for the checkout owner", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/checkout-status?checkout_id=chk_123",
            { headers: { Authorization: "Bearer verified-session" } },
        ));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: "succeeded" });
        expect(mocks.getCheckout).toHaveBeenCalledWith({ id: "chk_123" });
    });

    it("does not disclose a checkout owned by another account", async () => {
        mocks.state.checkout = { status: "succeeded", metadata: { user_id: "user_2" } };

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout-status?checkout_id=chk_123",
            { headers: { Authorization: "Bearer verified-session" } },
        ));

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: "Checkout not found" });
    });
});
