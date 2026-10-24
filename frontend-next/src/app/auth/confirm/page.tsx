"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { trackMarketingEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { buttonVariants } from "@/components/ui/button";
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

  useEffect(() => {
    let active = true;

    const confirmEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const defaultDestination = type === "recovery" ? "/reset-password" : "/email-confirmed";
      const safeDestination = getSafeAuthRedirect(
        params.get("next"),
        defaultDestination,
        window.location.origin,
      );
      setDestination(safeDestination);

      if (!tokenHash || !type || !ALLOWED_EMAIL_TYPES.has(type)) {
        if (!active) return;
        setState("error");
        setMessage("This confirmation link is incomplete or invalid.");
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (!active) return;
      if (error || !data.session) {
        setState("error");
        setMessage(error?.message || "This confirmation link has expired or was already used.");
        return;
      }

      if (type === "signup" || type === "email") {
        trackMarketingEvent("signup_created", {
          source: safeDestination.startsWith("/connect") ? "wordpress_connect" : "landing_page",
          properties: {
            signup_method: "email_confirmation",
          },
        });
      }

      window.history.replaceState({}, document.title, "/auth/confirm");
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
          {state === "error" && "Confirmation failed"}
        </h1>
        <p role={state === "error" ? "alert" : "status"} className="mt-3 leading-7 text-ink-muted">
          {message}
        </p>

        {state === "error" && (
          <div className="mt-8 grid gap-3">
            <Link href="/" className={cn(buttonVariants(), "w-full")}>
              Return to Alt Text Pro
            </Link>
            <Link href={destination} className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
              Continue without confirming
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
