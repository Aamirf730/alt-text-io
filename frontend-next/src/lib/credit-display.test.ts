import { describe, expect, it } from "vitest";

import { getUsageDisplayLimit } from "./credit-display";

describe("getUsageDisplayLimit", () => {
  it("includes the persistent free-tier bonus balance", () => {
    expect(getUsageDisplayLimit("free", 15, 165, 0)).toBe(165);
  });

  it("keeps the free-tier denominator stable as plan credits are used", () => {
    expect(getUsageDisplayLimit("free", 15, 145, 20)).toBe(165);
  });

  it("does not change paid-plan allowance semantics", () => {
    expect(getUsageDisplayLimit("tier2", 1000, 400, 600)).toBe(1000);
  });
});
