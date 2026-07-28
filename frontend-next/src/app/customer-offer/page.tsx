"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    ArrowRight,
    Check,
    CheckCircle2,
    Eye,
    EyeOff,
    Gift,
    Loader2,
    LockKeyhole,
    LogOut,
    Mail,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AccountUser = {
    id: string;
    email: string;
};

type ClaimResult = {
    success: boolean;
    status: string;
    message: string;
    credits_awarded?: number;
    credits_remaining?: number;
    bonus_credits_remaining?: number;
};

const CLAIMED_STATUSES = new Set(["claimed", "already_claimed"]);

export default function CustomerOfferPage() {
    const [user, setUser] = useState<AccountUser | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
    const [isLogin, setIsLogin] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authMessage, setAuthMessage] = useState("");

    useEffect(() => {
        let mounted = true;

        const loadSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;

            if (session?.user?.email) {
                setUser({ id: session.user.id, email: session.user.email });
            }
            setIsCheckingSession(false);
        };

        loadSession();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            if (session?.user?.email) {
                setUser({ id: session.user.id, email: session.user.email });
                setAuthMessage("");
            } else {
                setUser(null);
            }
            setIsCheckingSession(false);
        });

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsAuthenticating(true);
        setAuthMessage("");
        setClaimResult(null);

        try {
            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.user?.email) {
                    setUser({ id: data.user.id, email: data.user.email });
                }
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/customer-offer`,
                    },
                });
                if (error) throw error;

                if (!data.session) {
                    setAuthMessage(
                        "Check your inbox and confirm your email, then return to this page to claim your credits."
                    );
                } else if (data.user?.email) {
                    setUser({ id: data.user.id, email: data.user.email });
                }
            }
        } catch (error) {
            setAuthMessage(
                error instanceof Error ? error.message : "Authentication failed. Please try again."
            );
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleGoogleAuth = async () => {
        setIsAuthenticating(true);
        setAuthMessage("");
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/customer-offer`,
                queryParams: {
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        });

        if (error) {
            setAuthMessage(`Google sign-in failed: ${error.message}`);
            setIsAuthenticating(false);
        }
    };

    const handleClaim = async () => {
        setIsClaiming(true);
        setClaimResult(null);

        const { data, error } = await supabase.rpc("claim_wpgeared_customer_offer");
        if (error) {
            setClaimResult({
                success: false,
                status: "claim_failed",
                message: "We couldn’t claim your credits right now. Please try again.",
            });
        } else {
            setClaimResult(data as ClaimResult);
        }

        setIsClaiming(false);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setClaimResult(null);
        setAuthMessage("");
    };

    const claimComplete = Boolean(
        claimResult?.success && CLAIMED_STATUSES.has(claimResult.status)
    );

    return (
        <main className="min-h-screen overflow-hidden bg-[#edf6f5] text-[#102f3b]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#32c3b4]/15 blur-3xl" />
                <div className="absolute -bottom-52 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#178e91]/10 blur-3xl" />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10 sm:px-8 lg:py-16">
                <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_rgba(16,47,59,0.14)] lg:grid-cols-[1.06fr_0.94fr]">
                    <section className="relative bg-[#102f3b] px-7 py-10 text-white sm:px-12 sm:py-14 lg:px-14 lg:py-16">
                        <div className="absolute right-0 top-0 h-52 w-52 rounded-bl-full bg-[#2fc6b5]/10" aria-hidden="true" />
                        <Link href="/" className="relative inline-flex items-center gap-3">
                            <Image
                                src="/logo-alt-text-pro.png"
                                alt="Alt Text Pro"
                                width={64}
                                height={64}
                                priority
                                className="h-16 w-16 rounded-2xl bg-white/95 p-1 shadow-lg"
                            />
                            <span className="font-outfit text-lg font-semibold tracking-tight">
                                Alt Text Pro
                            </span>
                        </Link>

                        <div className="relative mt-14 max-w-xl">
                            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#7ee0d5]/25 bg-[#2fc6b5]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8be5da]">
                                <Gift className="h-4 w-4" />
                                WPGeared customer gift
                            </div>
                            <h1 className="font-outfit text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.55rem]">
                                1,000 bonus credits, on us.
                            </h1>
                            <p className="mt-6 text-lg leading-8 text-slate-300">
                                Sign in with the email address that received your invitation, then
                                add the bonus to your free Alt Text Pro account.
                            </p>

                            <div className="mt-10 space-y-5">
                                {[
                                    "Generate useful image descriptions in seconds",
                                    "Bulk-fix missing alt text in WordPress",
                                    "Keep unused bonus credits across monthly refills",
                                ].map((benefit) => (
                                    <div key={benefit} className="flex items-start gap-3 text-slate-200">
                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#2fc6b5]/15 text-[#7ee0d5]">
                                            <Check className="h-4 w-4" strokeWidth={3} />
                                        </span>
                                        <span className="leading-6">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative mt-14 flex items-center gap-3 border-t border-white/10 pt-7 text-sm text-slate-400">
                            <ShieldCheck className="h-5 w-5 text-[#7ee0d5]" />
                            One claim per invited customer account.
                        </div>
                    </section>

                    <section className="flex items-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14">
                        <div className="w-full">
                            {isCheckingSession ? (
                                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-[#178e91]" />
                                    <p className="mt-5 text-slate-600">Checking your account…</p>
                                </div>
                            ) : claimComplete ? (
                                <div className="text-center">
                                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#dff7f2] text-[#11877f]">
                                        <CheckCircle2 className="h-11 w-11" />
                                    </div>
                                    <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#178e91]">
                                        Offer claimed
                                    </p>
                                    <h2 className="mt-3 font-outfit text-3xl font-semibold tracking-tight">
                                        Your credits are ready.
                                    </h2>
                                    <p className="mx-auto mt-4 max-w-sm leading-7 text-slate-600">
                                        {claimResult?.status === "already_claimed"
                                            ? "You already claimed this customer offer. Your available balance is shown below."
                                            : claimResult?.message}
                                    </p>

                                    <div className="my-8 rounded-2xl border border-[#cce9e5] bg-[#effaf8] p-6">
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#178e91]">
                                            Available credits
                                        </p>
                                        <p className="mt-2 font-outfit text-5xl font-semibold text-[#102f3b]">
                                            {Number(claimResult?.credits_remaining || 0).toLocaleString()}
                                        </p>
                                    </div>

                                    <Link
                                        href="/dashboard"
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#102f3b] px-6 py-4 font-semibold text-white transition hover:bg-[#174552]"
                                    >
                                        Go to my dashboard
                                        <ArrowRight className="h-5 w-5" />
                                    </Link>
                                </div>
                            ) : user ? (
                                <div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#178e91]">
                                                Welcome back
                                            </p>
                                            <h2 className="mt-2 font-outfit text-3xl font-semibold tracking-tight">
                                                Claim your customer bonus
                                            </h2>
                                        </div>
                                        <Sparkles className="h-9 w-9 text-[#2aaba1]" />
                                    </div>

                                    <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#178e91]" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Signed in as
                                                </p>
                                                <p className="mt-1 break-all font-medium text-slate-800">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-6 leading-7 text-slate-600">
                                        We’ll securely verify this email against the customer invitation
                                        list. Your credits will be added only after you press the button.
                                    </p>

                                    {claimResult && !claimComplete && (
                                        <div
                                            role="alert"
                                            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
                                        >
                                            {claimResult.message}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleClaim}
                                        disabled={isClaiming}
                                        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2fc6b5] px-6 py-4 font-bold text-[#102f3b] shadow-[0_12px_30px_rgba(47,198,181,0.25)] transition hover:bg-[#49d3c3] disabled:cursor-wait disabled:opacity-65"
                                    >
                                        {isClaiming ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Claiming securely…
                                            </>
                                        ) : (
                                            <>
                                                <Gift className="h-5 w-5" />
                                                Claim my 1,000 credits
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSignOut}
                                        className="mx-auto mt-5 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Use a different email
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#178e91]">
                                        Invitation only
                                    </p>
                                    <h2 className="mt-2 font-outfit text-3xl font-semibold tracking-tight">
                                        {isLogin ? "Sign in to claim" : "Create your free account"}
                                    </h2>
                                    <p className="mt-4 leading-7 text-slate-600">
                                        Use the same email address where you received this WPGeared
                                        customer invitation.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={handleGoogleAuth}
                                        disabled={isAuthenticating}
                                        className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
                                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                            <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                        </svg>
                                        Continue with Google
                                    </button>

                                    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-slate-400">
                                        <span className="h-px flex-1 bg-slate-200" />
                                        or
                                        <span className="h-px flex-1 bg-slate-200" />
                                    </div>

                                    <form onSubmit={handleEmailAuth} className="space-y-4">
                                        <label className="block">
                                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                                                Email address
                                            </span>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(event) => setEmail(event.target.value)}
                                                required
                                                autoComplete="email"
                                                placeholder="you@example.com"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition placeholder:text-slate-400 focus:border-[#2aaba1] focus:ring-4 focus:ring-[#2fc6b5]/10"
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                                                Password
                                            </span>
                                            <span className="relative block">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={password}
                                                    onChange={(event) => setPassword(event.target.value)}
                                                    required
                                                    minLength={6}
                                                    autoComplete={isLogin ? "current-password" : "new-password"}
                                                    placeholder={isLogin ? "Your password" : "At least 6 characters"}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 pr-12 outline-none transition placeholder:text-slate-400 focus:border-[#2aaba1] focus:ring-4 focus:ring-[#2fc6b5]/10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((visible) => !visible)}
                                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-700"
                                                >
                                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            </span>
                                        </label>

                                        {authMessage && (
                                            <div role="status" className="rounded-xl border border-[#cce9e5] bg-[#effaf8] p-4 text-sm leading-6 text-[#155f61]">
                                                {authMessage}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isAuthenticating}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#102f3b] px-6 py-4 font-semibold text-white transition hover:bg-[#174552] disabled:cursor-wait disabled:opacity-60"
                                        >
                                            {isAuthenticating ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <LockKeyhole className="h-5 w-5" />
                                            )}
                                            {isLogin ? "Sign in securely" : "Create free account"}
                                        </button>
                                    </form>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsLogin((login) => !login);
                                            setAuthMessage("");
                                        }}
                                        className="mx-auto mt-5 block text-sm font-semibold text-[#178e91] hover:text-[#106f72]"
                                    >
                                        {isLogin
                                            ? "New to Alt Text Pro? Create a free account"
                                            : "Already have an account? Sign in"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
