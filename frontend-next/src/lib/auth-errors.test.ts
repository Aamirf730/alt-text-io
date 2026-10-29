import { describe, expect, it } from "vitest";

import { EMAIL_RATE_LIMIT_MESSAGE, INVALID_LOGIN_MESSAGE, getFriendlyAuthError } from "./auth-errors";

describe("getFriendlyAuthError", () => {
  it("explains a wrong password and points Google accounts to the Google button", () => {
    expect(getFriendlyAuthError("Invalid login credentials")).toBe(INVALID_LOGIN_MESSAGE);
  });

  it("rewords the project-wide email limit", () => {
    expect(getFriendlyAuthError("Email rate limit exceeded")).toBe(EMAIL_RATE_LIMIT_MESSAGE);
  });

  it("rewords the per-address resend wait", () => {
    expect(getFriendlyAuthError("For security purposes, you can only request this after 41 seconds.")).toBe(
      "We just sent an email. You can ask for another in 41 seconds.",
    );
  });

  it("passes other messages through", () => {
    expect(getFriendlyAuthError("Password should be at least 6 characters.")).toBe(
      "Password should be at least 6 characters.",
    );
    expect(getFriendlyAuthError(undefined)).toBe("Something went wrong. Please try again.");
  });
});
