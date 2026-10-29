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
        authUsers: Array<{ id: string; email: string | null; confirmed?: boolean }>;
        emailRpcMissing: boolean;
        updateErrors: Set<string>;
        rpcResults: Record<string, unknown>;
        /** Rows for selects on tables other than profiles. */
        tableRows: Record<string, Array<Record<string, unknown>>>;
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
        emailRpcMissing: false,
        updateErrors: new Set(),
        rpcResults: {},
        tableRows: {},
    };

    const createQuery = (table: string) => {
        let operation: "select" | "update" | "insert" | "upsert" = "select";
        let values: Record<string, unknown> = {};
        const filters: Array<[string, string]> = [];
        const caseInsensitiveFilters = new Set<string>();
        const nullFilters: string[] = [];
        const notEqualFilters: Array<[string, string]> = [];

        const execute = () => {
            if (operation === "insert" && table === "payments") {
                state.operations.push("payments.insert");
                if (state.duplicatePaymentIds.has(String(values.payment_id))) {
                    return { data: null, error: { code: "23505", message: "duplicate payment" } };
                }
            }

            if (operation === "select" && table !== "profiles") {
                const rows = (state.tableRows[table] || []).filter((row) =>
                    filters.every(([field, value]) => String(row[field]) === value)
                );
                return { data: rows, error: null };
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
            if (operation === "update" && table === "profiles") {
                // Conditional updates (.is / .neq) return the rows they hit.
                const matched = state.profiles.filter((row) =>
                    filters.every(([field, value]) => String(row[field as keyof TestProfile]) === value)
                    && nullFilters.every((field) => row[field as keyof TestProfile] == null)
                    && notEqualFilters.every(([field, value]) => String(row[field as keyof TestProfile]) !== value)
                );
                for (const row of matched) Object.assign(row, values);
                return { data: matched.map((row) => ({ id: row.id })), error: null };
            }
            if ((operation === "insert" || operation === "upsert") && table === "marketing_events") {
                const key = values.dedupe_key;
                if (operation === "upsert" && key && state.events.some((event) => event.dedupe_key === key)) {
                    return { data: null, error: null };
                }
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
            upsert: vi.fn((nextValues: Record<string, unknown>) => {
                operation = "upsert";
                values = nextValues;
                return query;
            }),
            eq: vi.fn((field: string, value: string) => {
                filters.push([field, value]);
                return query;
            }),
            is: vi.fn((field: string, value: null) => {
                if (value === null) nullFilters.push(field);
                return query;
            }),
            neq: vi.fn((field: string, value: string) => {
                notEqualFilters.push([field, value]);
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
            if (name === "find_billing_user_ids_by_email") {
                // Mirrors the SQL: confirmed Auth users only, by Auth email
                // or by profile email.
                if (state.emailRpcMissing) {
                    return { data: null, error: { code: "PGRST202", message: "function not found" } };
                }
                const email = String(args.p_email).trim().toLowerCase();
                const confirmed = state.authUsers.filter((user) => user.confirmed !== false);
                const rows = [
                    ...confirmed
                        .filter((user) => String(user.email).toLowerCase() === email)
                        .filter((user) => state.profiles.some((p) => p.id === user.id))
                        .map((user) => ({ user_id: user.id, match_source: "auth_email" })),
                    ...state.profiles
                        .filter((p) => p.email.toLowerCase() === email)
                        .filter((p) => confirmed.some((user) => user.id === p.id))
                        .map((p) => ({ user_id: p.id, match_source: "profile_email" })),
                ];
                return { data: rows, error: null };
            }
            state.operations.push(`rpc:${name}`);
            state.rpcCalls.push({ name, args });
            const defaults: Record<string, unknown> = {
                renew_subscription_credits: { success: true, renewed: true, already_processed: false },
                record_payment_refund: { success: true, payment_found: true, full_refund: false },
            };
            return {
                data: state.rpcResults[name] ?? defaults[name] ?? { success: true },
                error: null,
            };
        }),
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
import { replayPolarEvent, type BillingProfile } from "@/lib/polar-webhook-handlers";

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
    subscription_plan: "tier2",
    subscription_status: "active",
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
        mocks.state.emailRpcMissing = false;
        mocks.state.updateErrors = new Set();
        mocks.state.rpcResults = {};
        mocks.state.tableRows = {};
    });

    it("applies a same-period plan switch from the customer portal immediately", async () => {
        mocks.state.profiles = [profile({
            subscription_id: "sub_starter_1",
            subscription_plan: "tier1",
            polar_product_id: "prod_starter_monthly",
            billing_cycle: "monthly",
            monthly_credit_allowance: 500,
        })];
        mocks.state.rpcResults.renew_subscription_credits = {
            success: true,
            renewed: false,
            already_processed: true,
            reason: "period_already_processed",
        };
        mocks.state.rpcResults.change_subscription_plan = { success: true, changed: true };

        await polarWebhookHandlers.onSubscriptionUpdated?.({
            data: {
                id: "sub_starter_1",
                status: "active",
                currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
                currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
                endsAt: null,
                customer: { id: "cus_1", email: "customer@example.com" },
                product: {
                    id: "prod_agency_monthly",
                    name: "Alt Text Pro — Agency Monthly",
                    metadata: { plan_id: "tier4", type: "subscription" },
                },
                metadata: {},
            },
        } as never);

        expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual([
            "renew_subscription_credits",
            "change_subscription_plan",
        ]);
        expect(mocks.state.rpcCalls[1].args).toEqual({
            p_user_id: "user_1",
            p_subscription_id: "sub_starter_1",
            p_subscription_plan: "tier4",
            p_polar_product_id: "prod_agency_monthly",
            p_billing_cycle: "monthly",
            p_monthly_credit_allowance: 5000,
            p_next_billing_date: "2026-11-01T00:00:00.000Z",
        });
    });

    it("does not attempt a plan change when a new period was renewed", async () => {
        await polarWebhookHandlers.onSubscriptionUpdated?.({
            data: annualSubscription({
                status: "active",
                currentPeriodStart: new Date("2026-08-23T16:10:49.335Z"),
                currentPeriodEnd: new Date("2026-09-23T16:10:49.335Z"),
                endsAt: null,
            }),
        } as never);

        expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual(["renew_subscription_credits"]);
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
                    metadata: { plan_id: "tier4", type: "subscription", credits: 5000 },
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
                p_monthly_credit_allowance: 5000,
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
            monthly_credit_allowance: 1500,
            next_billing_date: "2027-07-23T16:10:49.335Z",
        });
        expect(mocks.state.rpcCalls).toHaveLength(0);
    });

    it("keeps a pinned allowance for a legacy profile without a stored subscription ID", async () => {
        mocks.state.profiles = [profile({
            subscription_id: null,
            subscription_plan: "tier2",
            monthly_credit_allowance: 1000,
            polar_product_id: "prod_standard_annual",
        })];

        await polarWebhookHandlers.onSubscriptionUncanceled?.({
            data: annualSubscription({ status: "active" }),
        } as never);

        const profileUpdates = mocks.state.updates.filter((entry) => entry.table === "profiles");
        // The guard first binds the subscription, then the uncancel applies.
        expect(profileUpdates[0].values).toEqual({ subscription_id: "sub_annual_1", updated_at: expect.any(String) });
        expect(profileUpdates.at(-1)?.values).toMatchObject({
            monthly_credit_allowance: 1000,
        });
    });

    it("keeps a legacy pinned allowance when the same subscription is restored", async () => {
        mocks.state.profiles = [profile({
            subscription_plan: "tier2",
            monthly_credit_allowance: 1000,
            polar_product_id: "prod_standard_annual",
        })];

        await polarWebhookHandlers.onSubscriptionUncanceled?.({
            data: annualSubscription({ status: "active" }),
        } as never);

        expect(mocks.state.updates.find((entry) => entry.table === "profiles")?.values).toMatchObject({
            subscription_plan: "tier2",
            monthly_credit_allowance: 1000,
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
                p_credits: 5000,
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

    it("maps the Small Credit Pack to its 1,000-credit allowance", async () => {
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
            args: expect.objectContaining({ p_credits: 1000 }),
        });
    });

    it("maps a branded Bulk Pack to 15,000 credits, not the Pro plan", async () => {
        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({
                totalAmount: 9900,
                product: {
                    id: "prod_bulk_pack",
                    name: "Alt Text Pro — Bulk Pack",
                    metadata: {},
                },
            }),
        } as never);

        expect(mocks.state.rpcCalls).toContainEqual({
            name: "grant_credit_pack_purchase",
            args: expect.objectContaining({ p_credits: 15000 }),
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
        mocks.state.authUsers = [{ id: "user_1", email: "customer@example.com" }];

        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({ customer: { id: null, email: " CUSTOMER@example.COM " } }),
        } as never);

        expect(mocks.state.reconciliations).toHaveLength(0);
        expect(mocks.state.rpcCalls).toContainEqual({
            name: "grant_credit_pack_purchase",
            args: expect.objectContaining({ p_user_id: "user_1" }),
        });
    });

    it("prefers a confirmed Auth email match over a profile email match", async () => {
        mocks.state.authUsers = [
            { id: "user_auth", email: "paged@example.com" },
            { id: "user_profile", email: "old@example.com" },
        ];
        mocks.state.profiles = [
            profile({ id: "user_auth", email: "stored-different@example.com", subscription_id: null, polar_customer_id: null }),
            profile({ id: "user_profile", email: "paged@example.com", subscription_id: null, polar_customer_id: null }),
        ];

        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({ customer: { id: null, email: "paged@example.com" } }),
        } as never);

        expect(mocks.state.reconciliations).toHaveLength(0);
        expect(mocks.state.rpcCalls).toContainEqual({
            name: "grant_credit_pack_purchase",
            args: expect.objectContaining({ p_user_id: "user_auth" }),
        });
    });

    it("does not match an email that belongs only to an unconfirmed account", async () => {
        mocks.state.authUsers = [{ id: "user_1", email: "customer@example.com", confirmed: false }];
        mocks.state.profiles = [profile({ subscription_id: "sub_unconfirmed", polar_customer_id: null })];

        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({ customer: { id: null, email: "customer@example.com" } }),
        } as never);

        expect(mocks.state.rpcCalls).toHaveLength(0);
        expect(mocks.state.reconciliations[0]).toMatchObject({ reason: "profile_not_found" });
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
            // Subscription rows are keyed per event (period start), so the
            // next renewal of the same subscription gets its own row.
            provider_object_id: "sub_unmatched:2026-07-23T16:10:49.335Z",
            customer_email: "missing@example.com",
            status: "open",
        });
    });

    it("queues an event whose email matches several profiles instead of guessing", async () => {
        mocks.state.authUsers = [
            { id: "user_a", email: "a@example.com" },
            { id: "user_b", email: "b@example.com" },
        ];
        mocks.state.profiles = [
            profile({ id: "user_a", email: "Shared@example.com", subscription_id: null, polar_customer_id: null }),
            profile({ id: "user_b", email: "shared@example.com", subscription_id: null, polar_customer_id: null }),
        ];

        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({ customer: { id: null, email: "shared@example.com" } }),
        } as never);

        expect(mocks.state.rpcCalls).toHaveLength(0);
        expect(mocks.state.reconciliations[0]).toMatchObject({
            event_name: "order.paid",
            reason: "ambiguous_email_match",
        });
    });

    it("falls back to a bounded profile lookup before the email RPC is deployed", async () => {
        mocks.state.emailRpcMissing = true;
        mocks.state.profiles = [
            profile({ id: "user_a", email: "shared@example.com", subscription_id: null, polar_customer_id: null }),
            profile({ id: "user_b", email: "SHARED@example.com", subscription_id: null, polar_customer_id: null }),
        ];

        await polarWebhookHandlers.onOrderPaid?.({
            data: paidPackOrder({ customer: { id: null, email: "shared@example.com" } }),
        } as never);

        expect(mocks.state.reconciliations[0]).toMatchObject({ reason: "ambiguous_email_match" });
    });

    it("records an order refund without changing access (refund.* carries the revoke choice)", async () => {
        mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: true };

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
                name: "record_payment_refund",
                args: {
                    p_payment_id: "polar_ord_order_pack_1",
                    p_refund_id: null,
                    p_refund_amount: null,
                    p_refund_tax_amount: null,
                    p_refund_status: null,
                    p_order_refunded_amount: 10,
                    p_order_refunded_tax_amount: 0,
                    p_order_status: "refunded",
                },
            },
        ]);
        expect(mocks.state.events[0]).toMatchObject({
            event_name: "order_refunded",
            dedupe_key: "polar:order_refunded:order_pack_1:1000",
        });
    });

    it("never downgrades a subscription from an order refund guessed by product name", async () => {
        mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: true };

        await polarWebhookHandlers.onOrderRefunded?.({
            data: {
                id: "order_old_sub",
                status: "refunded",
                totalAmount: 1200,
                refundedAmount: 1200,
                subscriptionId: null,
                customer: { id: "cus_1", email: "customer@example.com" },
                product: { name: "Alt Text Pro — Growth Monthly", metadata: { plan_id: "tier2" } },
                metadata: {},
            },
        } as never);

        expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual(["record_payment_refund"]);
    });

    it("stores cumulative partial-refund totals so revenue can be reported net", async () => {
        await polarWebhookHandlers.onOrderRefunded?.({
            data: {
                id: "order_sub_9",
                status: "partially_refunded",
                totalAmount: 1452,
                taxAmount: 252,
                refundedAmount: 605,
                refundedTaxAmount: 105,
                subscriptionId: "sub_9",
                customer: { id: "cus_1", email: "customer@example.com" },
                product: { name: "Alt Text Pro — Growth Monthly", metadata: { plan_id: "tier2" } },
                metadata: {},
            },
        } as never);

        expect(mocks.state.rpcCalls[0]).toMatchObject({
            name: "record_payment_refund",
            args: {
                p_payment_id: "polar_ord_order_sub_9",
                p_order_refunded_amount: 6.05,
                p_order_refunded_tax_amount: 1.05,
                p_order_status: "partially_refunded",
            },
        });
        expect(mocks.state.rpcCalls).toHaveLength(1);
    });

    it("stores each refund.* amount by refund ID", async () => {
        await polarWebhookHandlers.onRefundCreated?.({
            data: {
                id: "refund_partial",
                status: "succeeded",
                amount: 300,
                taxAmount: 50,
                currency: "usd",
                orderId: "order_pack_3",
                subscriptionId: null,
                customerId: "cus_1",
                revokeBenefits: false,
            },
        } as never);

        expect(mocks.state.rpcCalls).toEqual([{
            name: "record_payment_refund",
            args: {
                p_payment_id: "polar_ord_order_pack_3",
                p_refund_id: "refund_partial",
                p_refund_amount: 3,
                p_refund_tax_amount: 0.5,
                p_refund_status: "succeeded",
                p_order_refunded_amount: null,
                p_order_refunded_tax_amount: null,
                p_order_status: null,
            },
        }]);
    });

    it("keeps benefits on a partial refund even when revokeBenefits is set", async () => {
        mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: false };

        await polarWebhookHandlers.onRefundCreated?.({
            data: {
                id: "refund_partial_revoke",
                status: "succeeded",
                amount: 300,
                orderId: "order_pack_4",
                subscriptionId: null,
                customerId: "cus_1",
                revokeBenefits: true,
            },
        } as never);
        await polarWebhookHandlers.onRefundCreated?.({
            data: {
                id: "refund_partial_sub",
                status: "succeeded",
                amount: 300,
                orderId: "order_sub_4",
                subscriptionId: "sub_annual_1",
                customerId: "cus_1",
                revokeBenefits: true,
            },
        } as never);

        expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual([
            "record_payment_refund",
            "record_payment_refund",
        ]);
    });

    it("keeps benefits on a full refund when the merchant chose not to revoke them", async () => {
        mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: true };

        await polarWebhookHandlers.onRefundUpdated?.({
            data: {
                id: "refund_keep",
                status: "succeeded",
                amount: 1000,
                orderId: "order_pack_5",
                subscriptionId: null,
                customerId: "cus_1",
                revokeBenefits: false,
            },
        } as never);

        expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual(["record_payment_refund"]);
    });

    it("revokes subscription benefits only for a succeeded full refund that asks Polar to revoke them", async () => {
        mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: true };

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
        expect(mocks.state.rpcCalls).toHaveLength(2);
        expect(mocks.state.events[0]).toMatchObject({
            event_name: "refund_created",
            dedupe_key: "polar:refund_created:refund_1:succeeded",
        });
    });

    it("does not downgrade a Free profile from a late subscription refund", async () => {
        mocks.state.profiles = [profile({ subscription_id: null, subscription_plan: "free" })];
        mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: true };

        await polarWebhookHandlers.onRefundCreated?.({
            data: {
                id: "refund_late",
                status: "succeeded",
                amount: 1200,
                orderId: "order_old",
                subscriptionId: "sub_old",
                customerId: "cus_1",
                revokeBenefits: true,
            },
        } as never);

        expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual(["record_payment_refund"]);
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
        expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual(["record_payment_refund"]);

        mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: true };
        await polarWebhookHandlers.onRefundUpdated?.({
            data: { ...refund, status: "succeeded" },
        } as never);
        expect(mocks.state.rpcCalls).toContainEqual({
            name: "revoke_credit_pack_purchase",
            args: { p_payment_id: "polar_ord_order_pack_2" },
        });
    });


    describe("refunds that arrive before the payment", () => {
        const refund = (overrides: Record<string, unknown> = {}) => ({
            id: "refund_early",
            orderId: "order_pack_1",
            subscriptionId: null,
            amount: 1000,
            taxAmount: 0,
            status: "succeeded",
            revokeBenefits: true,
            customerId: "cus_1",
            customer: { id: "cus_1", email: "customer@example.com" },
            metadata: {},
            ...overrides,
        });

        it("fails a succeeded refund so Polar retries until the payment exists", async () => {
            mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: false, full_refund: false };
            vi.spyOn(console, "error").mockImplementation(() => {});

            await expect(polarWebhookHandlers.onRefundCreated?.({ data: refund() } as never))
                .rejects.toThrow("payment not recorded yet");
            await expect(polarWebhookHandlers.onRefundUpdated?.({ data: refund({ revokeBenefits: false }) } as never))
                .rejects.toThrow("payment not recorded yet");

            // The refund itself was stored for the later payment.
            expect(mocks.state.rpcCalls[0]).toMatchObject({
                name: "record_payment_refund",
                args: { p_payment_id: "polar_ord_order_pack_1", p_refund_id: "refund_early" },
            });
            expect(mocks.state.events).toHaveLength(0);
        });

        it("accepts a pending refund for a payment that is not recorded yet", async () => {
            mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: false, full_refund: false };

            await polarWebhookHandlers.onRefundCreated?.({ data: refund({ status: "pending" }) } as never);

            expect(mocks.state.events).toHaveLength(1);
        });

        it("fails order.refunded while its payment is not recorded", async () => {
            mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: false, full_refund: false };
            vi.spyOn(console, "error").mockImplementation(() => {});

            await expect(polarWebhookHandlers.onOrderRefunded?.({
                data: { id: "order_pack_1", status: "refunded", totalAmount: 1000, refundedAmount: 1000, customer: { id: "cus_1" } },
            } as never)).rejects.toThrow("payment not recorded yet");
        });

        it("does not grant a credit pack for an order already fully refunded", async () => {
            mocks.state.tableRows.payment_refunds = [
                { refund_id: "refund_early", payment_id: "polar_ord_order_pack_1", status: "succeeded" },
            ];
            mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: true };

            const result = await replayPolarEvent("order.paid", paidPackOrder(), profile() as unknown as BillingProfile);

            expect(result).toEqual({ outcome: "applied", reason: "order_fully_refunded" });
            expect(mocks.state.operations).toEqual(["payments.insert", "rpc:record_payment_refund"]);
            expect(mocks.state.rpcCalls.map((call) => call.name)).not.toContain("grant_credit_pack_purchase");
        });

        it("does not grant a credit pack when Polar's order status is refunded", async () => {
            await polarWebhookHandlers.onOrderPaid?.({ data: paidPackOrder({ status: "refunded" }) } as never);

            expect(mocks.state.rpcCalls.map((call) => call.name)).not.toContain("grant_credit_pack_purchase");
        });

        it("still grants a credit pack after a partial refund", async () => {
            mocks.state.tableRows.payments = [{ payment_id: "polar_ord_order_pack_1", status: "partially_refunded" }];
            mocks.state.rpcResults.record_payment_refund = { success: true, payment_found: true, full_refund: false };

            await polarWebhookHandlers.onOrderPaid?.({ data: paidPackOrder() } as never);

            expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual([
                "record_payment_refund",
                "grant_credit_pack_purchase",
            ]);
        });

        it("records one purchase_completed event per order across redeliveries", async () => {
            await polarWebhookHandlers.onOrderPaid?.({ data: paidPackOrder() } as never);
            await polarWebhookHandlers.onOrderPaid?.({ data: paidPackOrder() } as never);

            const purchases = mocks.state.events.filter((event) => event.event_name === "purchase_completed");
            expect(purchases).toHaveLength(1);
            expect(purchases[0]).toMatchObject({ dedupe_key: "polar:purchase_completed:order_pack_1" });
        });
    });

    describe("Free profiles and unbound subscriptions (audit 2.3)", () => {
        const freeProfile = () => profile({
            subscription_id: null,
            subscription_plan: "free",
            subscription_status: "active",
            polar_product_id: null,
        });

        it("ignores a cancellation that arrives after revocation", async () => {
            mocks.state.profiles = [freeProfile()];

            await polarWebhookHandlers.onSubscriptionCanceled?.({ data: annualSubscription() } as never);

            expect(mocks.state.updates.filter((entry) => entry.table === "profiles")).toHaveLength(0);
            expect(mocks.state.events).toHaveLength(0);
            expect(mocks.state.reconciliations).toHaveLength(0);
        });

        it("does not restore a paid plan from a late uncancel", async () => {
            mocks.state.profiles = [freeProfile()];

            await polarWebhookHandlers.onSubscriptionUncanceled?.({
                data: annualSubscription({ status: "active" }),
            } as never);

            expect(mocks.state.updates).toHaveLength(0);
        });

        it("does not renew or rebind a Free profile from subscription.updated", async () => {
            mocks.state.profiles = [freeProfile()];

            await polarWebhookHandlers.onSubscriptionUpdated?.({
                data: annualSubscription({ status: "active", endsAt: null }),
            } as never);

            expect(mocks.state.rpcCalls).toHaveLength(0);
        });

        it("still activates a new subscription on a Free profile", async () => {
            mocks.state.profiles = [freeProfile()];

            await polarWebhookHandlers.onSubscriptionActive?.({
                data: annualSubscription({ id: "sub_new", status: "active" }),
            } as never);

            expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual(["activate_subscription_profile"]);
        });

        it("does not treat a null profile subscription as a wildcard for revocation", async () => {
            mocks.state.profiles = [freeProfile()];

            await polarWebhookHandlers.onSubscriptionRevoked?.({ data: annualSubscription() } as never);

            expect(mocks.state.rpcCalls).toHaveLength(0);
        });

        it("queues an unbound paid profile matched only by email whose product does not match", async () => {
            mocks.state.authUsers = [{ id: "user_1", email: "customer@example.com" }];
            mocks.state.profiles = [profile({ subscription_id: null, polar_customer_id: null, polar_product_id: "prod_other" })];

            await polarWebhookHandlers.onSubscriptionRevoked?.({
                data: annualSubscription({ customer: { id: "cus_new", email: "customer@example.com" } }),
            } as never);

            expect(mocks.state.rpcCalls).toHaveLength(0);
            expect(mocks.state.updates.filter((entry) => entry.table === "profiles")).toHaveLength(0);
            expect(mocks.state.reconciliations[0]).toMatchObject({
                event_name: "subscription.revoked",
                reason: "subscription_not_bound",
                candidate_user_id: "user_1",
            });
        });

        it("queues each renewal period of an email-matched unbound profile as its own row", async () => {
            mocks.state.authUsers = [{ id: "user_1", email: "customer@example.com" }];
            mocks.state.profiles = [profile({ subscription_id: null, polar_customer_id: null, polar_product_id: "prod_other" })];
            const renewal = (start: string) => annualSubscription({
                status: "active",
                customer: { id: "cus_new", email: "customer@example.com" },
                currentPeriodStart: new Date(start),
            });

            await polarWebhookHandlers.onSubscriptionUpdated?.({ data: renewal("2026-09-01T00:00:00.000Z") } as never);
            await polarWebhookHandlers.onSubscriptionUpdated?.({ data: renewal("2026-10-01T00:00:00.000Z") } as never);

            expect(mocks.state.reconciliations.map((row) => row.provider_object_id)).toEqual([
                "sub_annual_1:2026-09-01T00:00:00.000Z",
                "sub_annual_1:2026-10-01T00:00:00.000Z",
            ]);
            expect(mocks.state.reconciliations[0]).toMatchObject({ subscription_id: "sub_annual_1" });
        });

        it("binds and renews an unbound paid profile matched by its Polar customer ID", async () => {
            mocks.state.profiles = [profile({ subscription_id: null, polar_customer_id: "cus_1", polar_product_id: "prod_other" })];

            await polarWebhookHandlers.onSubscriptionUpdated?.({
                data: annualSubscription({ status: "active", endsAt: null }),
            } as never);

            expect(mocks.state.reconciliations).toHaveLength(0);
            const bind = mocks.state.updates.find((entry) => entry.table === "profiles");
            expect(bind?.values).toEqual({ subscription_id: "sub_annual_1", updated_at: expect.any(String) });
            expect(bind?.filters).toContainEqual(["id", "user_1"]);
            expect(mocks.state.rpcCalls).toContainEqual({
                name: "renew_subscription_credits",
                args: expect.objectContaining({ p_user_id: "user_1", p_subscription_id: "sub_annual_1" }),
            });
            expect(mocks.state.profiles[0].subscription_id).toBe("sub_annual_1");
        });

        it("binds an unbound paid profile named by checkout metadata", async () => {
            mocks.state.profiles = [profile({ subscription_id: null, polar_customer_id: null, polar_product_id: "prod_other" })];

            await polarWebhookHandlers.onSubscriptionCanceled?.({
                data: annualSubscription({
                    customer: { id: "cus_other", email: "other@example.com" },
                    metadata: { user_id: "user_1" },
                }),
            } as never);

            expect(mocks.state.reconciliations).toHaveLength(0);
            expect(mocks.state.updates.filter((entry) => entry.table === "profiles").at(-1)?.values).toMatchObject({
                subscription_status: "cancelled",
                subscription_id: "sub_annual_1",
            });
        });

        it("binds an email-matched profile when the Polar customer externalId is the profile ID", async () => {
            mocks.state.authUsers = [{ id: "user_1", email: "customer@example.com" }];
            mocks.state.profiles = [profile({ subscription_id: null, polar_customer_id: null, polar_product_id: "prod_other" })];

            await polarWebhookHandlers.onSubscriptionCanceled?.({
                data: annualSubscription({ customer: { id: "cus_new", email: "customer@example.com", externalId: "user_1" } }),
            } as never);

            expect(mocks.state.reconciliations).toHaveLength(0);
            expect(mocks.state.profiles[0].subscription_id).toBe("sub_annual_1");
        });

        it("never binds a Free profile, even by a strong identity", async () => {
            mocks.state.profiles = [{ ...freeProfile(), polar_customer_id: "cus_1" }];

            await polarWebhookHandlers.onSubscriptionRevoked?.({ data: annualSubscription() } as never);
            await polarWebhookHandlers.onSubscriptionUpdated?.({
                data: annualSubscription({ status: "active", metadata: { user_id: "user_1" } }),
            } as never);

            expect(mocks.state.updates).toHaveLength(0);
            expect(mocks.state.rpcCalls).toHaveLength(0);
            expect(mocks.state.profiles[0].subscription_id).toBeNull();
        });

        it("retries instead of overwriting when the profile was bound concurrently", async () => {
            mocks.state.profiles = [profile({ subscription_id: null, polar_customer_id: "cus_1", polar_product_id: "prod_other" })];
            // The lookup sees an unbound profile; by the time of the
            // conditional update another event has bound it.
            const originalFrom = mocks.client.from.getMockImplementation()!;
            mocks.client.from.mockImplementation((table: string) => {
                const query = originalFrom(table);
                const originalUpdate = query.update;
                query.update = vi.fn((values: Record<string, unknown>) => {
                    mocks.state.profiles[0].subscription_id = "sub_other";
                    return originalUpdate(values);
                });
                return query;
            });

            try {
                await expect(polarWebhookHandlers.onSubscriptionCanceled?.({
                    data: annualSubscription(),
                } as never)).rejects.toThrow("retry the event");
            } finally {
                mocks.client.from.mockImplementation(originalFrom);
            }
            expect(mocks.state.events).toHaveLength(0);
        });

        it("ignores events for a different subscription than the bound one", async () => {
            mocks.state.profiles = [profile({ subscription_id: "sub_current" })];

            await polarWebhookHandlers.onSubscriptionCanceled?.({ data: annualSubscription() } as never);

            expect(mocks.state.updates).toHaveLength(0);
            expect(mocks.state.reconciliations).toHaveLength(0);
        });
    });

    describe("past-due subscriptions", () => {
        it("marks a failed renewal as past_due without granting credits", async () => {
            await polarWebhookHandlers.onSubscriptionUpdated?.({
                data: annualSubscription({ status: "past_due", endsAt: null }),
            } as never);

            expect(mocks.state.rpcCalls).toHaveLength(0);
            expect(mocks.state.updates[0]).toMatchObject({
                table: "profiles",
                values: { subscription_status: "past_due", subscription_id: "sub_annual_1" },
            });
        });

        it("treats unpaid like past_due", async () => {
            await polarWebhookHandlers.onSubscriptionUpdated?.({
                data: annualSubscription({ status: "unpaid", endsAt: null }),
            } as never);

            expect(mocks.state.updates[0]?.values).toMatchObject({ subscription_status: "past_due" });
        });

        it("restores active when the retried charge succeeds within a granted period", async () => {
            mocks.state.profiles = [profile({ subscription_status: "past_due" })];
            mocks.state.rpcResults.renew_subscription_credits = {
                success: true,
                renewed: false,
                already_processed: true,
                reason: "period_already_processed",
            };
            mocks.state.rpcResults.change_subscription_plan = { success: true, changed: false, reason: "no_change" };

            await polarWebhookHandlers.onSubscriptionUpdated?.({
                data: annualSubscription({ status: "active", endsAt: null }),
            } as never);

            expect(mocks.state.updates.find((entry) => entry.table === "profiles")?.values).toMatchObject({
                subscription_status: "active",
            });
        });
    });

    describe("duplicate lifecycle deliveries", () => {
        it("records one marketing event for a redelivered cancellation", async () => {
            const payload = { data: annualSubscription({ canceledAt: new Date("2026-10-20T00:00:00.000Z") }) };

            await polarWebhookHandlers.onSubscriptionCanceled?.(payload as never);
            await polarWebhookHandlers.onSubscriptionCanceled?.(payload as never);

            expect(mocks.state.events).toHaveLength(1);
            expect(mocks.state.events[0]).toMatchObject({
                dedupe_key: "polar:subscription_canceled:sub_annual_1:2026-10-20T00:00:00.000Z",
            });
        });

        it("records one marketing event for a redelivered revocation", async () => {
            const payload = { data: annualSubscription({ status: "revoked" }) };

            await polarWebhookHandlers.onSubscriptionRevoked?.(payload as never);
            await polarWebhookHandlers.onSubscriptionRevoked?.(payload as never);

            expect(mocks.state.events).toHaveLength(1);
            expect(mocks.state.events[0]).toMatchObject({
                dedupe_key: "polar:subscription_revoked:sub_annual_1",
            });
        });
    });

    describe("admin reconciliation replay", () => {
        const forced = (overrides: Partial<TestProfile> = {}) => ({
            ...profile({ id: "user_forced", email: "forced@example.com", subscription_id: null, polar_customer_id: null }),
            ...overrides,
        }) as unknown as BillingProfile;

        it("grants an unmatched pack order to the chosen profile", async () => {
            mocks.state.profiles = [];

            const result = await replayPolarEvent(
                "order.paid",
                paidPackOrder({ customer: { id: "cus_unknown", email: "unknown@example.com" } }),
                forced(),
            );

            expect(result).toEqual({ outcome: "applied" });
            expect(mocks.state.reconciliations).toHaveLength(0);
            expect(mocks.state.rpcCalls).toContainEqual({
                name: "grant_credit_pack_purchase",
                args: { p_user_id: "user_forced", p_payment_id: "polar_ord_order_pack_1", p_credits: 5000 },
            });
        });

        it("activates an unmatched subscription for the chosen profile", async () => {
            mocks.state.profiles = [];

            const result = await replayPolarEvent(
                "subscription.active",
                JSON.parse(JSON.stringify(annualSubscription({ id: "sub_unmatched", status: "active" }))),
                forced({ subscription_plan: "free" }),
            );

            expect(result.outcome).toBe("applied");
            expect(mocks.state.rpcCalls[0]).toMatchObject({
                name: "activate_subscription_profile",
                args: { p_user_id: "user_forced", p_subscription_id: "sub_unmatched", p_next_billing_date: "2027-07-23T16:10:49.335Z" },
            });
        });

        it("lets an operator bind an unbound paid profile", async () => {
            const forcedProfile = forced({ polar_product_id: "prod_other" });
            mocks.state.profiles = [{ ...(forcedProfile as unknown as TestProfile) }];

            const result = await replayPolarEvent(
                "subscription.revoked",
                annualSubscription(),
                forcedProfile,
            );

            expect(result.outcome).toBe("applied");
            expect(mocks.state.updates[0]).toMatchObject({
                table: "profiles",
                values: { subscription_id: "sub_annual_1" },
            });
            expect(mocks.state.rpcCalls).toContainEqual({
                name: "revoke_subscription_access",
                args: { p_user_id: "user_forced", p_subscription_id: "sub_annual_1" },
            });
        });

        it("binds the subscription before the renewal and plan-change RPCs", async () => {
            const forcedProfile = forced({ polar_product_id: "prod_other" });
            mocks.state.profiles = [{ ...(forcedProfile as unknown as TestProfile) }];
            mocks.state.rpcResults.renew_subscription_credits = {
                success: true,
                renewed: false,
                already_processed: true,
                reason: "period_already_processed",
            };
            mocks.state.rpcResults.change_subscription_plan = { success: true, changed: true };

            const result = await replayPolarEvent(
                "subscription.updated",
                annualSubscription({ status: "active", endsAt: null }),
                forcedProfile,
            );

            expect(result.outcome).toBe("applied");
            expect(mocks.state.operations.indexOf("rpc:renew_subscription_credits")).toBeGreaterThan(-1);
            const bindIndex = mocks.state.updates.findIndex((entry) => entry.values.subscription_id === "sub_annual_1");
            expect(bindIndex).toBe(0);
            expect(mocks.state.rpcCalls.map((call) => call.name)).toEqual([
                "renew_subscription_credits",
                "change_subscription_plan",
            ]);
            expect(mocks.state.profiles[0].subscription_id).toBe("sub_annual_1");
        });

        it("reports a replay the RPC rejected as a mismatch as ignored", async () => {
            mocks.state.profiles = [];
            mocks.state.rpcResults.renew_subscription_credits = {
                success: true,
                renewed: false,
                reason: "subscription_mismatch",
            };

            const result = await replayPolarEvent(
                "subscription.updated",
                annualSubscription({ status: "active", endsAt: null }),
                forced({ subscription_id: "sub_annual_1" }),
            );

            expect(result).toEqual({ outcome: "ignored", reason: "subscription_mismatch" });
        });

        it("reports a plan change rejected as a mismatch as ignored", async () => {
            mocks.state.profiles = [];
            mocks.state.rpcResults.renew_subscription_credits = {
                success: true,
                renewed: false,
                already_processed: true,
                reason: "period_already_processed",
            };
            mocks.state.rpcResults.change_subscription_plan = { success: true, changed: false, reason: "subscription_mismatch" };

            const result = await replayPolarEvent(
                "subscription.updated",
                annualSubscription({ status: "active", endsAt: null }),
                forced({ subscription_id: "sub_annual_1" }),
            );

            expect(result).toEqual({ outcome: "ignored", reason: "subscription_mismatch" });
        });

        it("reports an event the replay still cannot apply", async () => {
            const result = await replayPolarEvent(
                "order.paid",
                paidPackOrder({ product: { id: "prod_unknown", name: "Mystery Product", metadata: {} } }),
                forced(),
            );

            expect(result).toEqual({ outcome: "queued", reason: "unknown_one_time_product" });
        });

        it("rejects event names it has no handler for", async () => {
            await expect(replayPolarEvent("checkout.created", {}, forced())).rejects.toThrow("Unsupported Polar event");
        });
    });

    describe("2026-10-29 billing migrations", () => {
        const readMigration = (name: string) => fs.readFileSync(
            path.resolve(process.cwd(), "../supabase/migrations", name),
            "utf8",
        );

        it("allows past_due, records resolvers and dedupes lifecycle events", () => {
            const migration = readMigration("20261029110000_billing_lifecycle_refunds_and_reconciliation.sql");

            expect(migration).toContain("check (subscription_status in ('active', 'cancelled', 'expired', 'pending', 'past_due'))");
            expect(migration).toContain("add column if not exists resolved_by uuid references auth.users(id) on delete set null");
            expect(migration).toContain("add column if not exists dedupe_key text");
            expect(migration).toContain("create unique index if not exists marketing_events_dedupe_key_uidx");
            expect(migration).toContain("on public.marketing_events (dedupe_key);");
        });

        it("keeps partial refunds partial until the pre-tax amount is refunded", () => {
            const migration = readMigration("20261029110000_billing_lifecycle_refunds_and_reconciliation.sql");

            expect(migration).toContain("create or replace function public.record_payment_refund(");
            expect(migration).toContain("v_net := greatest(v_amount - v_tax, 0);");
            expect(migration).toContain("when v_refunded > 0 then 'partially_refunded'");
            expect(migration).toContain("on conflict (refund_id) do update");
            expect(migration).toContain("text, text, numeric, numeric, text, numeric, numeric, text\n) to service_role;");
        });

        it("matches billing email only for confirmed Auth users", () => {
            const migration = readMigration("20261029110000_billing_lifecycle_refunds_and_reconciliation.sql");

            expect(migration).toContain("create or replace function public.find_billing_user_ids_by_email(");
            expect(migration).toContain("u.email_confirmed_at is not null");
            expect(migration).toContain("grant execute on function public.find_billing_user_ids_by_email(text)\n  to service_role;");
        });

        it("keeps an existing Polar customer ID on activation", () => {
            const migration = readMigration("20261029110000_billing_lifecycle_refunds_and_reconciliation.sql");

            expect(migration).toContain("polar_customer_id = coalesce(\n      nullif(trim(coalesce(p_polar_customer_id, '')), ''),\n      polar_customer_id\n    ),");
            expect(migration).toContain("uuid, text, text, text, text, text, integer, timestamptz\n) to service_role;");
        });

        it("counts only plan-source usage against the allowance, NULL as plan", () => {
            const migration = readMigration("20261029110100_count_plan_usage_by_credit_source.sql");

            expect(migration).toContain("add column if not exists credit_source text;");
            expect(migration).toContain("select r.status, r.expires_at, r.credit_source");
            expect(migration.match(/and coalesce\(ul\.credit_source, 'plan'\) = 'plan';/g)).toHaveLength(2);
            expect(migration).toContain("where coalesce(ul.credit_source, 'plan') = 'plan'");
            expect(migration).toContain("create or replace function public.reserve_credit(");
            expect(migration).toContain("create or replace function public.finalize_credit_reservation(");
            expect(migration).toContain("create or replace function public.change_subscription_plan(");
            expect(migration).toContain("grant execute on function public.reserve_credit(uuid, integer)");
            expect(migration).toContain("grant execute on function public.finalize_credit_reservation(uuid, text, text)");
        });

        it("refills annual plans 11 times between yearly renewals", () => {
            const migration = readMigration("20261029110200_annual_drip_twelve_allowances.sql");

            expect(migration).toContain("create or replace function public.renew_paid_monthly_credits()");
            expect(migration).toContain("p.next_billing_date - interval '1 year' as period_start");
            expect(migration).toContain("and s.months_elapsed between 1 and 11");
            expect(migration).toContain("< s.period_start + make_interval(months => s.months_elapsed)");
            expect(migration).not.toContain("'past_due'");
        });
    });
});
