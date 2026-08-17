import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/dashboard/page.tsx"),
  "utf8",
);

describe("dashboard subscription billing cycle selection", () => {
  it("offers annual products instead of hardcoding monthly checkout", () => {
    expect(dashboardSource).toContain("`${plan.id}_${upgradeBillingCycle}`");
    expect(dashboardSource).toContain("plan.annualPrice");
    expect(dashboardSource).toContain("setUpgradeBillingCycle('annual')");
    expect(dashboardSource).not.toContain("handleUpgradePlan(`${plan.id}_monthly`");
  });
});
