"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type PaymentState = "processing" | "success" | "error";
type CheckoutStatus = "open" | "expired" | "confirmed" | "succeeded" | "failed";

// Polar reports success before its webhook reaches us. Keep polling until
// /api/checkout-status confirms the account itself was updated, then hand
// over to the dashboard: ?checkout=success when the purchase is applied,
// ?checkout=pending if it is still on its way when we stop waiting.
const POLL_INTERVAL_MS = 2000;
const MAX_CHECKOUT_ATTEMPTS = 10;
const MAX_ACCOUNT_ATTEMPTS = 15;
const SUCCESS_REDIRECT = "/dashboard?checkout=success";
const PENDING_REDIRECT = "/dashboard?checkout=pending";

export default function PaymentSuccess() {
    const [state, setState] = useState<PaymentState>("processing");
    const [message, setMessage] = useState("Verifying your payment with Polar…");
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        let pollTimer: ReturnType<typeof setTimeout> | undefined;
        let redirectTimer: ReturnType<typeof setTimeout> | undefined;
        let attempts = 0;
        let accountAttempts = 0;

        const checkoutId = new URLSearchParams(window.location.search).get("checkout_id")?.trim();

        const fail = (nextMessage: string) => {
            if (cancelled) return;
            setMessage(nextMessage);
            setState("error");
        };

        const verifyCheckout = async () => {
            if (!checkoutId) {
                fail("This page is missing its checkout confirmation. Return to your dashboard to review your account.");
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                fail("Sign in to the account used for this purchase, then open the confirmation link again.");
                return;
            }

            try {
                const response = await fetch(
                    `/api/checkout-status?checkout_id=${encodeURIComponent(checkoutId)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                            Accept: "application/json",
                        },
                    },
                );
                const data = await response.json().catch(() => ({})) as {
                    status?: CheckoutStatus;
                    account_updated?: boolean;
                    error?: string;
                };

                if (!response.ok || !data.status) {
                    fail(data.error || "We could not verify this payment yet. Please review your account in the dashboard.");
                    return;
                }

                if (data.status === "succeeded") {
                    if (cancelled) return;

                    if (data.account_updated) {
                        setMessage("Your payment is confirmed and your account has been updated.");
                        setState("success");
                        redirectTimer = setTimeout(() => router.push(SUCCESS_REDIRECT), 2000);
                        return;
                    }

                    accountAttempts += 1;
                    if (accountAttempts >= MAX_ACCOUNT_ATTEMPTS) {
                        setMessage("Your payment is confirmed. Your account is still updating and will show the purchase within a few minutes.");
                        setState("success");
                        redirectTimer = setTimeout(() => router.push(PENDING_REDIRECT), 3000);
                        return;
                    }

                    setMessage("Payment confirmed. Updating your account…");
                    pollTimer = setTimeout(verifyCheckout, POLL_INTERVAL_MS);
                    return;
                }

                if (data.status === "failed" || data.status === "expired") {
                    fail("Polar did not complete this payment. No purchase has been confirmed.");
                    return;
                }

                attempts += 1;
                if (attempts >= MAX_CHECKOUT_ATTEMPTS) {
                    fail("Polar is still finalizing this checkout. Open your dashboard in a moment to review the account status.");
                    return;
                }

                if (!cancelled) {
                    setMessage("Polar is finalizing your payment. This usually takes only a few seconds…");
                    pollTimer = setTimeout(verifyCheckout, POLL_INTERVAL_MS);
                }
            } catch {
                fail("We could not reach the payment verifier. Your dashboard will show the purchase after Polar confirms it.");
            }
        };

        void verifyCheckout();

        return () => {
            cancelled = true;
            if (pollTimer) clearTimeout(pollTimer);
            if (redirectTimer) clearTimeout(redirectTimer);
        };
    }, [router]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-yellow-tint px-4 py-12 text-ink">
            <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-notebook sm:p-8" aria-live="polite">
                <Image
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro"
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16"
                />
                <div
                    className={cn(
                        "mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full",
                        state === "success" && "bg-green-50 text-success",
                        state === "error" && "bg-amber-50 text-warning",
                        state === "processing" && "bg-yellow-soft text-ink",
                    )}
                    aria-hidden="true"
                >
                    {state === "success" ? (
                        <CheckCircle className="h-8 w-8" />
                    ) : state === "error" ? (
                        <AlertTriangle className="h-8 w-8" />
                    ) : (
                        <Loader2 className="h-8 w-8 animate-spin" />
                    )}
                </div>

                <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                    {state === "success" ? "Payment confirmed" : state === "error" ? "Confirmation needed" : "Checking your payment"}
                </h1>
                <p className="mt-3 leading-7 text-ink-muted">{message}</p>
                {state === "success" && (
                    <p className="mt-2 text-sm text-ink-muted">Redirecting to your dashboard…</p>
                )}
                <div className="mt-8 grid gap-3">
                    <Button onClick={() => router.push("/dashboard")} className="w-full">
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        </main>
    );
}
