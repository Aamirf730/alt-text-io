import { describe, expect, it } from "vitest";

import { hasLivePaidSubscription } from "./subscription-status";

describe("hasLivePaidSubscription", () => {
  it.each(["tier1", "tier2", "tier3", "tier4", "lite", "standard", "pro", "agency"])(
    "treats an active %s account as subscribed",
    (subscription_plan) => {
      expect(hasLivePaidSubscription({ subscription_plan, subscription_status: "active" })).toBe(true);
    },
  );

  it("treats a past-due subscription as still subscribed", () => {
    expect(hasLivePaidSubscription({ subscription_plan: "tier1", subscription_status: "past_due" })).toBe(true);
  });

  it("treats a scheduled cancellation as still subscribed", () => {
    expect(hasLivePaidSubscription({ subscription_plan: "tier2", subscription_status: "cancelled" })).toBe(true);
  });

  it.each([
    ["free account", { subscription_plan: "free", subscription_status: "active" }],
    ["revoked subscriber", { subscription_plan: "tier2", subscription_status: "revoked" }],
    ["legacy pack-only account", { subscription_plan: "small_pack", subscription_status: "active" }],
    ["missing profile", null],
  ])("does not treat a %s as subscribed", (_label, profile) => {
    expect(hasLivePaidSubscription(profile)).toBe(false);
  });
});
