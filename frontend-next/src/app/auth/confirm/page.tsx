"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { trackMarketingEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

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
      const safeDestination = getSafeAuthRedirect(
        params.get("next"),
        "/email-confirmed",
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
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9C4] px-4 py-12 text-black">
      <section className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.14)] sm:p-10">
        <Image
          src="/logo-alt-text-pro.png"
          alt="Alt Text Pro"
          width={72}
          height={72}
          priority
          className="mx-auto h-[72px] w-[72px] rounded-2xl"
        />

        {state === "loading" && <Loader2 className="mx-auto mt-8 h-12 w-12 animate-spin" />}
        {state === "success" && <CheckCircle className="mx-auto mt-8 h-14 w-14 text-emerald-600" />}
        {state === "error" && <XCircle className="mx-auto mt-8 h-14 w-14 text-red-600" />}

        <h1 className="mt-6 font-outfit text-3xl font-semibold tracking-tight">
          {state === "loading" && "Confirming your email"}
          {state === "success" && "Email confirmed"}
          {state === "error" && "Confirmation failed"}
        </h1>
        <p role={state === "error" ? "alert" : "status"} className="mt-4 leading-7 text-slate-600">
          {message}
        </p>

        {state === "error" && (
          <div className="mt-8 grid gap-3">
            <Link
              href="/"
              className="rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition hover:bg-slate-800"
            >
              Return to Alt Text Pro
            </Link>
            <Link
              href={destination}
              className="rounded-xl border border-slate-200 px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Continue without confirming
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
