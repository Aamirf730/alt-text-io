import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const RECON_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => {
    type Update = {
        values: Record<string, unknown>;
        filters: Array<[string, unknown]>;
        or: string | null;
    };
    const state: {
        user: Record<string, unknown> | null;
        row: Record<string, unknown> | null;
        /** Rows returned by the claim (status -> processing) update. */
        claimRows: Array<Record<string, unknown>>;
        /** Rows returned by the resolve (status -> resolved) update. */
        resolvedRows: Array<{ id: string }>;
        updates: Update[];
        audits: Array<Record<string, unknown>>;
        profile: Record<string, unknown> | null;
        replayOutcome: { outcome: string; reason?: string };
        replayError: Error | null;
    } = {
        user: null,
        row: null,
        claimRows: [],
        resolvedRows: [],
        updates: [],
        audits: [],
        profile: null,
        replayOutcome: { outcome: "applied" },
        replayError: null,
    };

    const from = vi.fn((table: string) => {
        const update: Update = { values: {}, filters: [], or: null };
        let isUpdate = false;
        const query = {
            select: vi.fn(() => query),
            eq: vi.fn((field: string, value: unknown) => {
                update.filters.push([field, value]);
                return query;
            }),
            or: vi.fn((expression: string) => {
                update.or = expression;
                return query;
            }),
            update: vi.fn((values: Record<string, unknown>) => {
                isUpdate = true;
                update.values = values;
                state.updates.push(update);
                return query;
            }),
            insert: vi.fn(async (values: Record<string, unknown>) => {
                if (table === "audit_logs") state.audits.push(values);
                return { data: null, error: null };
            }),
            maybeSingle: vi.fn(async () => ({ data: state.row, error: null })),
            then: (resolve: (value: unknown) => unknown) => {
                let data: unknown = null;
                if (isUpdate && update.values.status === "processing") data = state.claimRows;
                if (isUpdate && update.values.status === "resolved") data = state.resolvedRows;
                return Promise.resolve({ data, error: null }).then(resolve);
            },
        };
        return query;
    });

    const client = {
        auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: state.user ? null : new Error("no") })) },
        from,
    };

    const replayPolarEvent = vi.fn(async () => {
        if (state.replayError) throw state.replayError;
        return state.replayOutcome;
    });
    const loadBillingProfileById = vi.fn(async () => state.profile);

    return { state, client, replayPolarEvent, loadBillingProfileById };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mocks.client) }));
vi.mock("@/lib/polar-webhook-handlers", () => ({
    isReplayableEvent: (name: string) => ["order.paid", "subscription.active"].includes(name),
    loadBillingProfileById: mocks.loadBillingProfileById,
    replayPolarEvent: mocks.replayPolarEvent,
}));

import { POST } from "./route";

const post = (body: unknown, token: string | null = "admin-token") => new NextRequest(
    "http://localhost/api/admin/reconcile-payment",
    {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
    },
);

const updatesTo = (status: string) => mocks.state.updates.filter((entry) => entry.values.status === status);

describe("POST /api/admin/reconcile-payment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SUPERUSER_EMAILS = "admin@example.com";
        mocks.state.user = { id: "admin_1", email: "admin@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" };
        mocks.state.row = {
            id: RECON_ID,
            event_name: "order.paid",
            status: "open",
            payload: { id: "order_1" },
            payment_id: "polar_ord_order_1",
            subscription_id: null,
            reason: "profile_not_found",
        };
        mocks.state.claimRows = [{ id: RECON_ID, payload: { id: "order_1" } }];
        mocks.state.resolvedRows = [{ id: RECON_ID }];
        mocks.state.updates = [];
        mocks.state.audits = [];
        mocks.state.profile = { id: USER_ID, email: "buyer@example.com" };
        mocks.state.replayOutcome = { outcome: "applied" };
        mocks.state.replayError = null;
    });

    it("rejects a non-admin", async () => {
        mocks.state.user = { id: "u", email: "user@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" };

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(403);
        expect(mocks.replayPolarEvent).not.toHaveBeenCalled();
    });

    it("rejects a missing token", async () => {
        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }, null));
        expect(response.status).toBe(401);
    });

    it("validates the body", async () => {
        expect((await POST(post({ reconciliation_id: "x", user_id: USER_ID }))).status).toBe(400);
        expect((await POST(post("not json"))).status).toBe(400);
    });

    it("replays the stored event for the chosen profile and resolves the row", async () => {
        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            result: {
                reconciliation_id: RECON_ID,
                user_id: USER_ID,
                event_name: "order.paid",
                outcome: "applied",
            },
        });
        expect(mocks.replayPolarEvent).toHaveBeenCalledWith("order.paid", { id: "order_1" }, mocks.state.profile);
        expect(mocks.state.updates.map((entry) => entry.values.status)).toEqual(["processing", "resolved"]);
        const [claim, resolve] = mocks.state.updates;
        expect(claim.filters).toEqual([["id", RECON_ID]]);
        expect(claim.or).toMatch(/^status\.eq\.open,and\(status\.eq\.processing,updated_at\.lt\."[^"]+"\)$/);
        expect(resolve.values).toMatchObject({
            status: "resolved",
            resolved_by: "admin_1",
            resolved_user_id: USER_ID,
        });
        expect(resolve.filters).toEqual([["id", RECON_ID], ["status", "processing"]]);
        expect(mocks.state.audits[0]).toMatchObject({
            actor_id: "admin_1",
            actor_email: "admin@example.com",
            action: "payment_reconciliation_resolved",
            resource_type: "payment_reconciliation",
            resource_id: RECON_ID,
        });
    });

    it("returns 409 for a row that is already resolved, without replaying", async () => {
        mocks.state.row = { ...mocks.state.row, status: "resolved" };

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(409);
        expect(mocks.replayPolarEvent).not.toHaveBeenCalled();
    });

    it("returns 409 without replaying when another request claimed the row first", async () => {
        mocks.state.claimRows = [];

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(409);
        expect(mocks.replayPolarEvent).not.toHaveBeenCalled();
        expect(updatesTo("resolved")).toHaveLength(0);
        expect(mocks.state.audits).toHaveLength(0);
    });

    it("returns 409 for a row another request is processing right now", async () => {
        mocks.state.row = { ...mocks.state.row, status: "processing", updated_at: new Date().toISOString() };

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(409);
        expect(mocks.state.updates).toHaveLength(0);
        expect(mocks.replayPolarEvent).not.toHaveBeenCalled();
    });

    it("reclaims a row left processing by a request that died", async () => {
        mocks.state.row = { ...mocks.state.row, status: "processing", updated_at: "2026-01-01T00:00:00.000Z" };

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(200);
        expect(mocks.state.updates.map((entry) => entry.values.status)).toEqual(["processing", "resolved"]);
    });

    it("returns 409 when its claim was taken over before resolving", async () => {
        mocks.state.resolvedRows = [];

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(409);
        expect(mocks.state.audits).toHaveLength(0);
    });

    it("returns 404 for an unknown row or profile", async () => {
        mocks.state.row = null;
        expect((await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }))).status).toBe(404);

        mocks.state.row = { id: RECON_ID, event_name: "order.paid", status: "open", payload: {} };
        mocks.state.profile = null;
        expect((await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }))).status).toBe(404);
        expect(mocks.replayPolarEvent).not.toHaveBeenCalled();
    });

    it("leaves the row open when the replay cannot apply the event", async () => {
        mocks.state.replayOutcome = { outcome: "queued", reason: "unknown_one_time_product" };

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({ reason: "unknown_one_time_product" });
        expect(updatesTo("resolved")).toHaveLength(0);
        expect(updatesTo("open")[0].filters).toEqual([["id", RECON_ID], ["status", "processing"]]);
    });

    it.each(["subscription_mismatch", "stale_subscription", "free_profile"])(
        "does not resolve the row when the handler ignored the event (%s)",
        async (reason) => {
            mocks.state.row = { ...mocks.state.row, event_name: "subscription.active" };
            mocks.state.replayOutcome = { outcome: "ignored", reason };

            const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

            expect(response.status).toBe(422);
            expect(await response.json()).toMatchObject({ outcome: "ignored", reason });
            expect(updatesTo("resolved")).toHaveLength(0);
            expect(updatesTo("open")).toHaveLength(1);
            expect(mocks.state.audits).toHaveLength(0);
        },
    );

    it("refuses an event type with no handler", async () => {
        mocks.state.row = { ...mocks.state.row, event_name: "checkout.created" };

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(422);
    });

    it("puts the row back to open when the replay fails", async () => {
        mocks.state.replayError = new Error("rpc failed");
        vi.spyOn(console, "error").mockImplementation(() => {});

        const response = await POST(post({ reconciliation_id: RECON_ID, user_id: USER_ID }));

        expect(response.status).toBe(500);
        expect(updatesTo("resolved")).toHaveLength(0);
        expect(updatesTo("open")).toHaveLength(1);
    });
});
