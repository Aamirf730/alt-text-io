const ELIGIBLE_PLANS = new Set([
    "free",
    "tier1",
    "tier2",
    "tier3",
    "tier4",
    // These aliases are still accepted for established accounts.
    "lite",
    "standard",
    "pro",
    "agency",
]);
const ELIGIBLE_SUBSCRIPTION_STATUSES = new Set(["active", "cancelled", "canceled"]);

export type CreditPackProfile = {
    subscription_plan?: unknown;
    subscription_status?: unknown;
};

/**
 * One-time credit packs are open to every account in good standing, including
 * Free. Pack credits are persistent and are spent after the monthly allowance.
 */
export function isCreditPackEligible(
    profile: CreditPackProfile | null | undefined,
): boolean {
    const plan = String(profile?.subscription_plan || "").trim().toLowerCase();
    const status = String(profile?.subscription_status || "").trim().toLowerCase();

    return ELIGIBLE_PLANS.has(plan) && ELIGIBLE_SUBSCRIPTION_STATUSES.has(status);
}
