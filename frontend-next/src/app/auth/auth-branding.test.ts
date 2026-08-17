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
    const proxy = fs.readFileSync(path.resolve(root, "proxy.ts"), "utf8");
    expect(proxy).toContain("https://accounts.google.com/gsi/client");
    expect(proxy).toContain("https://accounts.google.com/gsi/style");
    expect(proxy).toContain("frame-src https://accounts.google.com/gsi/");
    expect(proxy).toContain("connect-src 'self'");
    expect(proxy).not.toContain("unsafe-inline");
  });
});
