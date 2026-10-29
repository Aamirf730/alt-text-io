"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ResetState = "checking" | "ready" | "saving" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<ResetState>("checking");
  const [message, setMessage] = useState("Verifying your password reset link…");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let active = true;

    const markReady = () => {
      if (!active) return;
      window.history.replaceState({}, document.title, "/reset-password");
      setState("ready");
      setMessage("Choose a new password for your account.");
    };

    const prepareResetSession = async () => {
      try {
        // Only the PKCE code (from the Supabase redirect) or a session set by
        // /auth/confirm is accepted; credentials in the URL are never trusted.
        const queryParams = new URLSearchParams(window.location.search);
        const code = queryParams.get("code");

        const { data: initialSessionData, error: initialSessionError } = await supabase.auth.getSession();
        if (initialSessionError) throw initialSessionError;
        if (initialSessionData.session) {
          markReady();
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          throw new Error("This password reset link is invalid or has expired.");
        }

        markReady();
      } catch (error) {
        if (!active) return;
        console.error("Password reset session error:", error);
        window.history.replaceState({}, document.title, "/reset-password");
        setState("error");
        setMessage(error instanceof Error ? error.message : "This password reset link is invalid or has expired.");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        markReady();
      }
    });

    void prepareResetSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      setMessage("Your new password must be at least 6 characters.");
      return;
    }

    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setState("saving");
    setMessage("Saving your new password…");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setState("ready");
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setState("success");
    setMessage("Your password has been updated. You can now sign in with the new password.");
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

        {(state === "checking" || state === "success" || state === "error") && (
          <div
            className={cn(
              "mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full",
              state === "checking" && "bg-yellow-soft text-ink",
              state === "success" && "bg-green-50 text-success",
              state === "error" && "bg-red-50 text-error",
            )}
            aria-hidden="true"
          >
            {state === "checking" && <Loader2 className="h-8 w-8 animate-spin" />}
            {state === "success" && <CheckCircle className="h-8 w-8" />}
            {state === "error" && <XCircle className="h-8 w-8" />}
          </div>
        )}

        <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight sm:text-3xl">
          {state === "checking" && "Verifying reset link"}
          {state === "ready" && "Set a new password"}
          {state === "saving" && "Updating password"}
          {state === "success" && "Password updated"}
          {state === "error" && "Reset link unavailable"}
        </h1>
        <p role={state === "error" ? "alert" : "status"} className="mt-3 leading-7 text-ink-muted">
          {message}
        </p>

        {state === "ready" || state === "saving" ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-semibold text-ink">New password</label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                disabled={state === "saving"}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-semibold text-ink">Confirm new password</label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={6}
                required
                disabled={state === "saving"}
              />
            </div>
            <Button type="submit" disabled={state === "saving"} className="!mt-6 w-full">
              {state === "saving" ? "Saving…" : "Update password"}
            </Button>
          </form>
        ) : null}

        {state === "success" && (
          <Button type="button" onClick={() => router.push("/?auth=signin")} className="mt-8 w-full">
            Return to sign in
          </Button>
        )}

        {state === "error" && (
          <>
            <Button type="button" onClick={() => router.push("/?auth=signin")} className="mt-8 w-full">
              Request a new link
            </Button>
            <p className="mt-3 text-sm text-ink-muted">
              Choose <strong>Forgot password?</strong> in the sign-in window to get a new link.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
