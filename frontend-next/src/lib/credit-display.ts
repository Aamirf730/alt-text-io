export function getUsageDisplayLimit(
  plan: string,
  planAllowance: number,
  creditsRemaining: number,
  creditsUsed: number,
): number {
  const normalizedPlanAllowance = Math.max(0, planAllowance);
  if (plan !== "free") return normalizedPlanAllowance;

  // Free accounts receive a monthly plan allowance plus persistent bonus
  // credits. Include both in the usage denominator so the progress bar and
  // status text do not imply that the bonus balance is unavailable.
  return Math.max(
    normalizedPlanAllowance,
    Math.max(0, creditsRemaining) + Math.max(0, creditsUsed),
  );
}
