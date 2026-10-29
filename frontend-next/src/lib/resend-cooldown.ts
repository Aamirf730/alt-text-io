import { useCallback, useEffect, useState } from "react";

/** Supabase lets an address request a new confirmation email once a minute. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Seconds Supabase asks us to wait, read from its rate-limit message
 * ("For security purposes, you can only request this after 52 seconds."),
 * or null when the message is about something else.
 */
export function getResendWaitSeconds(message: string | null | undefined): number | null {
  const match = message?.match(/only request this after (\d+) seconds?/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** A countdown that disables the resend button instead of letting Supabase refuse it. */
export function useResendCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const startCooldown = useCallback((seconds: number = RESEND_COOLDOWN_SECONDS) => {
    setSecondsLeft(seconds);
  }, []);

  return { secondsLeft, startCooldown };
}

export function resendButtonLabel(secondsLeft: number) {
  return secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend confirmation email";
}
