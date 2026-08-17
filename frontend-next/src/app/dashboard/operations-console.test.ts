import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/dashboard/page.tsx"),
  "utf8",
);

describe("dashboard operations console", () => {
  it("keeps the setup prompt conditional on plugin connection and first use", () => {
    expect(dashboardSource).toContain(
      "const showFirstRunOnboarding = !isPluginConnected || !hasGeneratedFirstAltText",
    );
    expect(dashboardSource).toContain("{showFirstRunOnboarding && (");
  });

  it("keeps the core operations sections and responsive navigation available", () => {
    expect(dashboardSource).toContain("Operations Console");
    expect(dashboardSource).toContain('id="activity"');
    expect(dashboardSource).toContain('id="generate"');
    expect(dashboardSource).toContain('id="usage"');
    expect(dashboardSource).toContain('id="settings"');
    expect(dashboardSource).toContain('aria-label="Open dashboard navigation"');
    expect(dashboardSource).toContain("history.slice(0, 5)");
  });

  it("contains no development-only dashboard authentication bypass", () => {
    expect(dashboardSource).not.toContain("dashboard-preview");
    expect(dashboardSource).not.toContain("TEMPORARY DESIGN QA");
  });
});
