import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sources = [
  "src/app/page.tsx",
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
    const nextConfig = fs.readFileSync(path.resolve(root, "next.config.mjs"), "utf8");
    expect(nextConfig).toContain("https://accounts.google.com/gsi/client");
    expect(nextConfig).toContain("https://accounts.google.com/gsi/style");
    expect(nextConfig).toContain("frame-src https://accounts.google.com/gsi/");
    expect(nextConfig).toContain("connect-src 'self'");
  });
});
