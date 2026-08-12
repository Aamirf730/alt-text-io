import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const state: {
        user: { id: string } | null;
        authError: Error | null;
        profile: { polar_customer_id: string | null } | null;
        profileError: Error | null;
    } = {
        user: { id: "user_1" },
        authError: null,
        profile: { polar_customer_id: "cus_1" },
        profileError: null,
    };

    const profileQuery = {
        select: vi.fn(() => profileQuery),
        eq: vi.fn(() => profileQuery),
        single: vi.fn(async () => ({
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
    const Polar = vi.fn(() => ({
        customerSessions: { create: createSession },
    }));

    return { state, client, profileQuery, createSession, Polar };
});

vi.mock("@polar-sh/sdk", () => ({ Polar: mocks.Polar }));
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => mocks.client),
}));

import { GET } from "./route";

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
        vi.clearAllMocks();
    });

    it("requires an authenticated session", async () => {
        const response = await GET(new NextRequest("http://localhost/api/customer-portal"));

        expect(response.status).toBe(401);
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("does not open a portal when the account has no provider customer", async () => {
        mocks.state.profile = { polar_customer_id: null };

        const response = await GET(new NextRequest(
            "http://localhost/api/customer-portal",
            { headers: { Authorization: "Bearer verified-session" } },
        ));

        expect(response.status).toBe(404);
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("creates a portal only for the customer ID loaded from the signed-in profile", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/customer-portal?customer_id=attacker&format=json",
            {
                headers: {
                    Authorization: "Bearer verified-session",
                    Accept: "application/json",
                },
            },
        ));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ url: "https://polar.sh/portal/session_1" });
        expect(mocks.profileQuery.eq).toHaveBeenCalledWith("id", "user_1");
        expect(mocks.createSession).toHaveBeenCalledWith({
            customerId: "cus_1",
            returnUrl: "https://www.alt-text.pro/dashboard",
        });
    });
});
