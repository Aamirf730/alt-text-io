const SUBSCRIPTION_PLAN_MATCHERS: Array<{ planId: string; terms: string[] }> = [
  { planId: "tier1", terms: ["tier1", "tier_1", "lite"] },
  { planId: "tier2", terms: ["tier2", "tier_2", "standard"] },
  { planId: "tier4", terms: ["tier4", "tier_4", "agency"] },
  { planId: "tier3", terms: ["tier3", "tier_3", "pro"] },
];

export type PolarBillingCycle = "monthly" | "annual";

type PolarProductMatch = {
  planId: string;
  billingCycle: PolarBillingCycle;
};

const CONFIGURED_PRODUCT_ENV: Array<{ env: string; planId: string; billingCycle: PolarBillingCycle }> = [
  { env: "NEXT_PUBLIC_POLAR_TIER1_MONTHLY", planId: "tier1", billingCycle: "monthly" },
  { env: "NEXT_PUBLIC_POLAR_TIER1_ANNUAL", planId: "tier1", billingCycle: "annual" },
  { env: "NEXT_PUBLIC_POLAR_TIER2_MONTHLY", planId: "tier2", billingCycle: "monthly" },
  { env: "NEXT_PUBLIC_POLAR_TIER2_ANNUAL", planId: "tier2", billingCycle: "annual" },
  { env: "NEXT_PUBLIC_POLAR_TIER3_MONTHLY", planId: "tier3", billingCycle: "monthly" },
  { env: "NEXT_PUBLIC_POLAR_TIER3_ANNUAL", planId: "tier3", billingCycle: "annual" },
  { env: "NEXT_PUBLIC_POLAR_TIER4_MONTHLY", planId: "tier4", billingCycle: "monthly" },
  { env: "NEXT_PUBLIC_POLAR_TIER4_ANNUAL", planId: "tier4", billingCycle: "annual" },
  { env: "NEXT_PUBLIC_POLAR_SMALL_PACK", planId: "small_pack", billingCycle: "monthly" },
  { env: "NEXT_PUBLIC_POLAR_CREDIT_PACK", planId: "credit_pack", billingCycle: "monthly" },
];

type PolarMetadata = Record<string, string | number | boolean | null | undefined>;

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "_");
}

function getConfiguredProductMatch(productId: string | null | undefined): PolarProductMatch | null {
  if (!productId) return null;

  const configured = CONFIGURED_PRODUCT_ENV.find(({ env }) => process.env[env] === productId);
  return configured
    ? { planId: configured.planId, billingCycle: configured.billingCycle }
    : null;
}

function getMetadataString(metadata: PolarMetadata = {}, keys: string[]): string | null {
  for (const key of keys) {
    const raw = metadata[key];
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }

  return null;
}

function matchPlanId(value: string): string | null {
  const normalized = normalizeValue(value);

  const hasTerm = (term: string) => {
    const normalizedTerm = normalizeValue(term);
    return normalized === normalizedTerm
      || normalized.startsWith(`${normalizedTerm}_`)
      || normalized.endsWith(`_${normalizedTerm}`)
      || normalized.includes(`_${normalizedTerm}_`);
  };

  for (const matcher of SUBSCRIPTION_PLAN_MATCHERS) {
    if (matcher.terms.some(hasTerm)) {
      return matcher.planId;
    }
  }

  // Keep the name fallback deliberately narrow. A generic `pack` or `credit`
  // substring is not enough evidence to grant a paid credit pack.
  if (
    normalized === "small_pack"
    || normalized === "small_credit_pack"
    || normalized.endsWith("_small_pack")
    || normalized.endsWith("_small_credit_pack")
  ) {
    return "small_pack";
  }

  if (
    normalized === "credit_pack"
    || normalized === "large_pack"
    || normalized === "large_credit_pack"
    || normalized.endsWith("_credit_pack")
    || normalized.endsWith("_large_pack")
    || normalized.endsWith("_large_credit_pack")
  ) {
    return "credit_pack";
  }

  if (normalized === "free") return "free";

  return null;
}

export function resolvePolarPlanId(
  productName: string,
  metadata: PolarMetadata = {},
  productId?: string | null,
): string {
  const metadataProductId = getMetadataString(metadata, [
    "product_id",
    "productId",
    "polar_product_id",
    "polarProductId",
  ]);
  const configuredProduct = getConfiguredProductMatch(productId || metadataProductId);
  if (configuredProduct) return configuredProduct.planId;

  const explicitPlan = getMetadataString(metadata, [
    "plan_id",
    "planId",
    "plan",
    "slug",
    "product_slug",
    "productSlug",
    "tier",
  ]);

  if (explicitPlan) {
    const matchedFromMetadata = matchPlanId(explicitPlan);
    if (matchedFromMetadata) return matchedFromMetadata;
  }

  const matchedFromName = matchPlanId(productName);
  if (matchedFromName) return matchedFromName;

  return "free";
}

export function resolvePolarBillingCycle(
  productName: string,
  metadata: PolarMetadata = {},
  productId?: string | null,
): PolarBillingCycle {
  const metadataProductId = getMetadataString(metadata, [
    "product_id",
    "productId",
    "polar_product_id",
    "polarProductId",
  ]);
  const configuredProduct = getConfiguredProductMatch(productId || metadataProductId);
  if (configuredProduct) return configuredProduct.billingCycle;

  const explicitCycle = getMetadataString(metadata, [
    "billing_cycle",
    "billingCycle",
    "interval",
    "cycle",
    "plan_id",
    "planId",
    "plan",
    "slug",
  ]);
  if (explicitCycle) {
    const normalizedCycle = normalizeValue(explicitCycle);
    if (normalizedCycle === "annual" || normalizedCycle.endsWith("_annual")) return "annual";
    if (normalizedCycle === "monthly" || normalizedCycle.endsWith("_monthly")) return "monthly";
  }

  const normalizedProductId = productId ? normalizeValue(productId) : "";
  if (normalizedProductId.split("_").includes("annual")) return "annual";

  const normalizedName = normalizeValue(productName);
  return normalizedName.split("_").includes("annual") ? "annual" : "monthly";
}

export function isPolarSubscriptionProduct(
  productName: string,
  metadata: PolarMetadata = {},
  productId?: string | null,
): boolean {
  if (metadata.type === "subscription") return true;

  const planId = resolvePolarPlanId(productName, metadata, productId);
  return planId === "tier1" || planId === "tier2" || planId === "tier3" || planId === "tier4";
}
