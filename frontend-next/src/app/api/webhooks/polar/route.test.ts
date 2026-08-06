import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

type TestProfile = {
    id: string;
    email: string;
    subscription_id: string | null;
    polar_customer_id: string | null;
    bonus_credits_remaining: number;
    purchased_credits_remaining: number;
    next_billing_date: string | null;
};

const mocks = vi.hoisted(() => {
    const state: {
        profiles: TestProfile[];
        updates: Array<{ table: string; values: Record<string, unknown>; filters: Array<[string, string]> }>;
        events: Array<Record<string, unknown>>;
        paymentUpdates: Array<Record<string, unknown>>;
        rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
    } = {
        profiles: [],
        updates: [],
        events: [],
        paymentUpdates: [],
        rpcCalls: [],
    };

    const createQuery = (table: string) => {
        let operation: "select" | "update" | "insert" = "select";
        let values: Record<string, unknown> = {};
        const filters: Array<[string, string]> = [];

        const execute = () => {
            if (operation === "select") {
                const rows = state.profiles.filter((profile) =>
                    filters.every(([field, value]) => String(profile[field as keyof TestProfile]) === value)
                );
                return { data: rows, error: null };
            }

            state.updates.push({ table, values, filters });
            if (table === "payments") {
                state.paymentUpdates.push(values);
            }
            if (operation === "insert" && table === "marketing_events") {
                state.events.push(values);
            }
            return { data: null, error: null };
        };

        const query = {
            select: vi.fn(() => query),
            update: vi.fn((nextValues: Record<string, unknown>) => {
                operation = "update";
                values = nextValues;
                return query;
            }),
            insert: vi.fn((nextValues: Record<string, unknown>) => {
                operation = "insert";
                values = nextValues;
                return query;
            }),
            eq: vi.fn((field: string, value: string) => {
                filters.push([field, value]);
                return query;
            }),
            limit: vi.fn(async () => execute()),
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
        };

        return query;
    };

    const client = {
        from: vi.fn((table: string) => createQuery(table)),
        rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
            state.rpcCalls.push({ name, args });
            return { data: { success: true }, error: null };
        }),
        auth: {
            admin: {
                listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
            },
        },
    };

    return { client, state };
});

vi.mock("@polar-sh/nextjs", () => ({
    Webhooks: vi.fn((config) => config),
}));

vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => mocks.client),
}));

import { POST } from "./route";

const polarWebhookHandlers = POST as unknown as {
    onSubscriptionCanceled?: (payload: unknown) => Promise<void>;
    onSubscriptionRevoked?: (payload: unknown) => Promise<void>;
    onSubscriptionUncanceled?: (payload: unknown) => Promise<void>;
    onOrderRefunded?: (payload: unknown) => Promise<void>;
    onRefundCreated?: (payload: unknown) => Promise<void>;
    onRefundUpdated?: (payload: unknown) => Promise<void>;
};

const annualSubscription = (overrides: Record<string, unknown> = {}) => ({
    id: "sub_annual_1",
    status: "canceled",
    currentPeriodStart: new Date("2026-07-23T16:10:49.335Z"),
    currentPeriodEnd: new Date("2027-07-23T16:10:49.335Z"),
    endsAt: new Date("2027-07-23T16:10:49.335Z"),
    endedAt: null,
    customer: { id: "cus_1", email: "customer@example.com" },
    product: { name: "Standard Annual", metadata: {} },
    metadata: {},
    ...overrides,
});

const profile = (overrides: Partial<TestProfile> = {}): TestProfile => ({
    id: "user_1",
    email: "customer@example.com",
    subscription_id: "sub_annual_1",
    polar_customer_id: "cus_1",
    bonus_credits_remaining: 0,
    purchased_credits_remaining: 0,
    next_billing_date: null,
    ...overrides,
});

describe("Polar subscription lifecycle handlers", () => {
    beforeEach(() => {
        mocks.state.profiles = [profile()];
        mocks.state.updates = [];
        mocks.state.events = [];
        mocks.state.paymentUpdates = [];
        mocks.state.rpcCalls = [];
    });

    it("keeps annual drip metadata through cancellation and stores the paid-period end", async () => {
        await polarWebhookHandlers.onSubscriptionCanceled?.({
            data: annualSubscription(),
        } as never);

        const update = mocks.state.updates.find((entry) => entry.table === "profiles")?.values;
        expect(update).toMatchObject({
            subscription_status: "cancelled",
            next_billing_date: "2027-07-23T16:10:49.335Z",
        });
        expect(update).not.toHaveProperty("billing_cycle");
        expect(update).not.toHaveProperty("monthly_credit_allowance");
        expect(mocks.state.events[0]).toMatchObject({ event_name: "subscription_canceled" });
    });

    it("downgrades only on revocation and preserves persistent ledgers", async () => {
        mocks.state.profiles = [profile({ bonus_credits_remaining: 40, purchased_credits_remaining: 25 })];

        await polarWebhookHandlers.onSubscriptionRevoked?.({
            data: annualSubscription({ status: "unpaid", endsAt: null, endedAt: new Date("2027-07-23T16:10:49.335Z") }),
        } as never);

        expect(mocks.state.rpcCalls).toContainEqual({
            name: "revoke_subscription_access",
            args: { p_user_id: "user_1", p_subscription_id: "sub_annual_1" },
        });
        expect(mocks.state.events[0]).toMatchObject({ event_name: "subscription_revoked" });
    });

    it("restores a pending cancellation without granting a second allowance", async () => {
        await polarWebhookHandlers.onSubscriptionUncanceled?.({
            data: annualSubscription({ status: "active" }),
        } as never);

        expect(mocks.state.updates.find((entry) => entry.table === "profiles")?.values).toMatchObject({
            subscription_plan: "tier2",
            subscription_status: "active",
            billing_cycle: "annual",
            monthly_credit_allowance: 400,
            next_billing_date: "2027-07-23T16:10:49.335Z",
        });
        expect(mocks.state.rpcCalls).toHaveLength(0);
    });

    it("registers refund and revocation callbacks supported by the Polar adapter", () => {
        expect(polarWebhookHandlers.onSubscriptionRevoked).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onSubscriptionUncanceled).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onOrderRefunded).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onRefundCreated).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onRefundUpdated).toEqual(expect.any(Function));
    });

    it("defines an immediate 30-credit free-tier allowance on revocation", () => {
        const migrationPath = path.resolve(
            process.cwd(),
            "../supabase/migrations/20260805202418_fix_subscription_lifecycle_refunds.sql",
        );
        const migration = fs.readFileSync(migrationPath, "utf8");

        expect(migration).toContain("credits_remaining = 30");
        expect(migration).toContain("+ coalesce(bonus_credits_remaining, 0)");
        expect(migration).toContain("+ coalesce(purchased_credits_remaining, 0)");
    });

    it("defines one audited promotional grant path for both credit ledgers", () => {
        const migrationPath = path.resolve(
            process.cwd(),
            "../supabase/migrations/20260805202418_fix_subscription_lifecycle_refunds.sql",
        );
        const migration = fs.readFileSync(migrationPath, "utf8");

        expect(migration).toContain("create or replace function public.grant_promotional_credits(");
        expect(migration).toContain("credits_remaining = current_credits + p_credits");
        expect(migration).toContain("bonus_credits_remaining = current_bonus_credits + p_credits");
        expect(migration).toContain("insert into public.audit_logs");
        expect(migration).toContain("'promotional_credit'");
        expect(migration).toContain("grant execute on function public.grant_promotional_credits(uuid, integer, text)");
    });

    it("revokes a fully refunded one-time pack through the idempotent RPC", async () => {
        await polarWebhookHandlers.onOrderRefunded?.({
            data: {
                id: "order_pack_1",
                status: "refunded",
                totalAmount: 1000,
                refundedAmount: 1000,
                subscriptionId: null,
                customer: { id: "cus_1", email: "customer@example.com" },
                product: { name: "Credit Pack", metadata: {} },
                metadata: {},
            },
        } as never);

        expect(mocks.state.rpcCalls).toEqual([
            {
                name: "revoke_credit_pack_purchase",
                args: { p_payment_id: "polar_ord_order_pack_1" },
            },
        ]);
        expect(mocks.state.paymentUpdates).toEqual([{ status: "refunded", updated_at: expect.any(String) }]);
    });

    it("revokes subscription benefits only for a succeeded refund that asks Polar to revoke them", async () => {
        await polarWebhookHandlers.onRefundCreated?.({
            data: {
                id: "refund_1",
                status: "succeeded",
                reason: "customer_request",
                amount: 4800,
                currency: "usd",
                orderId: "order_annual_1",
                subscriptionId: "sub_annual_1",
                customerId: "cus_1",
                revokeBenefits: true,
            },
        } as never);

        expect(mocks.state.rpcCalls).toContainEqual({
            name: "revoke_subscription_access",
            args: { p_user_id: "user_1", p_subscription_id: "sub_annual_1" },
        });
        expect(mocks.state.rpcCalls).toHaveLength(1);
    });

    it("rechecks a pending refund when Polar sends its final succeeded update", async () => {
        const refund = {
            id: "refund_pending_1",
            status: "pending",
            reason: "customer_request",
            amount: 1000,
            currency: "usd",
            orderId: "order_pack_2",
            subscriptionId: null,
            customerId: "cus_1",
            revokeBenefits: true,
        };

        await polarWebhookHandlers.onRefundCreated?.({ data: refund } as never);
        expect(mocks.state.rpcCalls).toHaveLength(0);

        await polarWebhookHandlers.onRefundUpdated?.({
            data: { ...refund, status: "succeeded" },
        } as never);
        expect(mocks.state.rpcCalls).toContainEqual({
            name: "revoke_credit_pack_purchase",
            args: { p_payment_id: "polar_ord_order_pack_2" },
        });
    });
});
