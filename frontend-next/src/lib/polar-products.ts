export type PolarBillingCycle = "monthly" | "annual";

function getPolarProductIds() {
  return {
    tier1_monthly: process.env.NEXT_PUBLIC_POLAR_TIER1_MONTHLY || "",
    tier1_annual: process.env.NEXT_PUBLIC_POLAR_TIER1_ANNUAL || "",
    tier2_monthly: process.env.NEXT_PUBLIC_POLAR_TIER2_MONTHLY || "",
    tier2_annual: process.env.NEXT_PUBLIC_POLAR_TIER2_ANNUAL || "",
    tier3_monthly: process.env.NEXT_PUBLIC_POLAR_TIER3_MONTHLY || "",
    tier3_annual: process.env.NEXT_PUBLIC_POLAR_TIER3_ANNUAL || "",
    tier4_monthly: process.env.NEXT_PUBLIC_POLAR_TIER4_MONTHLY || "",
    tier4_annual: process.env.NEXT_PUBLIC_POLAR_TIER4_ANNUAL || "",
    small_pack: process.env.NEXT_PUBLIC_POLAR_SMALL_PACK || "",
    credit_pack: process.env.NEXT_PUBLIC_POLAR_CREDIT_PACK || "",
  } as const;
}

export function getPolarProductId(
  planId: string,
  billingCycle: PolarBillingCycle | string = "monthly",
): string {
  const productIds = getPolarProductIds();

  if (/^tier[1-4]_(monthly|annual)$/.test(planId)) {
    return productIds[planId as keyof typeof productIds];
  }

  if (planId === "small_pack" || planId === "credit_pack") {
    return productIds[planId];
  }

  if (["tier1", "tier2", "tier3", "tier4"].includes(planId)) {
    const cycle = billingCycle === "annual" ? "annual" : "monthly";
    return productIds[`${planId}_${cycle}` as keyof typeof productIds];
  }

  return "";
}

export function getConfiguredPolarProductIds(): Set<string> {
  return new Set(Object.values(getPolarProductIds()).filter(Boolean));
}
