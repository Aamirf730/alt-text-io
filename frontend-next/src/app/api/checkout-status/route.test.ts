import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const state: {
        user: { id: string } | null;
        authError: Error | null;
        checkout: Record<string, unknown> & { status: string; metadata: Record<string, unknown> };
        profile: Record<string, unknown> | null;
        grants: Array<Record<string, unknown>>;
        queries: Array<{ table: string; filters: Array<[string, string, unknown]> }>;
    } = {
        user: { id: "user_1" },
        authError: null,
        checkout: { status: "succeeded", metadata: { user_id: "user_1" } },
        profile: null,
        grants: [],
        queries: [],
    };

    const createQuery = (table: string) => {
        const filters: Array<[string, string, unknown]> = [];
        state.queries.push({ table, filters });
        const query = {
            select: vi.fn(() => query),
            eq: vi.fn((field: string, value: unknown) => {
                filters.push(["eq", field, value]);
                return query;
            }),
            gte: vi.fn((field: string, value: unknown) => {
                filters.push(["gte", field, value]);
                return query;
            }),
            maybeSingle: vi.fn(async () => ({ data: state.profile, error: null })),
            limit: vi.fn(async () => ({ data: state.grants, error: null })),
        };
        return query;
    };

    const client = {
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: state.user },
                error: state.authError,
            })),
        },
        from: vi.fn((table: string) => createQuery(table)),
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
        mocks.state.profile = null;
        mocks.state.grants = [];
        mocks.state.queries = [];
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
        expect(await response.json()).toEqual({ status: "succeeded", account_updated: false });
        expect(mocks.getCheckout).toHaveBeenCalledWith({ id: "chk_123" });
    });

    it("does not check the account while Polar is still confirming", async () => {
        mocks.state.checkout = { status: "confirmed", metadata: { user_id: "user_1" } };

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout-status?checkout_id=chk_123",
            { headers: { Authorization: "Bearer verified-session" } },
        ));

        expect(await response.json()).toEqual({ status: "confirmed" });
        expect(mocks.state.queries).toHaveLength(0);
    });

    it("reports a subscription as applied once its ID is bound to the profile", async () => {
        mocks.state.checkout = {
            status: "succeeded",
            metadata: { user_id: "user_1" },
            subscriptionId: "sub_1",
            productId: "prod_growth",
        };
        mocks.state.profile = { subscription_id: "sub_1", polar_product_id: "prod_growth", subscription_plan: "tier2" };

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout-status?checkout_id=chk_123",
            { headers: { Authorization: "Bearer verified-session" } },
        ));

        expect(await response.json()).toEqual({ status: "succeeded", account_updated: true });
        expect(mocks.state.queries[0]).toMatchObject({
            table: "profiles",
            filters: [["eq", "id", "user_1"]],
        });
    });

    it("reports a credit pack as applied once a grant newer than the checkout exists", async () => {
        mocks.state.checkout = {
            status: "succeeded",
            metadata: { user_id: "user_1" },
            subscriptionId: null,
            productId: "prod_pack",
            createdAt: new Date("2026-10-29T10:00:00.000Z"),
            product: { isRecurring: false },
        };
        mocks.state.grants = [{ payment_id: "polar_ord_1" }];

        const response = await GET(new NextRequest(
            "http://localhost/api/checkout-status?checkout_id=chk_123",
            { headers: { Authorization: "Bearer verified-session" } },
        ));

        expect(await response.json()).toEqual({ status: "succeeded", account_updated: true });
        expect(mocks.state.queries[0]).toMatchObject({
            table: "credit_pack_grants",
            filters: [
                ["eq", "user_id", "user_1"],
                ["gte", "created_at", "2026-10-29T10:00:00.000Z"],
            ],
        });
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
