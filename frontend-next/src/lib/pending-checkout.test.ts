// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeCheckoutBaseline,
  consumePendingCheckout,
  hasAccountChangedSinceCheckout,
  saveCheckoutBaseline,
  resolvePendingCheckout,
  savePendingCheckout,
} from "./pending-checkout";

const NOW = Date.parse("2026-10-24T12:00:00.000Z");

describe("pending checkout", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps a chosen annual plan through sign-up and returns it once", () => {
    savePendingCheckout("tier2", "annual", NOW);

    expect(consumePendingCheckout(NOW + 60_000)).toEqual({
      kind: "subscription",
      checkoutId: "tier2_annual",
      name: "Growth",
      price: "$120",
    });
    expect(consumePendingCheckout(NOW + 120_000)).toBeNull();
  });

  it("keeps a chosen credit pack regardless of billing cycle", () => {
    savePendingCheckout("bulk_pack", "annual", NOW);

    expect(consumePendingCheckout(NOW)).toEqual({
      kind: "pack",
      checkoutId: "bulk_pack",
      name: "Bulk Pack",
      price: "$99",
    });
  });

  it("does not store the free plan, retired plans, or unknown products", () => {
    for (const planId of ["free", "tier3", "pay_as_go", "enterprise"]) {
      savePendingCheckout(planId, "monthly", NOW);
      expect(consumePendingCheckout(NOW)).toBeNull();
    }
  });

  it("ignores a choice older than a day", () => {
    savePendingCheckout("tier1", "monthly", NOW);

    expect(consumePendingCheckout(NOW + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("ignores corrupted storage", () => {
    window.localStorage.setItem("altTextPro.pendingCheckout", "{not json");

    expect(consumePendingCheckout(NOW)).toBeNull();
    expect(resolvePendingCheckout(null, NOW)).toBeNull();
  });
});

describe("checkout baseline", () => {
  const base = { plan: "free", status: "active", creditsRemaining: 40, purchasedCredits: 0, monthlyLimit: 15 };

  beforeEach(() => window.localStorage.clear());

  it("is read once and expires after a day", () => {
    saveCheckoutBaseline(base, NOW);
    expect(consumeCheckoutBaseline(NOW + 1000)).toEqual(base);
    expect(consumeCheckoutBaseline(NOW + 1000)).toBeNull();

    saveCheckoutBaseline(base, NOW);
    expect(consumeCheckoutBaseline(NOW + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("detects a new plan, status, allowance or added credits", () => {
    expect(hasAccountChangedSinceCheckout(base, { ...base, plan: "starter" })).toBe(true);
    expect(hasAccountChangedSinceCheckout(base, { ...base, status: "cancelled" })).toBe(true);
    expect(hasAccountChangedSinceCheckout(base, { ...base, monthlyLimit: 500 })).toBe(true);
    expect(hasAccountChangedSinceCheckout(base, { ...base, purchasedCredits: 500, creditsRemaining: 540 })).toBe(true);
  });

  it("ignores credits being spent while the webhook is pending", () => {
    expect(hasAccountChangedSinceCheckout(base, { ...base })).toBe(false);
    expect(hasAccountChangedSinceCheckout(base, { ...base, creditsRemaining: 38 })).toBe(false);
  });
});
