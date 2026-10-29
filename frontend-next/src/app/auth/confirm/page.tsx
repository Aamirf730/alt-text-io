"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";

import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { getFriendlyAuthError } from "@/lib/auth-errors";
import { getResendWaitSeconds, useResendCooldown } from "@/lib/resend-cooldown";
import { trackMarketingEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ConfirmationState = "loading" | "success" | "error";

const ALLOWED_EMAIL_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export default function AuthConfirmPage() {
  const [state, setState] = useState<ConfirmationState>("loading");
  const [message, setMessage] = useState("Verifying your secure link…");
  const [destination, setDestination] = useState("/email-confirmed");
  const [linkType, setLinkType] = useState<string | null>(null);
  // Set when the link failed but this browser is already signed in, which
  // usually means the link was opened twice.
  const [hasSession, setHasSession] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const { secondsLeft: resendSecondsLeft, startCooldown: startResendCooldown } = useResendCooldown();

  useEffect(() => {
    let active = true;

    const confirmEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      setLinkType(type);
      const defaultDestination = type === "recovery" ? "/reset-password" : "/email-confirmed";
      const safeDestination = getSafeAuthRedirect(
        params.get("next"),
        defaultDestination,
        window.location.origin,
      );
      setDestination(safeDestination);

      const showFailure = async (failureMessage: string) => {
        // Never keep a spent token in the address bar.
        window.history.replaceState({}, document.title, "/auth/confirm");
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        const alreadySignedIn = Boolean(session) && type !== "recovery";
        setHasSession(alreadySignedIn);
        setState("error");
        setMessage(
          alreadySignedIn
            ? "This link was already used, and you're signed in. You can carry on."
            : failureMessage,
        );
      };

      if (!tokenHash || !type || !ALLOWED_EMAIL_TYPES.has(type)) {
        if (!active) return;
        await showFailure("This confirmation link is incomplete or invalid.");
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (!active) return;
      // An email change confirms both addresses. The first link accepted
      // returns no session yet: it is a success, with one step left.
      if (!error && !data.session && type === "email_change") {
        window.history.replaceState({}, document.title, "/auth/confirm");
        setState("success");
        setMessage("Confirmed. Now open the link we sent to your other email address to finish the change.");
        return;
      }
      if (error || !data.session) {
        await showFailure(
          "This link has expired or was already used. Request a new one below, or sign in if you already confirmed your email.",
        );
        return;
      }

      // Drop the spent token before anything (including analytics) reads the URL.
      window.history.replaceState({}, document.title, "/auth/confirm");

      if (type === "signup" || type === "email") {
        trackMarketingEvent("signup_created", {
          source: safeDestination.startsWith("/connect") ? "wordpress_connect" : "landing_page",
          properties: {
            signup_method: "email_confirmation",
          },
        });
      }

      setState("success");
      setMessage("Your email is confirmed. Taking you back to Alt Text Pro…");

      window.setTimeout(() => {
        window.location.assign(safeDestination);
      }, 900);
    };

    void confirmEmail();
    return () => {
      active = false;
    };
  }, []);

  const isRecoveryLink = linkType === "recovery";

  const handleResend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = resendEmail.trim();
    if (!email) {
      toast.error("Enter your email address first.");
      return;
    }

    setIsResending(true);
    try {
      const { error } = isRecoveryLink
        ? await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        : await supabase.auth.resend({
          type: "signup",
          email,
          // Keeps the original destination, such as a WordPress connect window.
          options: { emailRedirectTo: new URL(destination, window.location.origin).toString() },
        });

      if (error) {
        const waitSeconds = getResendWaitSeconds(error.message);
        if (waitSeconds) startResendCooldown(waitSeconds);
        toast.error(getFriendlyAuthError(error.message));
        return;
      }

      startResendCooldown();
      toast.success(
        isRecoveryLink
          ? "If an account exists for that email, a new reset link is on its way."
          : "If that email is waiting for confirmation, a new link is on its way. Check your inbox and spam folder.",
      );
    } catch {
      toast.error("Could not send a new link. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-yellow-tint px-4 py-12 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-notebook sm:p-8">
        <Image
          src="/logo-alt-text-pro.png"
          alt="Alt Text Pro"
          width={64}
          height={64}
          priority
          className="mx-auto h-16 w-16"
        />

        <div
          className={cn(
            "mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full",
            state === "loading" && "bg-yellow-soft text-ink",
            state === "success" && "bg-green-50 text-success",
            state === "error" && "bg-red-50 text-error",
          )}
          aria-hidden="true"
        >
          {state === "loading" && <Loader2 className="h-8 w-8 animate-spin" />}
          {state === "success" && <CheckCircle className="h-8 w-8" />}
          {state === "error" && <XCircle className="h-8 w-8" />}
        </div>

        <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight sm:text-3xl">
          {state === "loading" && "Confirming your email"}
          {state === "success" && "Email confirmed"}
          {state === "error" && (hasSession ? "Already confirmed" : "Link expired or already used")}
        </h1>
        <p role={state === "error" ? "alert" : "status"} className="mt-3 leading-7 text-ink-muted">
          {message}
        </p>

        {state === "error" && hasSession && (
          <div className="mt-8 grid gap-3">
            <Link href={destination} className={cn(buttonVariants(), "w-full")}>
              Continue
            </Link>
          </div>
        )}

        {state === "error" && !hasSession && (
          <>
            <form onSubmit={handleResend} className="mt-8 space-y-3 text-left">
              <label htmlFor="resend-email" className="text-sm font-semibold text-ink">
                Email address
              </label>
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
                required
                disabled={isResending}
              />
              <Button type="submit" disabled={isResending || resendSecondsLeft > 0} className="w-full">
                {isResending ? <Loader2 className="animate-spin" /> : <Mail />}
                {resendSecondsLeft > 0
                  ? `Send again in ${resendSecondsLeft}s`
                  : isRecoveryLink ? "Send a new reset link" : "Resend confirmation email"}
              </Button>
            </form>
            <div className="mt-3 grid gap-3">
              <Link href="/?auth=signin" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
                Sign in
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
