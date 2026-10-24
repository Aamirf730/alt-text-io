import { describe, expect, it } from "vitest";

import {
  isPolarSubscriptionProduct,
  resolvePolarBillingCycle,
  resolvePolarPlanId,
} from "./polar-plan-mapping";

describe("resolvePolarPlanId", () => {
  it("maps new standard annual product names to tier2", () => {
    expect(resolvePolarPlanId("Standard Annual")).toBe("tier2");
  });

  it("maps lite and pro plan names to legacy tier ids", () => {
    expect(resolvePolarPlanId("Lite Monthly")).toBe("tier1");
    expect(resolvePolarPlanId("Pro Annual")).toBe("tier3");
  });

  it("maps Agency products before the Pro substring can match", () => {
    expect(resolvePolarPlanId("Alt Text Pro — Agency Monthly", {})).toBe("tier4");
    expect(resolvePolarPlanId("Alt Text Pro — Agency Annual", {})).toBe("tier4");
  });

  it("maps 2026-10 plan names to their tier ids", () => {
    expect(resolvePolarPlanId("Alt Text Pro — Starter Monthly")).toBe("tier1");
    expect(resolvePolarPlanId("Alt Text Pro — Growth Annual")).toBe("tier2");
  });

  it("maps one-time pack products correctly", () => {
    expect(resolvePolarPlanId("Small Pack")).toBe("small_pack");
    expect(resolvePolarPlanId("Credit Pack")).toBe("credit_pack");
    expect(resolvePolarPlanId("Library Pack")).toBe("credit_pack");
    expect(resolvePolarPlanId("Bulk Pack")).toBe("bulk_pack");
  });

  it("does not read a branded pack name as the Pro subscription", () => {
    expect(resolvePolarPlanId("Alt Text Pro — Bulk Pack")).toBe("bulk_pack");
    expect(resolvePolarPlanId("Alt Text Pro — Library Pack")).toBe("credit_pack");
    expect(resolvePolarPlanId("Alt Text Pro — Small Credit Pack")).toBe("small_pack");
  });

  it("maps legacy product IDs to their original plan and cycle", () => {
    process.env.NEXT_PUBLIC_POLAR_LEGACY_TIER2_ANNUAL = "prod_legacy_standard_annual";
    process.env.NEXT_PUBLIC_POLAR_LEGACY_TIER3_MONTHLY = "prod_legacy_pro_monthly";
    try {
      expect(resolvePolarPlanId("Renamed", {}, "prod_legacy_standard_annual")).toBe("tier2");
      expect(resolvePolarBillingCycle("Renamed", {}, "prod_legacy_standard_annual")).toBe("annual");
      expect(resolvePolarPlanId("Renamed", {}, "prod_legacy_pro_monthly")).toBe("tier3");
    } finally {
      delete process.env.NEXT_PUBLIC_POLAR_LEGACY_TIER2_ANNUAL;
      delete process.env.NEXT_PUBLIC_POLAR_LEGACY_TIER3_MONTHLY;
    }
  });

  it("prefers explicit metadata plan ids when available", () => {
    expect(resolvePolarPlanId("Unknown Product", { plan_id: "tier2_annual" })).toBe("tier2");
  });

  it("does not classify an unrelated manual product as an annual plan", () => {
    expect(resolvePolarBillingCycle("Manual")).toBe("monthly");
  });

  it("uses explicit billing metadata before product-name heuristics", () => {
    expect(resolvePolarBillingCycle("Standard Monthly", { plan_id: "tier2_annual" })).toBe("annual");
  });
});

describe("isPolarSubscriptionProduct", () => {
  it("recognizes subscription plans from the resolved plan id", () => {
    expect(isPolarSubscriptionProduct("Standard Annual")).toBe(true);
    expect(isPolarSubscriptionProduct("Alt Text Pro — Agency Monthly", {})).toBe(true);
  });

  it("recognizes metadata-driven subscriptions", () => {
    expect(isPolarSubscriptionProduct("Mystery Plan", { type: "subscription" })).toBe(true);
  });

  it("does not mark credit packs as subscriptions", () => {
    expect(isPolarSubscriptionProduct("Credit Pack")).toBe(false);
    expect(isPolarSubscriptionProduct("Alt Text Pro — Bulk Pack")).toBe(false);
  });
});
