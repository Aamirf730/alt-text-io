import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sources = [
  "src/app/LandingPageClient.tsx",
  "src/app/connect/page.tsx",
  "src/app/customer-offer/page.tsx",
].map((file) => fs.readFileSync(path.resolve(root, file), "utf8"));

describe("authentication branding", () => {
  it("uses the reusable first-party Google button on every signup surface", () => {
    for (const source of sources) {
      expect(source).toContain("GoogleIdentityButton");
      expect(source).not.toContain("signInWithOAuth");
    }
  });

  it("allows only the documented Google Identity endpoints in CSP", () => {
    const proxy = fs.readFileSync(path.resolve(root, "src/proxy.ts"), "utf8");
    expect(proxy).toContain("https://accounts.google.com/gsi/client");
    expect(proxy).toContain("https://accounts.google.com/gsi/style");
    expect(proxy).toContain("frame-src https://accounts.google.com/gsi/");
    expect(proxy).toContain("connect-src 'self'");
    // Next.js only runs src/proxy.ts (beside app/) for a src-directory project.
    expect(fs.existsSync(path.resolve(root, "proxy.ts"))).toBe(false);
    const scriptSrc = proxy.split("\n").find((line) => line.includes("script-src")) || "";
    expect(scriptSrc).toContain("'nonce-${nonce}'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    const styleSrc = proxy.split("\n").find((line) => line.includes('"style-src')) || "";
    expect(styleSrc).toContain("'unsafe-inline'");
    expect(styleSrc).not.toContain("nonce");
  });
});
