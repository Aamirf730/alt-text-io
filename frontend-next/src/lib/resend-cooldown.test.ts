import { describe, expect, it } from "vitest";

import { getResendWaitSeconds, resendButtonLabel } from "./resend-cooldown";

describe("getResendWaitSeconds", () => {
  it("reads the wait from Supabase's rate-limit message", () => {
    expect(getResendWaitSeconds("For security purposes, you can only request this after 52 seconds.")).toBe(52);
    expect(getResendWaitSeconds("For security purposes, you can only request this after 1 second.")).toBe(1);
  });

  it("returns null for other errors", () => {
    expect(getResendWaitSeconds("Email rate limit exceeded")).toBeNull();
    expect(getResendWaitSeconds(undefined)).toBeNull();
  });
});

describe("resendButtonLabel", () => {
  it("shows the countdown while waiting", () => {
    expect(resendButtonLabel(42)).toBe("Resend in 42s");
    expect(resendButtonLabel(0)).toBe("Resend confirmation email");
  });
});
