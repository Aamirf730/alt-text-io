import { describe, expect, it } from "vitest";

import { getPlanDisplayName } from "./pricing-catalog";

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
