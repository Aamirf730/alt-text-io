import { getResendWaitSeconds } from "./resend-cooldown";

export const INVALID_LOGIN_MESSAGE =
  "That email and password don't match. Check them or use Forgot password. If you signed up with Google, use the Google button.";

export const EMAIL_RATE_LIMIT_MESSAGE =
  "We have sent a lot of emails in the last hour. Please try again in a little while.";

/** Supabase's auth errors, reworded for the sign-in and sign-up forms. */
export function getFriendlyAuthError(message: string | null | undefined): string {
  const text = message || "";
  if (/invalid login credentials/i.test(text)) return INVALID_LOGIN_MESSAGE;
  if (/email rate limit exceeded/i.test(text)) return EMAIL_RATE_LIMIT_MESSAGE;
  const waitSeconds = getResendWaitSeconds(text);
  if (waitSeconds) return `We just sent an email. You can ask for another in ${waitSeconds} seconds.`;
  return text || "Something went wrong. Please try again.";
}
