"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type PaymentState = "processing" | "success" | "error";
type CheckoutStatus = "open" | "expired" | "confirmed" | "succeeded" | "failed";

export default function PaymentSuccess() {
    const [state, setState] = useState<PaymentState>("processing");
    const [message, setMessage] = useState("Verifying your payment with Polar…");
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        let pollTimer: ReturnType<typeof setTimeout> | undefined;
        let redirectTimer: ReturnType<typeof setTimeout> | undefined;
        let attempts = 0;

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
                    error?: string;
                };

                if (!response.ok || !data.status) {
                    fail(data.error || "We could not verify this payment yet. Please review your account in the dashboard.");
                    return;
                }

                if (data.status === "succeeded") {
                    if (cancelled) return;
                    setMessage("Your payment is confirmed. Your account will update from Polar’s secure webhook.");
                    setState("success");
                    redirectTimer = setTimeout(() => router.push("/dashboard"), 3000);
                    return;
                }

                if (data.status === "failed" || data.status === "expired") {
                    fail("Polar did not complete this payment. No purchase has been confirmed.");
                    return;
                }

                attempts += 1;
                if (attempts >= 10) {
                    fail("Polar is still finalizing this checkout. Open your dashboard in a moment to review the account status.");
                    return;
                }

                if (!cancelled) {
                    setMessage("Polar is finalizing your payment. This usually takes only a few seconds…");
                    pollTimer = setTimeout(verifyCheckout, 2000);
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
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-white px-5">
            <div className="text-center max-w-md mx-auto rounded-3xl border border-slate-200 bg-white p-8 shadow-sm" aria-live="polite">
                {state === "success" ? (
                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" aria-hidden="true" />
                ) : state === "error" ? (
                    <AlertTriangle className="h-14 w-14 text-amber-600 mx-auto mb-4" aria-hidden="true" />
                ) : (
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-100 border-b-teal-600 mx-auto mb-5" aria-hidden="true" />
                )}

                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                    {state === "success" ? "Payment confirmed" : state === "error" ? "Confirmation needed" : "Checking your payment"}
                </h1>
                <p className="text-gray-600 mb-6">{message}</p>
                {state === "success" && (
                    <p className="text-sm text-gray-500 mb-4">Redirecting to your dashboard…</p>
                )}
                <Button
                    onClick={() => router.push("/dashboard")}
                    className="bg-teal-700 hover:bg-teal-800 text-white px-6 py-2 rounded-lg"
                >
                    Go to Dashboard
                </Button>
            </div>
        </main>
    );
}
