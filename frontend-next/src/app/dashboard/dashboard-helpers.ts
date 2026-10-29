import type { AccountSnapshot } from "@/lib/pending-checkout";

export type UsageStats = {
    credits_remaining: number;
    bonus_credits_remaining: number;
    purchased_credits_remaining: number;
    monthly_credits_remaining?: number;
    monthly_credit_limit?: number;
    monthly_credits_used?: number;
    total_processed: number;
    total_generated: number;
    plan: string;
    subscription_status: string | null;
    billing_cycle: string | null;
    monthly_credit_allowance: number | null;
    plugin_connected: boolean;
};

export type UsageLoadResult =
    | { status: "ok"; stats: UsageStats }
    | { status: "unauthorized" }
    | { status: "error"; message: string };

/** Maps the get-usage payload to the dashboard's usage state. */
export function mapUsageData(data: Record<string, any>): UsageStats {
    return {
        credits_remaining: data.credits_remaining || 0,
        bonus_credits_remaining: data.bonus_credits_remaining || 0,
        purchased_credits_remaining: data.purchased_credits_remaining || 0,
        monthly_credits_remaining: data.monthly_credits_remaining,
        monthly_credit_limit: data.monthly_credit_limit,
        monthly_credits_used: data.monthly_credits_used,
        total_processed: data.total_processed || data.credits_used || 0,
        // Lifetime count; total_processed is this billing cycle only.
        total_generated: Number(data.total_generated ?? 0),
        plan: data.subscription_plan || "free",
        subscription_status: data.subscription_status || null,
        billing_cycle: data.billing_cycle || null,
        monthly_credit_allowance: data.monthly_credit_allowance || null,
        plugin_connected: data.plugin_connected === true,
    };
}

/**
 * Loads usage for the dashboard. A failure is reported as such: the caller
 * must never fall back to showing 0 credits on the Free plan.
 */
export async function fetchUsageStats(apiBase: string, accessToken: string): Promise<UsageLoadResult> {
    try {
        const response = await fetch(`${apiBase}/get-usage`, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.status === 401) {
            return { status: "unauthorized" };
        }

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data) {
            return {
                status: "error",
                message: payload?.error || `We couldn't load your credits (error ${response.status}).`,
            };
        }

        return { status: "ok", stats: mapUsageData(payload.data) };
    } catch {
        return { status: "error", message: "We couldn't reach Alt Text Pro to load your credits." };
    }
}

export function snapshotFromUsage(stats: Pick<UsageStats, "plan" | "subscription_status" | "credits_remaining" | "purchased_credits_remaining" | "monthly_credit_limit" | "monthly_credit_allowance">): AccountSnapshot {
    return {
        plan: String(stats.plan || "free"),
        status: stats.subscription_status ?? null,
        creditsRemaining: Number(stats.credits_remaining) || 0,
        purchasedCredits: Number(stats.purchased_credits_remaining) || 0,
        monthlyLimit: Number(stats.monthly_credit_limit || stats.monthly_credit_allowance || 0),
    };
}

export const HISTORY_PAGE_SIZE = 20;

/** Inclusive row range for Supabase `.range()` (pages start at 0). */
export function getHistoryPageRange(page: number, pageSize = HISTORY_PAGE_SIZE): [number, number] {
    const safePage = Math.max(0, Math.floor(page));
    const from = safePage * pageSize;
    return [from, from + pageSize - 1];
}

export function hasNextHistoryPage(page: number, rowsOnPage: number, total: number | null, pageSize = HISTORY_PAGE_SIZE): boolean {
    if (typeof total === "number") {
        return (page + 1) * pageSize < total;
    }
    return rowsOnPage === pageSize;
}

export function getHistoryPageSummary(page: number, rowsOnPage: number, total: number | null, pageSize = HISTORY_PAGE_SIZE): string {
    if (rowsOnPage === 0) return "No generations";
    const first = page * pageSize + 1;
    const last = page * pageSize + rowsOnPage;
    return typeof total === "number"
        ? `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}`
        : `Showing ${first.toLocaleString()}–${last.toLocaleString()}`;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
];

/** "3 days ago", "just now"; "never" for a missing or invalid date. */
export function formatRelativeTime(value: string | null | undefined, now = Date.now(), locale?: string): string {
    if (!value) return "never";
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return "never";

    const diff = time - now;
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, size] of RELATIVE_UNITS) {
        if (Math.abs(diff) >= size) {
            return formatter.format(Math.round(diff / size), unit);
        }
    }
    return "just now";
}

/** Host and path of a WordPress site URL, without the protocol. */
export function formatSiteUrl(siteUrl: string): string {
    try {
        const url = new URL(siteUrl);
        const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
        return `${url.host}${path}`;
    } catch {
        return siteUrl;
    }
}

export function emailsMatch(typed: string, accountEmail: string | null | undefined): boolean {
    if (!accountEmail) return false;
    return typed.trim().toLowerCase() === accountEmail.trim().toLowerCase();
}
