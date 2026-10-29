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
    credits_last_renewed_at?: string | null;
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
        credits_last_renewed_at: data.credits_last_renewed_at || null,
    };
}

export const FREE_REFILL_DAYS = 30;

/**
 * When the next Free refill is due: a daily job adds the free credits once the
 * last refill is 30 days old. Null when the start of the cycle is unknown.
 */
export function getFreeRefillDate(lastRenewedAt: string | null | undefined): Date | null {
    if (!lastRenewedAt) return null;
    const last = Date.parse(lastRenewedAt);
    if (!Number.isFinite(last)) return null;
    return new Date(last + FREE_REFILL_DAYS * 24 * 60 * 60 * 1000);
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

/** Adds calendar months, clamping to the month's last day like Postgres does. */
export function addMonthsClamped(date: Date, months: number): Date {
    const result = new Date(date.getTime());
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
}

/** Whole calendar months from start to now, like Postgres age(). */
function wholeMonthsBetween(start: Date, now: Date): number {
    let months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
    if (addMonthsClamped(start, months).getTime() > now.getTime()) months -= 1;
    return months;
}

/**
 * When an annual plan's next monthly credits arrive. The daily job grants
 * month n at (period start + n months), where the period starts a year
 * before next_billing_date; after month 11 the next grant is the renewal.
 */
export function getAnnualNextRefillDate(nextBillingDate: string | null | undefined, now = new Date()): Date | null {
    if (!nextBillingDate) return null;
    const renewal = new Date(nextBillingDate);
    if (!Number.isFinite(renewal.getTime()) || renewal.getTime() <= now.getTime()) return null;
    const periodStart = addMonthsClamped(renewal, -12);
    const elapsed = Math.max(0, wholeMonthsBetween(periodStart, now));
    if (elapsed + 1 >= 12) return renewal;
    return addMonthsClamped(periodStart, elapsed + 1);
}

export type BillingSummary = { title: string; detail: string; tone: "normal" | "warning" };

const ONE_TIME_PLANS = new Set(["free", "small_pack", "credit_pack", "bulk_pack", "pay_as_go"]);

/** The plan line in the dashboard: renews, ends, refills, or payment failed. */
export function getBillingSummary({
    plan,
    status,
    billingCycle,
    nextBillingDate,
    creditsLastRenewedAt,
    formatDate,
    now = new Date(),
}: {
    plan: string;
    status: string | null | undefined;
    billingCycle: string | null | undefined;
    nextBillingDate: string | null | undefined;
    creditsLastRenewedAt: string | null | undefined;
    formatDate: (value: Date) => string;
    now?: Date;
}): BillingSummary {
    const normalizedStatus = String(status || "").toLowerCase();

    if (ONE_TIME_PLANS.has(plan)) {
        const refill = getFreeRefillDate(creditsLastRenewedAt);
        return {
            title: refill ? `Free credits refill around ${formatDate(refill)}` : "Free credits refill every 30 days",
            detail: "Bonus and credit pack credits never expire.",
            tone: "normal",
        };
    }

    if (normalizedStatus === "past_due") {
        return {
            title: "Renewal payment failed",
            detail: "Update your card in Billing & receipts. Polar retries the charge, and your plan stays active meanwhile.",
            tone: "warning",
        };
    }

    const renewal = nextBillingDate ? new Date(nextBillingDate) : null;
    const hasRenewalDate = Boolean(renewal && Number.isFinite(renewal.getTime()));

    if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") {
        if (hasRenewalDate && renewal!.getTime() > now.getTime()) {
            return {
                title: `Ends on ${formatDate(renewal!)}`,
                detail: "Cancelled: no further charges. Your plan and its credits stay until then.",
                tone: "normal",
            };
        }
        return { title: "Plan ended", detail: "Your credit packs and bonus credits still work.", tone: "normal" };
    }

    if (!hasRenewalDate) {
        return { title: "Billing date unavailable", detail: "Billing & receipts shows your next charge.", tone: "normal" };
    }

    if (billingCycle === "annual") {
        const nextRefill = getAnnualNextRefillDate(nextBillingDate, now);
        return {
            title: `Renews yearly on ${formatDate(renewal!)}`,
            detail: nextRefill && nextRefill.getTime() < renewal!.getTime()
                ? `Next monthly credits on ${formatDate(nextRefill)}.`
                : "Your next monthly credits come with the renewal.",
            tone: "normal",
        };
    }

    return {
        title: `Renews on ${formatDate(renewal!)}`,
        detail: "Your monthly credits refill when the plan renews.",
        tone: "normal",
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
