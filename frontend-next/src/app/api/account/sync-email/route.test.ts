import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const state: {
        user: { id: string; email: string } | null;
        profile: { email: string | null; polar_customer_id: string | null } | null;
        profileUpdates: Array<Record<string, unknown>>;
        polarError: Error | null;
    } = {
        user: { id: "user_1", email: "New@Example.com" },
        profile: { email: "old@example.com", polar_customer_id: "cus_1" },
        profileUpdates: [],
        polarError: null,
    };

    const profileQuery = {
        select: vi.fn(() => profileQuery),
        eq: vi.fn(() => profileQuery),
        update: vi.fn((values: Record<string, unknown>) => {
            state.profileUpdates.push(values);
            return { eq: vi.fn(async () => ({ error: null })) };
        }),
        maybeSingle: vi.fn(async () => ({ data: state.profile, error: null })),
    };
    const client = {
        auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
        from: vi.fn(() => profileQuery),
    };
    const update = vi.fn(async () => {
        if (state.polarError) throw state.polarError;
        return { id: "cus_1" };
    });
    const Polar = vi.fn(() => ({ customers: { update } }));

    return { state, client, update, Polar };
});

vi.mock("@polar-sh/sdk", () => ({ Polar: mocks.Polar }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mocks.client) }));

import { POST } from "./route";

const request = (token: string | null = "session") => new NextRequest("https://www.alt-text.pro/api/account/sync-email", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
});

describe("POST /api/account/sync-email", () => {
    beforeEach(() => {
        process.env.POLAR_ACCESS_TOKEN = "polar_test";
        mocks.state.user = { id: "user_1", email: "New@Example.com" };
        mocks.state.profile = { email: "old@example.com", polar_customer_id: "cus_1" };
        mocks.state.profileUpdates = [];
        mocks.state.polarError = null;
        mocks.update.mockClear();
    });

    it("requires a session", async () => {
        expect((await POST(request(null))).status).toBe(401);
    });

    it("moves the Polar customer and the profile to the new sign-in email", async () => {
        const response = await POST(request());
        expect(await response.json()).toEqual({ synced: true, polar_updated: true });
        expect(mocks.update).toHaveBeenCalledWith({ id: "cus_1", customerUpdate: { email: "new@example.com" } });
        expect(mocks.state.profileUpdates[0]).toMatchObject({ email: "new@example.com" });
    });

    it("does nothing when the emails already match", async () => {
        mocks.state.profile = { email: "new@example.com", polar_customer_id: "cus_1" };
        const response = await POST(request());
        expect(await response.json()).toEqual({ synced: false, polar_updated: false });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("leaves the profile unchanged when Polar refuses, so it is retried", async () => {
        mocks.state.polarError = new Error("email already used");
        const response = await POST(request());
        expect(response.status).toBe(500);
        expect(mocks.state.profileUpdates).toHaveLength(0);
    });
});
