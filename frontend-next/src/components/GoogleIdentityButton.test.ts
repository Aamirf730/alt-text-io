import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/GoogleIdentityButton.tsx"),
  "utf8",
);

describe("GoogleIdentityButton", () => {
  it("exchanges a Google ID token directly with Supabase", () => {
    expect(source).toContain('src="https://accounts.google.com/gsi/client"');
    expect(source).toContain("supabase.auth.signInWithIdToken");
    expect(source).toContain('provider: "google"');
    expect(source).not.toContain("signInWithOAuth");
  });

  it("uses a hashed nonce for Google and the original nonce for Supabase", () => {
    expect(source).toContain('crypto.subtle.digest("SHA-256"');
    expect(source).toContain("nonce: hashedNonce");
    expect(source).toContain("nonce,");
  });
});
