const PAID_SUBSCRIPTION_PLANS = new Set([
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

export type CreditPackSubscriberProfile = {
    subscription_plan?: unknown;
    subscription_status?: unknown;
    billing_cycle?: unknown;
};

export function isCreditPackEligibleSubscriber(
    profile: CreditPackSubscriberProfile | null | undefined,
): boolean {
    const plan = String(profile?.subscription_plan || "").trim().toLowerCase();
    const status = String(profile?.subscription_status || "").trim().toLowerCase();
    const billingCycle = String(profile?.billing_cycle || "").trim().toLowerCase();

    return (
        PAID_SUBSCRIPTION_PLANS.has(plan) &&
        ELIGIBLE_SUBSCRIPTION_STATUSES.has(status) &&
        (billingCycle === "monthly" || billingCycle === "annual")
    );
}
