const SUBSCRIPTION_PLAN_MATCHERS: Array<{ planId: string; terms: string[] }> = [
  { planId: "tier1", terms: ["tier1", "tier_1", "lite"] },
  { planId: "tier2", terms: ["tier2", "tier_2", "standard"] },
  { planId: "tier4", terms: ["tier4", "tier_4", "agency"] },
  { planId: "tier3", terms: ["tier3", "tier_3", "pro"] },
];

const ONE_TIME_PLAN_MATCHERS: Array<{ planId: string; terms: string[] }> = [
  { planId: "small_pack", terms: ["small_pack", "small pack", "small"] },
  { planId: "credit_pack", terms: ["credit_pack", "credit pack", "credit", "pack"] },
];

type PolarMetadata = Record<string, string | number | boolean | null | undefined>;

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "_");
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

  for (const matcher of SUBSCRIPTION_PLAN_MATCHERS) {
    if (matcher.terms.some(term => normalized.includes(normalizeValue(term)))) {
      return matcher.planId;
    }
  }

  for (const matcher of ONE_TIME_PLAN_MATCHERS) {
    if (matcher.terms.some(term => normalized.includes(normalizeValue(term)))) {
      return matcher.planId;
    }
  }

  if (normalized === "free") return "free";

  return null;
}

export function resolvePolarPlanId(
  productName: string,
  metadata: PolarMetadata = {}
): string {
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

export function isPolarSubscriptionProduct(
  productName: string,
  metadata: PolarMetadata = {}
): boolean {
  if (metadata.type === "subscription") return true;

  const planId = resolvePolarPlanId(productName, metadata);
  return planId === "tier1" || planId === "tier2" || planId === "tier3" || planId === "tier4";
}
