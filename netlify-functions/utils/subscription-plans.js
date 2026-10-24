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

// Display names. Subscribers who kept a pre-2026-10 allowance (pinned on the
// profile) keep their original plan name. Mirrors getPlanDisplayName() in
// frontend-next/src/lib/pricing-catalog.ts.
const CURRENT_PLAN_NAMES = Object.freeze({ tier1: 'Starter', tier2: 'Growth', tier4: 'Agency' });
const LEGACY_PLAN_NAMES = Object.freeze({
  tier1: 'Lite',
  tier2: 'Standard',
  tier3: 'Pro',
  tier4: 'Agency',
  lite: 'Lite',
  standard: 'Standard',
  pro: 'Pro',
  agency: 'Agency',
});
const ONE_TIME_PLANS = new Set(['small_pack', 'credit_pack', 'bulk_pack', 'pay_as_go']);

function getPlanDisplayName(planId, monthlyCreditAllowance = null) {
  const normalized = String(planId || DEFAULT_SUBSCRIPTION_PLAN).trim().toLowerCase();
  if (normalized === 'free') return 'Free';
  if (ONE_TIME_PLANS.has(normalized)) return 'Credit Pack';

  const allowance = Number(monthlyCreditAllowance || 0);
  const currentName = CURRENT_PLAN_NAMES[normalized];
  if (currentName && (!allowance || allowance === SUBSCRIPTION_PLAN_CREDITS[normalized])) {
    return currentName;
  }

  return LEGACY_PLAN_NAMES[normalized] || normalized.replace(/_/g, ' ');
}

module.exports = {
  DEFAULT_SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLAN_CREDITS,
  getPlanCredits,
  getPlanDisplayName,
};
