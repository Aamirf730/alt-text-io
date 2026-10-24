export function getUsageDisplayLimit(
  planAllowance: number,
  creditsRemaining: number,
  creditsUsed: number,
): number {
  const normalizedPlanAllowance = Math.max(0, planAllowance);

  // Every plan can hold persistent bonus or credit-pack credits on top of the
  // monthly allowance, and this cycle's usage counts credits from all of
  // them. Use what was used plus what is still spendable as the denominator
  // so the bar never reads "600 of 500" while credits remain.
  return Math.max(
    normalizedPlanAllowance,
    Math.max(0, creditsRemaining) + Math.max(0, creditsUsed),
  );
}
