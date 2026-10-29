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
import { EXISTING_ACCOUNT_MESSAGE, isExistingAccountSignUp } from "@/lib/auth-redirect";
import { getResendWaitSeconds, resendButtonLabel, useResendCooldown } from "@/lib/resend-cooldown";
import { getFriendlyAuthError } from "@/lib/auth-errors";
import GoogleIdentityButton from "@/components/GoogleIdentityButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    // Email waiting for confirmation; enables the resend link.
    const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
    const { secondsLeft: resendSecondsLeft, startCooldown: startResendCooldown } = useResendCooldown();

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
                if (error) {
                    if (/email not confirmed/i.test(error.message)) {
                        setPendingConfirmationEmail(email.trim());
                    }
                    throw error;
                }
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

                if (isExistingAccountSignUp(data.user, Boolean(data.session))) {
                    // Supabase sends no email for an address that already has an account.
                    setIsLogin(true);
                    setAuthMessage(EXISTING_ACCOUNT_MESSAGE);
                } else if (!data.session) {
                    setPendingConfirmationEmail(email.trim());
                    startResendCooldown();
                    setAuthMessage(
                        "Check your inbox and confirm your email, then return to this page to claim your credits. Not there? Check your spam folder."
                    );
                } else if (data.user?.email) {
                    setUser({ id: data.user.id, email: data.user.email });
                }
            }
        } catch (error) {
            setAuthMessage(
                error instanceof Error ? getFriendlyAuthError(error.message) : "Authentication failed. Please try again."
            );
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleForgotPassword = async () => {
        const normalizedEmail = email.trim();
        if (!normalizedEmail) {
            setAuthMessage("Enter your email address first, then choose Forgot password.");
            return;
        }

        setIsAuthenticating(true);
        setAuthMessage("");
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            setAuthMessage(
                error
                    ? getFriendlyAuthError(error.message)
                    : "If an account exists for that email, a reset link is on its way. Set a new password, then come back here to claim."
            );
        } catch {
            setAuthMessage("Could not send the password reset email. Please try again.");
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleResendConfirmation = async () => {
        const normalizedEmail = (pendingConfirmationEmail || email).trim();
        if (!normalizedEmail) {
            setAuthMessage("Enter your email address first.");
            return;
        }

        setIsAuthenticating(true);
        try {
            const { error } = await supabase.auth.resend({
                type: "signup",
                email: normalizedEmail,
                options: { emailRedirectTo: `${window.location.origin}/customer-offer` },
            });
            const waitSeconds = getResendWaitSeconds(error?.message);
            if (waitSeconds) startResendCooldown(waitSeconds);
            if (error) {
                setAuthMessage(getFriendlyAuthError(error.message));
            } else {
                startResendCooldown();
                setAuthMessage("We sent a new confirmation email. Confirm it, then return to this page to claim your credits. Not there? Check your spam folder.");
            }
        } catch {
            setAuthMessage("Could not resend the confirmation email. Please try again.");
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleGoogleSuccess = async () => {
        setAuthMessage("");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
            throw new Error("Google sign-in completed without a usable account.");
        }

        setUser({ id: session.user.id, email: session.user.email });
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
        <main className="relative min-h-screen overflow-hidden bg-yellow-tint text-ink">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-yellow/20 blur-3xl" />
                <div className="absolute -bottom-52 -right-24 h-[32rem] w-[32rem] rounded-full bg-yellow-soft/60 blur-3xl" />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10 sm:px-8 lg:py-16">
                <div className="grid w-full overflow-hidden rounded-2xl border border-line bg-white shadow-notebook lg:grid-cols-[1.06fr_0.94fr]">
                    <section className="relative bg-brand-yellow px-7 py-10 text-ink sm:px-12 sm:py-14 lg:px-14 lg:py-16">
                        <div className="absolute right-0 top-0 h-52 w-52 rounded-bl-full bg-yellow-soft/50" aria-hidden="true" />
                        <Link href="/" className="relative inline-flex items-center gap-3">
                            <Image
                                src="/logo-alt-text-pro.png"
                                alt="Alt Text Pro"
                                width={64}
                                height={64}
                                priority
                                className="h-16 w-16 rounded-2xl bg-white p-1 shadow-notebook"
                            />
                            <span className="font-outfit text-lg font-semibold tracking-tight">
                                Alt Text Pro
                            </span>
                        </Link>

                        <div className="relative mt-14 max-w-xl">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink">
                                <Gift className="h-4 w-4" />
                                WPGeared customer gift
                            </div>
                            <h1 className="font-outfit text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.55rem]">
                                1,000 bonus credits, on us.
                            </h1>
                            <p className="mt-6 text-lg leading-8 text-ink">
                                Sign in with the email address that received your invitation, then
                                add the bonus to your free Alt Text Pro account.
                            </p>

                            <div className="mt-10 space-y-5">
                                {[
                                    "Generate editable image-description drafts",
                                    "Bulk-fix missing alt text in WordPress",
                                    "Keep unused bonus credits across monthly refills",
                                ].map((benefit) => (
                                    <div key={benefit} className="flex items-center gap-3 text-ink">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-ink">
                                            <Check className="h-4 w-4" strokeWidth={3} />
                                        </span>
                                        <span className="leading-6">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative mt-14 flex items-center gap-3 border-t border-ink/15 pt-6 text-sm text-ink">
                            <ShieldCheck className="h-5 w-5 shrink-0 text-ink" />
                            One claim per invited customer account.
                        </div>
                    </section>

                    <section className="flex items-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14">
                        <div className="w-full">
                            {isCheckingSession ? (
                                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-ink" />
                                    <p className="mt-5 text-ink-muted">Checking your account…</p>
                                </div>
                            ) : claimComplete ? (
                                <div className="text-center">
                                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-soft text-ink">
                                        <CheckCircle2 className="h-11 w-11" />
                                    </div>
                                    <p className="label-caps mt-6">
                                        Offer claimed
                                    </p>
                                    <h2 className="mt-3 font-outfit text-3xl font-semibold tracking-tight">
                                        Your credits are ready.
                                    </h2>
                                    <p className="mx-auto mt-4 max-w-sm leading-7 text-ink-muted">
                                        {claimResult?.status === "already_claimed"
                                            ? "You already claimed this customer offer. Your available balance is shown below."
                                            : claimResult?.message}
                                    </p>

                                    <div className="my-8 rounded-2xl border border-line bg-yellow-tint p-6">
                                        <p className="label-caps">
                                            Available credits
                                        </p>
                                        <p className="mt-2 font-outfit text-5xl font-semibold text-ink">
                                            {Number(claimResult?.credits_remaining || 0).toLocaleString()}
                                        </p>
                                    </div>

                                    <Link
                                        href="/dashboard"
                                        className={cn(buttonVariants(), "w-full")}
                                    >
                                        Go to my dashboard
                                        <ArrowRight />
                                    </Link>
                                </div>
                            ) : user ? (
                                <div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="label-caps">
                                                Welcome back
                                            </p>
                                            <h2 className="mt-2 font-outfit text-3xl font-semibold tracking-tight">
                                                Claim your customer bonus
                                            </h2>
                                        </div>
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-soft text-ink">
                                            <Sparkles className="h-6 w-6" />
                                        </span>
                                    </div>

                                    <div className="mt-7 rounded-2xl border border-line bg-yellow-tint p-4">
                                        <div className="flex items-center gap-3">
                                            <Mail className="h-5 w-5 shrink-0 text-ink" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                                    Signed in as
                                                </p>
                                                <p className="mt-1 break-all font-medium text-ink">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-6 leading-7 text-ink-muted">
                                        We’ll securely verify this email against the customer invitation
                                        list. Your credits will be added only after you press the button.
                                    </p>

                                    {claimResult && !claimComplete && (
                                        <div
                                            role="alert"
                                            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-warning"
                                        >
                                            {claimResult.message}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleClaim}
                                        disabled={isClaiming}
                                        className={cn(buttonVariants(), "mt-6 w-full disabled:cursor-wait")}
                                    >
                                        {isClaiming ? (
                                            <>
                                                <Loader2 className="animate-spin" />
                                                Claiming securely…
                                            </>
                                        ) : (
                                            <>
                                                <Gift />
                                                Claim my 1,000 credits
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSignOut}
                                        className={cn(buttonVariants({ variant: "ghost" }), "mt-2 w-full")}
                                    >
                                        <LogOut />
                                        Use a different email
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <p className="label-caps">
                                        Invitation only
                                    </p>
                                    <h2 className="mt-2 font-outfit text-3xl font-semibold tracking-tight">
                                        {isLogin ? "Sign in to claim" : "Create your free account"}
                                    </h2>
                                    <p className="mt-4 leading-7 text-ink-muted">
                                        Use the same email address where you received this WPGeared
                                        customer invitation.
                                    </p>

                                    <GoogleIdentityButton
                                        text="continue_with"
                                        disabled={isAuthenticating}
                                        onLoadingChange={setIsAuthenticating}
                                        onSuccess={handleGoogleSuccess}
                                        onError={setAuthMessage}
                                        className="mt-6 w-full"
                                    />

                                    <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                                        <span className="h-px flex-1 bg-line" />
                                        or
                                        <span className="h-px flex-1 bg-line" />
                                    </div>

                                    <form onSubmit={handleEmailAuth} className="space-y-4">
                                        <label className="block">
                                            <span className="mb-2 block text-sm font-semibold text-ink">
                                                Email address
                                            </span>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(event) => setEmail(event.target.value)}
                                                required
                                                autoComplete="email"
                                                placeholder="you@example.com"
                                                className="h-11 w-full rounded-xl border border-line-strong bg-white px-4 text-ink outline-none transition placeholder:text-ink-muted focus:border-yellow-strong"
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="mb-2 block text-sm font-semibold text-ink">
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
                                                    className="h-11 w-full rounded-xl border border-line-strong bg-white px-4 pr-12 text-ink outline-none transition placeholder:text-ink-muted focus:border-yellow-strong"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((visible) => !visible)}
                                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                                    className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-yellow-tint hover:text-ink"
                                                >
                                                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                                                </button>
                                            </span>
                                        </label>

                                        {(isLogin || pendingConfirmationEmail) && (
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                {isLogin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleForgotPassword()}
                                                        disabled={isAuthenticating}
                                                        className={cn(buttonVariants({ variant: "link" }), "text-sm")}
                                                    >
                                                        Forgot password?
                                                    </button>
                                                )}
                                                {pendingConfirmationEmail && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleResendConfirmation()}
                                                        disabled={isAuthenticating || resendSecondsLeft > 0}
                                                        className={cn(buttonVariants({ variant: "link" }), "text-sm")}
                                                    >
                                                        {resendButtonLabel(resendSecondsLeft)}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {authMessage && (
                                            <div role="status" className="rounded-xl border border-line-strong bg-yellow-tint p-4 text-sm leading-6 text-ink">
                                                {authMessage}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isAuthenticating}
                                            className={cn(buttonVariants(), "w-full disabled:cursor-wait")}
                                        >
                                            {isAuthenticating ? (
                                                <Loader2 className="animate-spin" />
                                            ) : (
                                                <LockKeyhole />
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
                                        className={cn(buttonVariants({ variant: "link" }), "mx-auto mt-4 flex text-sm")}
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
