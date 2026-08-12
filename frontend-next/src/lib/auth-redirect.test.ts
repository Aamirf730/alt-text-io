import { describe, expect, it } from "vitest";

import { getSafeAuthRedirect } from "./auth-redirect";

describe("getSafeAuthRedirect", () => {
  it("preserves first-party confirmation destinations", () => {
    expect(
      getSafeAuthRedirect(
        "https://www.alt-text.pro/connect?source=wordpress_plugin",
        "/email-confirmed",
        "https://www.alt-text.pro",
      ),
    ).toBe("/connect?source=wordpress_plugin");
  });

  it("accepts the apex production host", () => {
    expect(
      getSafeAuthRedirect(
        "https://alt-text.pro/customer-offer",
        "/email-confirmed",
        "https://www.alt-text.pro",
      ),
    ).toBe("/customer-offer");
  });

  it("allows same-origin localhost during development", () => {
    expect(
      getSafeAuthRedirect(
        "http://localhost:3000/connect?state=abc",
        "/email-confirmed",
        "http://localhost:3000",
      ),
    ).toBe("/connect?state=abc");
  });

  it("rejects cross-origin and credential-bearing redirects", () => {
    expect(
      getSafeAuthRedirect(
        "https://attacker.example/steal",
        "/email-confirmed",
        "https://www.alt-text.pro",
      ),
    ).toBe("/email-confirmed");

    expect(
      getSafeAuthRedirect(
        "https://user:pass@www.alt-text.pro/connect",
        "/email-confirmed",
        "https://www.alt-text.pro",
      ),
    ).toBe("/email-confirmed");
  });
});
