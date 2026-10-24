const DEFAULT_SUBSCRIPTION_PLAN = 'free';

// Function-side fallbacks mirror the public pricing catalogue. Database plan
// rows remain authoritative whenever the database lookup succeeds, and a
// pinned profile monthly_credit_allowance overrides both for legacy
// subscribers. The lite/standard/pro/agency aliases are pre-2026-10 names.
const SUBSCRIPTION_PLAN_CREDITS = Object.freeze({
  free: 15,
  tier1: 500,
  tier2: 1500,
  tier3: 2000,
  tier4: 5000,
  lite: 150,
  standard: 1000,
  pro: 2000,
  agency: 3500,
});

function getPlanCredits(planId, fallback = SUBSCRIPTION_PLAN_CREDITS[DEFAULT_SUBSCRIPTION_PLAN]) {
  const normalizedPlan = String(planId || DEFAULT_SUBSCRIPTION_PLAN).trim().toLowerCase();
  return SUBSCRIPTION_PLAN_CREDITS[normalizedPlan] ?? fallback;
}

module.exports = {
  DEFAULT_SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLAN_CREDITS,
  getPlanCredits,
};
