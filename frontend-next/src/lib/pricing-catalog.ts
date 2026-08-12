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
  id: "small_pack" | "credit_pack";
  name: string;
  price: string;
  creditCount: number;
  features: string[];
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    annualMonthlyPrice: "$0",
    creditCount: 15,
    credits: "15 credits every month",
    features: ["150 bonus credits on signup — never expire", "WordPress plugin included", "No credit card"],
    cta: "Start with 150 credits",
  },
  {
    id: "tier1",
    name: "Lite",
    monthlyPrice: "$4",
    annualPrice: "$43.20",
    annualMonthlyPrice: "$3.60",
    creditCount: 150,
    credits: "150 credits every month",
    features: ["Auto-generate on upload", "Single-image workflow", "Email support"],
    cta: "Choose Lite",
  },
  {
    id: "tier2",
    name: "Standard",
    monthlyPrice: "$9",
    annualPrice: "$97.20",
    annualMonthlyPrice: "$8.10",
    creditCount: 1000,
    credits: "1,000 credits every month",
    features: ["Bulk media-library fixes", "Post and page image workflows", "Email support"],
    cta: "Choose Standard",
    featured: true,
  },
  {
    id: "tier3",
    name: "Pro",
    monthlyPrice: "$14",
    annualPrice: "$151.20",
    annualMonthlyPrice: "$12.60",
    creditCount: 2000,
    credits: "2,000 credits every month",
    features: ["Context-aware generation", "WooCommerce workflows", "Custom post type support"],
    cta: "Choose Pro",
  },
  {
    id: "tier4",
    name: "Agency",
    monthlyPrice: "$19",
    annualPrice: "$205.20",
    annualMonthlyPrice: "$17.10",
    creditCount: 3500,
    credits: "3,500 credits every month",
    features: ["Multi-site friendly workflow", "Context-aware generation", "Custom post type support"],
    cta: "Choose Agency",
  },
];

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "small_pack",
    name: "Small Credit Pack",
    price: "$5",
    creditCount: 500,
    features: ["500 credits", "Credits never expire", "Works with any plan"],
  },
  {
    id: "credit_pack",
    name: "Large Credit Pack",
    price: "$10",
    creditCount: 1200,
    features: ["1,200 credits", "Credits never expire", "Works with any plan"],
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
