import { describe, expect, it } from "vitest";

import { getPlanDisplayName, suggestCreditPacks } from "./pricing-catalog";

describe("getPlanDisplayName", () => {
  it.each([
    ["tier1", 500, "Starter"],
    ["tier2", 1500, "Growth"],
    ["tier4", 5000, "Agency"],
    ["tier2", null, "Growth"],
  ])("names a current %s subscriber by the current plan", (planId, allowance, expected) => {
    expect(getPlanDisplayName(planId, allowance)).toBe(expected);
  });

  it.each([
    ["tier1", 150, "Lite"],
    ["tier2", 1000, "Standard"],
    ["tier4", 3500, "Agency"],
    ["tier3", 2000, "Pro"],
    ["tier3", null, "Pro"],
    ["lite", null, "Lite"],
  ])("keeps the original name for a legacy %s subscriber on %s credits", (planId, allowance, expected) => {
    expect(getPlanDisplayName(planId, allowance)).toBe(expected);
  });

  it("labels free and one-time plans", () => {
    expect(getPlanDisplayName("free")).toBe("Free");
    expect(getPlanDisplayName("bulk_pack")).toBe("Credit Pack");
    expect(getPlanDisplayName("pay_as_go")).toBe("Credit Pack");
  });
});

describe("suggestCreditPacks", () => {
  it("needs nothing when the sign-up bonus covers the library", () => {
    expect(suggestCreditPacks(120)).toMatchObject({ creditsNeeded: 0, packs: [], totalPrice: 0, leftover: 30 });
  });

  it("suggests the small pack for 800 images", () => {
    const suggestion = suggestCreditPacks(800);
    expect(suggestion.creditsNeeded).toBe(650);
    expect(suggestion.packs.map(({ pack, count }) => [pack.id, count])).toEqual([["small_pack", 1]]);
    expect(suggestion.totalPrice).toBe(12);
    expect(suggestion.leftover).toBe(350);
  });

  it("picks a bigger pack once it is cheaper than several small ones", () => {
    const suggestion = suggestCreditPacks(4500);
    expect(suggestion.packs.map(({ pack, count }) => [pack.id, count])).toEqual([["credit_pack", 1]]);
    expect(suggestion.totalPrice).toBe(45);
  });

  it("combines packs for a large library", () => {
    const suggestion = suggestCreditPacks(16_000);
    expect(suggestion.packs.map(({ pack, count }) => [pack.id, count])).toEqual([["bulk_pack", 1], ["small_pack", 1]]);
    expect(suggestion.totalPrice).toBe(111);
  });
});
