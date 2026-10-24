export type PolarBillingCycle = "monthly" | "annual";

// Products currently on sale. Legacy products (pre-2026-10 prices and the
// retired Pro plan) are resolved for renewals in polar-plan-mapping.ts but are
// deliberately absent here so new checkouts cannot be created for them.
function getPolarProductIds() {
  return {
    tier1_monthly: process.env.NEXT_PUBLIC_POLAR_TIER1_MONTHLY || "",
    tier1_annual: process.env.NEXT_PUBLIC_POLAR_TIER1_ANNUAL || "",
    tier2_monthly: process.env.NEXT_PUBLIC_POLAR_TIER2_MONTHLY || "",
    tier2_annual: process.env.NEXT_PUBLIC_POLAR_TIER2_ANNUAL || "",
    tier4_monthly: process.env.NEXT_PUBLIC_POLAR_TIER4_MONTHLY || "",
    tier4_annual: process.env.NEXT_PUBLIC_POLAR_TIER4_ANNUAL || "",
    small_pack: process.env.NEXT_PUBLIC_POLAR_SMALL_PACK || "",
    credit_pack: process.env.NEXT_PUBLIC_POLAR_CREDIT_PACK || "",
    bulk_pack: process.env.NEXT_PUBLIC_POLAR_BULK_PACK || "",
  } as const;
}

export const CREDIT_PACK_PLAN_IDS = ["small_pack", "credit_pack", "bulk_pack"] as const;

export function getPolarProductId(
  planId: string,
  billingCycle: PolarBillingCycle | string = "monthly",
): string {
  const productIds = getPolarProductIds();

  if (/^tier[124]_(monthly|annual)$/.test(planId)) {
    return productIds[planId as keyof typeof productIds];
  }

  if ((CREDIT_PACK_PLAN_IDS as readonly string[]).includes(planId)) {
    return productIds[planId as keyof typeof productIds];
  }

  if (["tier1", "tier2", "tier4"].includes(planId)) {
    const cycle = billingCycle === "annual" ? "annual" : "monthly";
    return productIds[`${planId}_${cycle}` as keyof typeof productIds];
  }

  return "";
}

export function getConfiguredPolarProductIds(): Set<string> {
  return new Set(Object.values(getPolarProductIds()).filter(Boolean));
}

export function getCreditPackProductIds(): Set<string> {
  return new Set(CREDIT_PACK_PLAN_IDS.map((planId) => getPolarProductId(planId)).filter(Boolean));
}
