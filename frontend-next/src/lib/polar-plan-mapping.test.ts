import { describe, expect, it } from "vitest";

import { isPolarSubscriptionProduct, resolvePolarPlanId } from "./polar-plan-mapping";

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

  it("maps one-time pack products correctly", () => {
    expect(resolvePolarPlanId("Small Pack")).toBe("small_pack");
    expect(resolvePolarPlanId("Credit Pack")).toBe("credit_pack");
  });

  it("prefers explicit metadata plan ids when available", () => {
    expect(resolvePolarPlanId("Unknown Product", { plan_id: "tier2_annual" })).toBe("tier2");
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
  });
});
