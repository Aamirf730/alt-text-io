import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

type TestProfile = {
    id: string;
    email: string;
    subscription_id: string | null;
    polar_customer_id: string | null;
    polar_product_id?: string | null;
    bonus_credits_remaining: number;
    purchased_credits_remaining: number;
    next_billing_date: string | null;
    credits_remaining?: number;
    subscription_plan?: string;
    subscription_status?: string;
    billing_cycle?: string | null;
    monthly_credit_allowance?: number | null;
    credits_last_renewed_at?: string | null;
};

const mocks = vi.hoisted(() => {
    process.env.POLAR_WEBHOOK_SECRET ||= "test-webhook-secret";

    const state: {
        profiles: TestProfile[];
        updates: Array<{ table: string; values: Record<string, unknown>; filters: Array<[string, string]> }>;
        events: Array<Record<string, unknown>>;
        paymentUpdates: Array<Record<string, unknown>>;
        rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
        operations: string[];
        duplicatePaymentIds: Set<string>;
        reconciliations: Array<Record<string, unknown>>;
        authUsers: Array<{ id: string; email: string | null }>;
        authPageMode: "state" | "always_full";
        updateErrors: Set<string>;
    } = {
        profiles: [],
        updates: [],
        events: [],
        paymentUpdates: [],
        rpcCalls: [],
        operations: [],
        duplicatePaymentIds: new Set(),
        reconciliations: [],
        authUsers: [],
        authPageMode: "state",
        updateErrors: new Set(),
    };

    const createQuery = (table: string) => {
        let operation: "select" | "update" | "insert" = "select";
        let values: Record<string, unknown> = {};
        const filters: Array<[string, string]> = [];
        const caseInsensitiveFilters = new Set<string>();

        const execute = () => {
            if (operation === "insert" && table === "payments") {
                state.operations.push("payments.insert");
                if (state.duplicatePaymentIds.has(String(values.payment_id))) {
                    return { data: null, error: { code: "23505", message: "duplicate payment" } };
                }
            }

            if (operation === "select") {
                const rows = state.profiles.filter((profile) =>
                    filters.every(([field, value]) => {
                        const actual = String(profile[field as keyof TestProfile]);
                        return caseInsensitiveFilters.has(field)
                            ? actual.toLowerCase() === value.toLowerCase()
                            : actual === value;
                    })
                );
                return { data: rows, error: null };
            }

            if (state.updateErrors.has(table)) {
                return { data: null, error: { message: `${table} update failed` } };
            }

            state.updates.push({ table, values, filters });
            if (table === "payments") {
                state.paymentUpdates.push(values);
            }
            if (operation === "insert" && table === "marketing_events") {
                state.events.push(values);
            }
            if (operation === "insert" && table === "payment_reconciliation") {
                state.reconciliations.push(values);
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
            ilike: vi.fn((field: string, value: string) => {
                caseInsensitiveFilters.add(field);
                filters.push([field, value]);
                return query;
            }),
            single: vi.fn(async () => {
                const result = execute() as { data?: unknown[] | unknown; error?: unknown };
                return {
                    data: Array.isArray(result.data) ? result.data[0] || null : result.data || null,
                    error: result.error || null,
                };
            }),
            limit: vi.fn(async () => execute()),
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
        };

        return query;
    };

    const client = {
        from: vi.fn((table: string) => createQuery(table)),
        rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
            state.operations.push(`rpc:${name}`);
            state.rpcCalls.push({ name, args });
            return {
                data: name === "renew_subscription_credits"
                    ? { success: true, renewed: true, already_processed: false }
                    : { success: true },
                error: null,
            };
        }),
        auth: {
            admin: {
                listUsers: vi.fn(async (options?: { page?: number; perPage?: number }) => {
                    const page = options?.page || 1;
                    const perPage = options?.perPage || 50;
                    if (state.authPageMode === "always_full") {
                        return {
                            data: {
                                users: Array.from({ length: perPage }, (_, index) => ({
                                    id: `auth_page_${page}_${index}`,
                                    email: `auth-page-${page}-${index}@example.com`,
                                })),
                            },
                            error: null,
                        };
                    }

                    const start = (page - 1) * perPage;
                    return {
                        data: { users: state.authUsers.slice(start, start + perPage) },
                        error: null,
                    };
                }),
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
    onOrderPaid?: (payload: unknown) => Promise<void>;
    onSubscriptionActive?: (payload: unknown) => Promise<void>;
    onSubscriptionUpdated?: (payload: unknown) => Promise<void>;
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
    product: { id: "prod_standard_annual", name: "Standard Annual", metadata: {} },
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

const paidSubscriptionOrder = (overrides: Record<string, unknown> = {}) => ({
    id: "order_subscription_1",
    subscriptionId: "sub_annual_1",
    totalAmount: 2000,
    currency: "usd",
    customer: { id: "cus_1", email: "customer@example.com" },
    product: { id: "prod_standard_annual", name: "Standard Annual", metadata: {} },
    metadata: {},
    ...overrides,
});

const paidPackOrder = (overrides: Record<string, unknown> = {}) => ({
    id: "order_pack_1",
    subscriptionId: null,
    totalAmount: 1000,
    currency: "usd",
    customer: { id: "cus_1", email: "customer@example.com" },
    product: { id: "prod_credit_pack", name: "Credit Pack", metadata: {} },
    metadata: {},
    ...overrides,
});

describe("Polar subscription lifecycle handlers", () => {
    beforeEach(() => {
        mocks.state.profiles = [profile()];
        mocks.state.updates = [];
        mocks.state.events = [];
        mocks.state.paymentUpdates = [];
        mocks.state.rpcCalls = [];
        mocks.state.operations = [];
        mocks.state.duplicatePaymentIds = new Set();
        mocks.state.reconciliations = [];
        mocks.state.authUsers = [];
        mocks.state.authPageMode = "state";
        mocks.state.updateErrors = new Set();
    });

    it("provisions an Agency subscription with the new monthly allowance", async () => {
        mocks.state.profiles = [profile({
            subscription_id: null,
            polar_product_id: null,
            bonus_credits_remaining: 150,
            purchased_credits_remaining: 0,
        })];

        await polarWebhookHandlers.onSubscriptionActive?.({
            data: {
                id: "sub_agency_1",
                status: "active",
                currentPeriodStart: new Date("2026-08-10T00:00:00.000Z"),
                currentPeriodEnd: new Date("2026-09-10T00:00:00.000Z"),
                customer: { id: "cus_1", email: "customer@example.com" },
                product: {
                    id: "prod_agency_monthly",
                    name: "Alt Text Pro — Agency Monthly",
                    metadata: { plan_id: "tier4", type: "subscription", credits: 3500 },
                },
                metadata: {},
            },
        } as never);

        expect(mocks.state.rpcCalls).toContainEqual({
            name: "activate_subscription_profile",
            args: {
                p_user_id: "user_1",
                p_subscription_id: "sub_agency_1",
                p_subscription_plan: "tier4",
                p_polar_customer_id: "cus_1",
                p_polar_product_id: "prod_agency_monthly",
                p_billing_cycle: "monthly",
                p_monthly_credit_allowance: 3500,
                p_next_billing_date: "2026-09-10T00:00:00.000Z",
            },
        });
        expect(mocks.state.updates).toHaveLength(0);
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
            monthly_credit_allowance: 1000,
            next_billing_date: "2027-07-23T16:10:49.335Z",
        });
        expect(mocks.state.rpcCalls).toHaveLength(0);
    });

    it("records subscription revenue once from the canonical paid order", async () => {
        await polarWebhookHandlers.onOrderPaid?.({
            data: paidSubscriptionOrder(),
        } as never);

        expect(mocks.state.paymentUpdates).toHaveLength(1);
        expect(mocks.state.paymentUpdates[0]).toMatchObject({
            payment_id: "polar_ord_order_subscription_1",
            subscription_id: "sub_annual_1",
            amount: 20,
        });
    });

    it("does not create a second payment row from subscription.updated", async () => {
        await polarWebhookHandlers.onSubscriptionUpdated?.({
            data: annualSubscription({
                status: "active",
                currentPeriodStart: new Date("2026-08-23T16:10:49.335Z"),
                currentPeriodEnd: new Date("2026-09-23T16:10:49.335Z"),
                endsAt: null,
            }),
        } as never);

        expect(mocks.state.paymentUpdates).toHaveLength(0);
    });

    it("resets the plan allowance on renewal while preserving persistent ledgers", async () => {
        mocks.state.profiles = [profile({
            credits_remaining: 900,
            subscription_plan: "tier2",
            subscription_status: "active",
            billing_cycle: "annual",
            monthly_credit_allowance: 400,
            credits_last_renewed_at: "2026-07-23T16:10:49.335Z",
            bonus_credits_remaining: 40,
            purchased_credits_remaining: 25,
        })];

        await polarWebhookHandlers.onSubscriptionUpdated?.({
            data: annualSubscription({
                status: "active",
                currentPeriodStart: new Date("2026-08-23T16:10:49.335Z"),
                currentPeriodEnd: new Date("2026-09-23T16:10:49.335Z"),
                endsAt: null,
            }),
        } as never);

        expect(mocks.state.rpcCalls).toContainEqual({
            name: "renew_subscription_credits",
            args: {
                p_user_id: "user_1",
                p_subscription_id: "sub_annual_1",
                p_subscription_plan: "tier2",
                p_current_period_start: "2026-08-23T16:10:49.335Z",
                p_polar_product_id: "prod_standard_annual",
                p_billing_cycle: "annual",
                p_monthly_credit_allowance: 400,
                p_next_billing_date: "2026-09-23T16:10:49.335Z",
            },
        });
        expect(mocks.state.updates).toHaveLength(0);
    });

    it("records a one-time payment before granting its credits", async () => {
        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder(),
        } as never);

        expect(mocks.state.operations.slice(0, 2)).toEqual([
            "payments.insert",
            "rpc:grant_credit_pack_purchase",
        ]);
        expect(mocks.state.paymentUpdates[0]).toMatchObject({
            payment_id: "polar_ord_order_pack_1",
        });
        expect(mocks.state.rpcCalls).toContainEqual({
            name: "grant_credit_pack_purchase",
            args: {
                p_user_id: "user_1",
                p_payment_id: "polar_ord_order_pack_1",
                p_credits: 1200,
            },
        });
    });

    it("uses explicit Polar pack metadata before the fallback map", async () => {
        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({
                product: {
                    id: "prod_credit_pack",
                    name: "Credit Pack",
                    metadata: { credits: 100 },
                },
            }),
        } as never);

        expect(mocks.state.rpcCalls).toContainEqual({
            name: "grant_credit_pack_purchase",
            args: expect.objectContaining({ p_credits: 100 }),
        });
    });

    it("maps the Small Credit Pack to its 500-credit allowance", async () => {
        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({
                product: {
                    id: "prod_small_pack",
                    name: "Small Credit Pack",
                    metadata: {},
                },
            }),
        } as never);

        expect(mocks.state.rpcCalls).toContainEqual({
            name: "grant_credit_pack_purchase",
            args: expect.objectContaining({ p_credits: 500 }),
        });
    });

    it("queues unknown one-time products instead of granting an ambiguous amount", async () => {
        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({
                product: { id: "prod_unknown", name: "Mystery Product", metadata: {} },
            }),
        } as never);

        expect(mocks.state.reconciliations).toContainEqual(expect.objectContaining({
            event_name: "order.paid",
            reason: "unknown_one_time_product",
            payment_id: "polar_ord_order_pack_1",
        }));
        expect(mocks.state.rpcCalls).toHaveLength(0);
    });

    it("fails the order handler when saving the Polar customer ID fails", async () => {
        mocks.state.updateErrors.add("profiles");

        await expect(polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder(),
        } as never)).rejects.toThrow("profiles update failed");
    });

    it("retries idempotent fulfillment after a payment insert is already recorded", async () => {
        mocks.state.duplicatePaymentIds.add("polar_ord_order_pack_1");

        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder(),
        } as never);

        expect(mocks.state.operations.slice(0, 2)).toEqual([
            "payments.insert",
            "rpc:grant_credit_pack_purchase",
        ]);
        expect(mocks.state.rpcCalls).toContainEqual({
            name: "grant_credit_pack_purchase",
            args: expect.objectContaining({
                p_payment_id: "polar_ord_order_pack_1",
            }),
        });
    });

    it("registers refund and revocation callbacks supported by the Polar adapter", () => {
        expect(polarWebhookHandlers.onSubscriptionRevoked).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onSubscriptionUncanceled).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onOrderRefunded).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onRefundCreated).toEqual(expect.any(Function));
        expect(polarWebhookHandlers.onRefundUpdated).toEqual(expect.any(Function));
    });

    it("defines an immediate 15-credit free-tier allowance on revocation", () => {
        const migrationPath = path.resolve(
            process.cwd(),
            "../supabase/migrations/20260809120000_apply_2026_08_pricing_packages.sql",
        );
        const migration = fs.readFileSync(migrationPath, "utf8");

        expect(migration).toContain("credits_remaining = 15");
        expect(migration).toContain("+ coalesce(bonus_credits_remaining, 0)");
        expect(migration).toContain("+ coalesce(purchased_credits_remaining, 0)");
    });

    it("defines one audited promotional grant path for both credit ledgers", () => {
        const migrationPath = path.resolve(
            process.cwd(),
            "../supabase/migrations/20260817060012_harden_credit_and_profile_integrity.sql",
        );
        const migration = fs.readFileSync(migrationPath, "utf8");

        expect(migration).toContain("create or replace function public.grant_promotional_credits(");
        expect(migration).toContain("credits_remaining = current_credits + p_credits");
        expect(migration).toContain("bonus_credits_remaining = current_bonus_credits + p_credits");
        expect(migration).toContain("insert into public.audit_logs");
        expect(migration).toContain("'promotional_credit'");
        expect(migration).toContain("grant execute on function public.grant_promotional_credits(uuid, integer, text, text)");
    });

    it("defines payment and credit-pack idempotency keys", () => {
        const migrationPath = path.resolve(
            process.cwd(),
            "../supabase/migrations/20260805094230_fix_purchased_credit_pack_ledger.sql",
        );
        const migration = fs.readFileSync(migrationPath, "utf8");

        expect(migration).toContain("create unique index if not exists payments_payment_id_uidx");
        expect(migration).toContain("on conflict (payment_id) do nothing");
    });

    it("defines the non-rollover paid-credit reset and existing-balance repair", () => {
        const migrationPath = path.resolve(
            process.cwd(),
            "../supabase/migrations/20260806140000_fix_subscription_credit_rollover.sql",
        );
        const migration = fs.readFileSync(migrationPath, "utf8");

        expect(migration).toContain("with paid_profile_state as (");
        expect(migration).toContain("credits_remaining = state.plan_credits_remaining");
        expect(migration).toContain("+ state.bonus_credits_remaining");
        expect(migration).toContain("+ state.purchased_credits_remaining");
        expect(migration).toContain("credits_remaining = coalesce(monthly_credit_allowance, 0)");
        expect(migration).toContain("p.next_billing_date > now()");
    });

    it("defines a service-role-only reconciliation queue for unmatched provider events", () => {
        const migrationPath = path.resolve(
            process.cwd(),
            "../supabase/migrations/20260806051721_payment_reconciliation_h1.sql",
        );
        const migration = fs.readFileSync(migrationPath, "utf8");

        expect(migration).toContain("create table if not exists public.payment_reconciliation");
        expect(migration).toContain("enable row level security");
        expect(migration).toContain("revoke all on table public.payment_reconciliation from public, anon, authenticated");
        expect(migration).toContain("grant all on table public.payment_reconciliation to service_role");
        expect(migration).toContain("payment_reconciliation_provider_event_uidx");
    });

    it("uses checkout metadata user_id before mutable provider identity fields", async () => {
        await polarWebhookHandlers.onSubscriptionCanceled?.({
            data: annualSubscription({
                customer: { id: "cus_other", email: "different@example.com" },
                metadata: { user_id: "user_1" },
            }),
        } as never);

        expect(mocks.state.updates.find((entry) => entry.table === "profiles")?.filters).toContainEqual(["id", "user_1"]);
        expect(mocks.state.reconciliations).toHaveLength(0);
    });

    it("matches email case-insensitively after provider IDs are unavailable", async () => {
        mocks.state.profiles = [profile({
            email: "Customer@Example.com",
            subscription_id: null,
            polar_customer_id: null,
        })];

        await polarWebhookHandlers.onSubscriptionCanceled?.({
            data: annualSubscription({
                id: "sub_email_case",
                customer: { id: null, email: " CUSTOMER@example.COM ", },
            }),
        } as never);

        expect(mocks.state.reconciliations).toHaveLength(0);
        expect(mocks.state.updates.find((entry) => entry.table === "profiles")?.values).toMatchObject({
            subscription_status: "cancelled",
        });
    });

    it("paginates the auth fallback beyond the first thousand users", async () => {
        const firstPage = Array.from({ length: 1000 }, (_, index) => ({
            id: `auth_${index}`,
            email: `user-${index}@example.com`,
        }));
        mocks.state.authUsers = [...firstPage, { id: "user_paged", email: "paged@example.com" }];
        mocks.state.profiles = [profile({
            id: "user_paged",
            email: "stored-different@example.com",
            subscription_id: null,
            polar_customer_id: null,
        })];

        await polarWebhookHandlers.onSubscriptionCanceled?.({
            data: annualSubscription({
                id: "sub_paged",
                customer: { id: null, email: "paged@example.com" },
            }),
        } as never);

        expect(mocks.client.auth.admin.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1000 });
        expect(mocks.client.auth.admin.listUsers).toHaveBeenCalledWith({ page: 2, perPage: 1000 });
        expect(mocks.state.reconciliations).toHaveLength(0);
        expect(mocks.state.updates.find((entry) => entry.table === "profiles")?.values).toMatchObject({
            subscription_status: "cancelled",
        });
    });

    it("queues an unmatched event for reconciliation instead of dropping it", async () => {
        mocks.state.profiles = [];

        await polarWebhookHandlers.onSubscriptionCanceled?.({
            data: annualSubscription({
                id: "sub_unmatched",
                customer: { id: "cus_unmatched", email: "missing@example.com" },
            }),
        } as never);

        expect(mocks.state.reconciliations).toHaveLength(1);
        expect(mocks.state.reconciliations[0]).toMatchObject({
            provider: "polar",
            event_name: "subscription.canceled",
            provider_object_id: "sub_unmatched",
            customer_email: "missing@example.com",
            status: "open",
        });
    });

    it("fails closed when the Auth fallback reaches its pagination limit", async () => {
        mocks.state.profiles = [];
        mocks.state.authPageMode = "always_full";
        mocks.client.auth.admin.listUsers.mockClear();

        await expect(polarWebhookHandlers.onSubscriptionCanceled?.({
            data: annualSubscription({
                id: "sub_pagination_limit",
                customer: { id: null, email: "missing@example.com" },
            }),
        } as never)).rejects.toThrow("Auth user pagination limit reached");

        expect(mocks.client.auth.admin.listUsers).toHaveBeenCalledTimes(101);
        expect(mocks.state.reconciliations).toHaveLength(0);
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

    it("queues refund events without an order ID instead of creating an undefined payment key", async () => {
        await polarWebhookHandlers.onOrderRefunded?.({
            data: {
                status: "refunded",
                totalAmount: 1000,
                refundedAmount: 1000,
                customer: { id: "cus_1", email: "customer@example.com" },
            },
        } as never);

        await polarWebhookHandlers.onRefundCreated?.({
            data: {
                id: "refund_without_order",
                status: "succeeded",
                customerId: "cus_1",
                revokeBenefits: true,
            },
        } as never);

        expect(mocks.state.paymentUpdates).toHaveLength(0);
        expect(mocks.state.rpcCalls).toHaveLength(0);
        expect(mocks.state.reconciliations).toEqual(expect.arrayContaining([
            expect.objectContaining({ event_name: "order.refunded", reason: "missing_order_id" }),
            expect.objectContaining({ event_name: "refund_created", reason: "missing_order_id" }),
        ]));
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
