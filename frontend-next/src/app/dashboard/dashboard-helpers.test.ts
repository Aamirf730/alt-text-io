import { afterEach, describe, expect, it, vi } from "vitest";

import {
    emailsMatch,
    fetchUsageStats,
    formatRelativeTime,
    formatSiteUrl,
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
