import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
    const queried: Array<{ table: string; columns: string; userFilter: unknown }> = [];
    const rowsByTable: Record<string, unknown> = {
        profiles: { email: "owner@example.com", subscription_plan: "tier1" },
        usage_logs: [{ created_at: "2026-10-01", alt_text_generated: "A red bike" }],
        payments: [{ amount: 500, currency: "usd" }],
        plugin_sites: [{ site_url: "https://example-site.com" }],
        marketing_events: [{ event_name: "signup_created" }],
        marketing_automation_sends: [],
    };

    const from = vi.fn((table: string) => {
        const entry = { table, columns: "", userFilter: undefined as unknown };
        queried.push(entry);
        const result = { data: rowsByTable[table], error: null };
        const builder: Record<string, unknown> = {
            select: vi.fn((columns: string) => { entry.columns = columns; return builder; }),
            eq: vi.fn((column: string, value: unknown) => {
                if (column === "id" || column === "user_id") entry.userFilter = value;
                return builder;
            }),
            order: vi.fn(() => builder),
            limit: vi.fn(() => builder),
            maybeSingle: vi.fn(async () => result),
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
        return builder;
    });
    const client = {
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: "user_1", email: "owner@example.com", identities: [{ provider: "email" }], created_at: "2026-01-01" } },
                error: null,
            })),
        },
        from,
    };
    return { client, queried };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mocks.client) }));

import { GET } from "./route";

describe("GET /api/account/export", () => {
    it("requires a session", async () => {
        const response = await GET(new NextRequest("https://www.alt-text.pro/api/account/export"));
        expect(response.status).toBe(401);
    });

    it("downloads only the signed-in account's data, without internal values", async () => {
        const response = await GET(new NextRequest("https://www.alt-text.pro/api/account/export", {
            headers: { authorization: "Bearer session" },
        }));

        expect(response.status).toBe(200);
        expect(response.headers.get("content-disposition")).toContain("attachment; filename=\"alt-text-pro-data-");
        const body = await response.json();
        expect(body.account).toMatchObject({ id: "user_1", sign_in_email: "owner@example.com", sign_in_methods: ["email"] });
        expect(body.generation_history[0].alt_text_generated).toBe("A red bike");
        expect(body.connected_sites).toHaveLength(1);

        // Every table is filtered to this user, and no secrets are selected.
        expect(mocks.queried.every((query) => query.userFilter === "user_1")).toBe(true);
        const allColumns = mocks.queried.map((query) => query.columns).join(",");
        expect(allColumns).not.toMatch(/key_hash|api_key|ip_address|polar_customer_id|payment_id/);
    });
});
