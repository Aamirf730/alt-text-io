import { describe, expect, it } from "vitest";

import { getUsageDisplayLimit } from "./credit-display";

describe("getUsageDisplayLimit", () => {
  it("includes the persistent free-tier bonus balance", () => {
    expect(getUsageDisplayLimit(15, 165, 0)).toBe(165);
  });

  it("keeps the free-tier denominator stable as plan credits are used", () => {
    expect(getUsageDisplayLimit(15, 145, 20)).toBe(165);
  });

  it("keeps the plan allowance as the denominator when no extra credits exist", () => {
    expect(getUsageDisplayLimit(1500, 900, 600)).toBe(1500);
  });

  it("includes pack credits on paid plans so usage never exceeds the bar", () => {
    // Starter (500/month) with a 1,000-credit pack: 600 used, 900 still spendable.
    expect(getUsageDisplayLimit(500, 900, 600)).toBe(1500);
  });
});
