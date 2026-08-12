import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "src/app/auth/confirm/page.tsx"), "utf8");
const template = fs.readFileSync(path.resolve(process.cwd(), "../supabase/templates/confirmation.html"), "utf8");

describe("first-party email confirmation", () => {
  it("verifies the token hash on the Alt Text Pro page", () => {
    expect(source).toContain("supabase.auth.verifyOtp");
    expect(source).toContain("token_hash: tokenHash");
    expect(source).toContain("getSafeAuthRedirect");
  });

  it("keeps the confirmation link on the first-party domain", () => {
    expect(template).toContain("{{ .SiteURL }}/auth/confirm");
    expect(template).toContain("token_hash={{ .TokenHash }}");
    expect(template).toContain("next={{ .RedirectTo | urlquery }}");
    expect(template).not.toContain("{{ .ConfirmationURL }}");
  });
});
