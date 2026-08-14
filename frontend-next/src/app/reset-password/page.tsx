"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const code = queryParams.get("code");
        const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
        const type = hashParams.get("type") || queryParams.get("type");

        const { data: initialSessionData, error: initialSessionError } = await supabase.auth.getSession();
        if (initialSessionError) throw initialSessionError;
        if (initialSessionData.session) {
          markReady();
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (type === "recovery" && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
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

        {state === "checking" && <Loader2 className="mx-auto mt-8 h-12 w-12 animate-spin" />}
        {state === "success" && <CheckCircle className="mx-auto mt-8 h-14 w-14 text-emerald-600" />}
        {state === "error" && <XCircle className="mx-auto mt-8 h-14 w-14 text-red-600" />}

        <h1 className="mt-6 font-outfit text-3xl font-semibold tracking-tight">
          {state === "checking" && "Verifying reset link"}
          {state === "ready" && "Set a new password"}
          {state === "saving" && "Updating password"}
          {state === "success" && "Password updated"}
          {state === "error" && "Reset link unavailable"}
        </h1>
        <p role={state === "error" ? "alert" : "status"} className="mt-4 leading-7 text-slate-600">
          {message}
        </p>

        {state === "ready" || state === "saving" ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-semibold text-slate-700">New password</label>
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
              <label htmlFor="confirm-password" className="text-sm font-semibold text-slate-700">Confirm new password</label>
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
            <Button type="submit" disabled={state === "saving"} className="w-full bg-black text-white hover:bg-slate-800">
              {state === "saving" ? "Saving…" : "Update password"}
            </Button>
          </form>
        ) : null}

        {state === "success" && (
          <Button type="button" onClick={() => router.push("/")} className="mt-8 w-full bg-black text-white hover:bg-slate-800">
            Return to sign in
          </Button>
        )}

        {state === "error" && (
          <Button type="button" onClick={() => router.push("/")} className="mt-8 w-full bg-black text-white hover:bg-slate-800">
            Request a new link
          </Button>
        )}
      </section>
    </main>
  );
}
