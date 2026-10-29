export type BillingCycle = "monthly" | "annual";

export type SubscriptionPlan = {
  id: "free" | "tier1" | "tier2" | "tier3" | "tier4";
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  annualMonthlyPrice: string;
  creditCount: number;
  credits: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export type CreditPack = {
  id: "small_pack" | "credit_pack" | "bulk_pack";
  name: string;
  price: string;
  creditCount: number;
  features: string[];
};

// Public catalogue for new purchases (2026-10 pricing). Annual billing is ten
// times the monthly price. The retired Pro plan (tier3) is not sold; existing
// subscribers keep their original price and allowance.
const SHARED_PLAN_FEATURES = [
  "Every plugin feature included",
  "Bulk, WooCommerce and context-aware workflows",
  "Email support",
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    annualMonthlyPrice: "$0",
    creditCount: 15,
    credits: "15 credits / month",
    features: ["150 bonus credits on signup — never expire", "WordPress plugin included", "No credit card"],
    cta: "Start with 150 credits",
  },
  {
    id: "tier1",
    name: "Starter",
    monthlyPrice: "$5",
    annualPrice: "$50",
    annualMonthlyPrice: "$4.17",
    creditCount: 500,
    credits: "500 credits / month",
    features: SHARED_PLAN_FEATURES,
    cta: "Choose Starter",
  },
  {
    id: "tier2",
    name: "Growth",
    monthlyPrice: "$12",
    annualPrice: "$120",
    annualMonthlyPrice: "$10",
    creditCount: 1500,
    credits: "1,500 credits / month",
    features: SHARED_PLAN_FEATURES,
    cta: "Choose Growth",
    featured: true,
  },
  {
    id: "tier4",
    name: "Agency",
    monthlyPrice: "$29",
    annualPrice: "$290",
    annualMonthlyPrice: "$24.17",
    creditCount: 5000,
    credits: "5,000 credits / month",
    features: SHARED_PLAN_FEATURES,
    cta: "Choose Agency",
  },
];

// Polar is the merchant of record and adds tax at checkout by country.
export const PRICE_TAX_NOTE = "Prices are in US dollars. VAT, GST or sales tax may be added at checkout, depending on your country.";

const PACK_FEATURES = ["Credits never expire", "Available on every plan, including Free"];

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "small_pack",
    name: "Small Credit Pack",
    price: "$12",
    creditCount: 1000,
    features: ["1,000 credits", ...PACK_FEATURES],
  },
  {
    id: "credit_pack",
    name: "Library Pack",
    price: "$45",
    creditCount: 5000,
    features: ["5,000 credits", ...PACK_FEATURES],
  },
  {
    id: "bulk_pack",
    name: "Bulk Pack",
    price: "$99",
    creditCount: 15000,
    features: ["15,000 credits", ...PACK_FEATURES],
  },
];

export function getSubscriptionPlan(planId: string): SubscriptionPlan | undefined {
  const normalizedId = planId.replace(/_(monthly|annual)$/, "");
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === normalizedId);
}

export function getCreditPack(planId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === planId);
}

export function getPurchaseOption(planId: string): SubscriptionPlan | CreditPack | undefined {
  return getSubscriptionPlan(planId) || getCreditPack(planId);
}

const LEGACY_PLAN_NAMES: Record<string, string> = {
  tier1: "Lite",
  tier2: "Standard",
  tier3: "Pro",
  tier4: "Agency",
  lite: "Lite",
  standard: "Standard",
  pro: "Pro",
  agency: "Agency",
};

const ONE_TIME_PLAN_LABELS: Record<string, string> = {
  small_pack: "Credit Pack",
  credit_pack: "Credit Pack",
  bulk_pack: "Credit Pack",
  pay_as_go: "Credit Pack",
};

/**
 * Display name for an account's plan. Subscribers who kept a pre-2026-10
 * allowance (pinned on their profile) see their original plan name, so a
 * $4 Lite customer is not shown "Starter" next to Starter's 500 credits.
 */
export function getPlanDisplayName(planId: string, monthlyCreditAllowance?: number | null): string {
  const normalized = String(planId || "free").trim().toLowerCase();
  if (normalized === "free") return "Free";
  if (ONE_TIME_PLAN_LABELS[normalized]) return ONE_TIME_PLAN_LABELS[normalized];

  const current = SUBSCRIPTION_PLANS.find((plan) => plan.id === normalized);
  const allowance = Number(monthlyCreditAllowance || 0);
  const keepsCatalogueAllowance = !allowance || allowance === current?.creditCount;

  if (current && keepsCatalogueAllowance) return current.name;
  return LEGACY_PLAN_NAMES[normalized] || normalized.replace(/_/g, " ");
}

export const SIGNUP_BONUS_CREDITS = 150;

export type PackSuggestion = {
  /** Credits still needed after the sign-up bonus. */
  creditsNeeded: number;
  packs: Array<{ pack: CreditPack; count: number }>;
  totalPrice: number;
  /** Credits left over after the images are done. */
  leftover: number;
};

function packPriceValue(pack: CreditPack) {
  return Number(pack.price.replace(/[^0-9.]/g, ""));
}

/**
 * The cheapest mix of credit packs that, with the sign-up bonus, covers a
 * one-time library of `images` images (1 credit each).
 */
export function suggestCreditPacks(images: number): PackSuggestion {
  const creditsNeeded = Math.max(0, Math.ceil(images) - SIGNUP_BONUS_CREDITS);
  const packs = [...CREDIT_PACKS].sort((a, b) => b.creditCount - a.creditCount);
  let best: PackSuggestion = { creditsNeeded, packs: [], totalPrice: 0, leftover: SIGNUP_BONUS_CREDITS - Math.min(SIGNUP_BONUS_CREDITS, Math.ceil(images)) };
  if (creditsNeeded === 0) return best;

  const [large, medium, small] = packs;
  let bestPrice = Infinity;
  for (let l = 0; l <= Math.ceil(creditsNeeded / large.creditCount); l += 1) {
    const afterLarge = Math.max(0, creditsNeeded - l * large.creditCount);
    for (let m = 0; m <= Math.ceil(afterLarge / medium.creditCount); m += 1) {
      const afterMedium = Math.max(0, afterLarge - m * medium.creditCount);
      const s = Math.ceil(afterMedium / small.creditCount);
      const price = l * packPriceValue(large) + m * packPriceValue(medium) + s * packPriceValue(small);
      const credits = l * large.creditCount + m * medium.creditCount + s * small.creditCount;
      if (price < bestPrice) {
        bestPrice = price;
        best = {
          creditsNeeded,
          packs: [
            { pack: large, count: l },
            { pack: medium, count: m },
            { pack: small, count: s },
          ].filter((entry) => entry.count > 0),
          totalPrice: price,
          leftover: credits - creditsNeeded,
        };
      }
    }
  }
  return best;
}
