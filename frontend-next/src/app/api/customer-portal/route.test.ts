import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const state: {
        user: { id: string } | null;
        authError: Error | null;
        profile: { polar_customer_id: string | null } | null;
        profileError: Error | null;
        externalCustomer: { id: string } | null;
        externalError: unknown;
        profileUpdates: Array<Record<string, unknown>>;
    } = {
        user: { id: "user_1" },
        authError: null,
        profile: { polar_customer_id: "cus_1" },
        profileError: null,
        externalCustomer: null,
        externalError: null,
        profileUpdates: [],
    };

    const profileQuery = {
        select: vi.fn(() => profileQuery),
        eq: vi.fn(() => profileQuery),
        is: vi.fn(async () => ({ data: null, error: null })),
        update: vi.fn((values: Record<string, unknown>) => {
            state.profileUpdates.push(values);
            return profileQuery;
        }),
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
    const createSession = vi.fn(async () => ({
        customerPortalUrl: "https://polar.sh/portal/session_1",
    }));
    const getExternal = vi.fn(async () => {
        if (state.externalError) throw state.externalError;
        return state.externalCustomer;
    });
    const Polar = vi.fn(() => ({
        customerSessions: { create: createSession },
        customers: { getExternal },
    }));

    return { state, client, profileQuery, createSession, getExternal, Polar };
});

vi.mock("@polar-sh/sdk", () => ({ Polar: mocks.Polar }));
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => mocks.client),
}));

import { GET } from "./route";

const signedInRequest = (url = "http://localhost/api/customer-portal?format=json") => new NextRequest(url, {
    headers: {
        Authorization: "Bearer verified-session",
        Accept: "application/json",
    },
});

describe("customer portal identity binding", () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
        process.env.POLAR_ACCESS_TOKEN = "polar-test-token";
        process.env.POLAR_ENVIRONMENT = "sandbox";
        process.env.NEXT_PUBLIC_SITE_URL = "https://www.alt-text.pro";
        mocks.state.user = { id: "user_1" };
        mocks.state.authError = null;
        mocks.state.profile = { polar_customer_id: "cus_1" };
        mocks.state.profileError = null;
        mocks.state.externalCustomer = null;
        mocks.state.externalError = null;
        mocks.state.profileUpdates = [];
        vi.clearAllMocks();
    });

    it("requires an authenticated session", async () => {
        const response = await GET(new NextRequest("http://localhost/api/customer-portal"));

        expect(response.status).toBe(401);
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("returns no_billing_account when neither the profile nor Polar has a customer", async () => {
        mocks.state.profile = { polar_customer_id: null };
        mocks.state.externalError = Object.assign(new Error("Not found"), { statusCode: 404 });

        const response = await GET(signedInRequest());

        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ error: "no_billing_account" });
        expect(mocks.getExternal).toHaveBeenCalledWith({ externalId: "user_1" });
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("falls back to the Polar customer whose external ID is the signed-in user", async () => {
        mocks.state.profile = { polar_customer_id: null };
        mocks.state.externalCustomer = { id: "cus_external" };

        const response = await GET(signedInRequest());

        expect(response.status).toBe(200);
        expect(mocks.getExternal).toHaveBeenCalledWith({ externalId: "user_1" });
        expect(mocks.createSession).toHaveBeenCalledWith({
            customerId: "cus_external",
            returnUrl: "https://www.alt-text.pro/dashboard",
        });
        expect(mocks.state.profileUpdates[0]).toMatchObject({ polar_customer_id: "cus_external" });
    });

    it("returns no_billing_account when Polar no longer knows the stored customer", async () => {
        mocks.createSession.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 404 }));

        const response = await GET(signedInRequest());

        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ error: "no_billing_account" });
    });

    it("creates a portal only for the customer ID loaded from the signed-in profile", async () => {
        const response = await GET(signedInRequest(
            "http://localhost/api/customer-portal?customer_id=attacker&format=json",
        ));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ url: "https://polar.sh/portal/session_1" });
        expect(mocks.profileQuery.eq).toHaveBeenCalledWith("id", "user_1");
        expect(mocks.getExternal).not.toHaveBeenCalled();
        expect(mocks.createSession).toHaveBeenCalledWith({
            customerId: "cus_1",
            returnUrl: "https://www.alt-text.pro/dashboard",
        });
    });
});
