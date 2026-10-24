const PAID_SUBSCRIPTION_PLANS = new Set([
  "tier1",
  "tier2",
  "tier3",
  "tier4",
  // Established aliases for older accounts.
  "lite",
  "standard",
  "pro",
  "agency",
]);

// "cancelled" means a scheduled cancellation: the subscription still runs (and
// can be resumed) until the end of the paid period.
const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "cancelled", "canceled"]);

export type SubscriptionProfile = {
  subscription_plan?: unknown;
  subscription_status?: unknown;
};

export const SUBSCRIPTION_EXISTS_CODE = "subscription_exists";
export const SUBSCRIPTION_EXISTS_MESSAGE =
  "You already have a subscription. Change or resume your plan from Manage billing in your dashboard.";

/**
 * True when the account still has a running paid subscription. Such accounts
 * must change plans through the Polar customer portal; a second checkout would
 * create a parallel subscription that keeps billing.
 */
export function hasLivePaidSubscription(profile: SubscriptionProfile | null | undefined): boolean {
  const plan = String(profile?.subscription_plan || "").trim().toLowerCase();
  const status = String(profile?.subscription_status || "").trim().toLowerCase();

  return PAID_SUBSCRIPTION_PLANS.has(plan) && LIVE_SUBSCRIPTION_STATUSES.has(status);
}
