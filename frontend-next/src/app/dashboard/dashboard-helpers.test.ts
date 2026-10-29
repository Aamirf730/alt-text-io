import { afterEach, describe, expect, it, vi } from "vitest";

import {
    emailsMatch,
    fetchUsageStats,
    formatRelativeTime,
    formatSiteUrl,
    addMonthsClamped,
    getAnnualNextRefillDate,
    getBillingSummary,
    getFreeRefillDate,
    getHistoryPageRange,
    getHistoryPageSummary,
    hasNextHistoryPage,
    snapshotFromUsage,
} from "./dashboard-helpers";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetchUsageStats", () => {
    it("reports an expired session separately from other failures", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 })));
        await expect(fetchUsageStats("/api", "token")).resolves.toEqual({ status: "unauthorized" });
    });

    it("never turns a failure into zero credits on the Free plan", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
        const result = await fetchUsageStats("/api", "token");
        expect(result.status).toBe("error");
        expect(result).not.toHaveProperty("stats");

        vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
        expect((await fetchUsageStats("/api", "token")).status).toBe("error");
    });

    it("maps a successful response", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
            success: true,
            data: { credits_remaining: 42, subscription_plan: "starter", plugin_connected: true, total_generated: 7 },
        }), { status: 200 })));
        const result = await fetchUsageStats("/api", "token");
        expect(result.status).toBe("ok");
        if (result.status === "ok") {
            expect(result.stats.credits_remaining).toBe(42);
            expect(result.stats.plan).toBe("starter");
            expect(result.stats.plugin_connected).toBe(true);
            expect(result.stats.total_generated).toBe(7);
        }
    });
});

describe("snapshotFromUsage", () => {
    it("captures the fields that change after a purchase", () => {
        expect(snapshotFromUsage({
            plan: "free",
            subscription_status: "active",
            credits_remaining: 10,
            purchased_credits_remaining: 0,
            monthly_credit_limit: 15,
            monthly_credit_allowance: null,
        })).toEqual({ plan: "free", status: "active", creditsRemaining: 10, purchasedCredits: 0, monthlyLimit: 15 });
    });
});

describe("generation history paging", () => {
    it("pages 20 rows at a time", () => {
        expect(getHistoryPageRange(0)).toEqual([0, 19]);
        expect(getHistoryPageRange(2)).toEqual([40, 59]);
        expect(getHistoryPageRange(-1)).toEqual([0, 19]);
    });

    it("knows when there is a next page", () => {
        expect(hasNextHistoryPage(0, 20, 45)).toBe(true);
        expect(hasNextHistoryPage(2, 5, 45)).toBe(false);
        expect(hasNextHistoryPage(0, 20, 20)).toBe(false);
        expect(hasNextHistoryPage(0, 20, null)).toBe(true);
        expect(hasNextHistoryPage(0, 12, null)).toBe(false);
    });

    it("summarises the visible rows", () => {
        expect(getHistoryPageSummary(1, 20, 45)).toBe("Showing 21–40 of 45");
        expect(getHistoryPageSummary(0, 0, 0)).toBe("No generations");
    });
});

describe("connected site formatting", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");

    it("formats last-seen times", () => {
        expect(formatRelativeTime("2026-10-26T12:00:00Z", now, "en")).toBe("3 days ago");
        expect(formatRelativeTime("2026-10-29T11:59:30Z", now, "en")).toBe("just now");
        expect(formatRelativeTime(null, now, "en")).toBe("never");
        expect(formatRelativeTime("not a date", now, "en")).toBe("never");
    });

    it("shows the site without its protocol", () => {
        expect(formatSiteUrl("https://example.com/")).toBe("example.com");
        expect(formatSiteUrl("https://example.com/blog/")).toBe("example.com/blog");
        expect(formatSiteUrl("weird")).toBe("weird");
    });
});

describe("emailsMatch", () => {
    it("requires the account email, ignoring case and spaces", () => {
        expect(emailsMatch(" Me@Example.com ", "me@example.com")).toBe(true);
        expect(emailsMatch("other@example.com", "me@example.com")).toBe(false);
        expect(emailsMatch("me@example.com", null)).toBe(false);
    });
});

describe("getFreeRefillDate", () => {
    it("is 30 days after the last refill", () => {
        expect(getFreeRefillDate("2026-10-01T02:00:00.000Z")?.toISOString()).toBe("2026-10-31T02:00:00.000Z");
    });

    it("is null when the cycle start is unknown", () => {
        expect(getFreeRefillDate(null)).toBeNull();
        expect(getFreeRefillDate("not a date")).toBeNull();
    });
});

describe("billing summary", () => {
    const formatDate = (value: Date) => value.toISOString().slice(0, 10);
    const now = new Date("2026-10-29T12:00:00Z");

    it("clamps month ends like Postgres", () => {
        expect(addMonthsClamped(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    });

    it("finds an annual plan's next monthly refill from its renewal date", () => {
        // Period started 2026-03-15; month 7 began 2026-10-15, so month 8 is next.
        expect(getAnnualNextRefillDate("2027-03-15T00:00:00Z", now)?.toISOString()).toBe("2026-11-15T00:00:00.000Z");
        // In the last month the next credits come with the renewal.
        expect(getAnnualNextRefillDate("2026-11-10T00:00:00Z", now)?.toISOString()).toBe("2026-11-10T00:00:00.000Z");
    });

    it("labels a monthly renewal, an annual plan, a cancellation and a failed payment", () => {
        const base = { plan: "tier2", creditsLastRenewedAt: null, formatDate, now };
        expect(getBillingSummary({ ...base, status: "active", billingCycle: "monthly", nextBillingDate: "2026-11-20T00:00:00Z" }).title)
            .toBe("Renews on 2026-11-20");
        expect(getBillingSummary({ ...base, status: "active", billingCycle: "annual", nextBillingDate: "2027-03-15T00:00:00Z" }))
            .toMatchObject({ title: "Renews yearly on 2027-03-15", detail: "Next monthly credits on 2026-11-15." });
        expect(getBillingSummary({ ...base, status: "cancelled", billingCycle: "monthly", nextBillingDate: "2026-11-20T00:00:00Z" }).title)
            .toBe("Ends on 2026-11-20");
        expect(getBillingSummary({ ...base, status: "past_due", billingCycle: "monthly", nextBillingDate: "2026-10-20T00:00:00Z" }))
            .toMatchObject({ title: "Renewal payment failed", tone: "warning" });
    });

    it("keeps the free refill wording for free and credit-pack accounts", () => {
        expect(getBillingSummary({
            plan: "free", status: null, billingCycle: null, nextBillingDate: null,
            creditsLastRenewedAt: "2026-10-01T00:00:00Z", formatDate, now,
        }).title).toBe("Free credits refill around 2026-10-31");
    });
});

