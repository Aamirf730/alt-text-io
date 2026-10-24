import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "src/app/reset-password/page.tsx"), "utf8");
const landingPage = fs.readFileSync(path.resolve(process.cwd(), "src/app/LandingPageClient.tsx"), "utf8");

describe("password recovery flow", () => {
  it("establishes a recovery session before allowing a password update", () => {
    expect(source).toContain("PASSWORD_RECOVERY");
    expect(source).toContain("exchangeCodeForSession");
    expect(source).toContain("supabase.auth.updateUser({ password })");
  });

  it("sends reset emails back to the first-party reset page", () => {
    expect(landingPage).toContain("supabase.auth.resetPasswordForEmail");
    expect(landingPage).toContain("/reset-password");
    expect(landingPage).toContain("Forgot password?");
  });
});
