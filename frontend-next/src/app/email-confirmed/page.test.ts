import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/email-confirmed/page.tsx"),
  "utf8",
);

describe("email confirmation page", () => {
  it("only trusts the session established by the secure confirmation route", () => {
    expect(pageSource).toContain("supabase.auth.getUser()");
    expect(pageSource).not.toContain("supabase.auth.setSession");
    expect(pageSource).not.toContain("access_token");
    expect(pageSource).not.toContain("refresh_token");
    expect(pageSource).not.toContain("trackMarketingEvent");
  });
});
