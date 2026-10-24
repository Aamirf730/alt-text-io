"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from '@/lib/supabase';
import { CheckCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Email Confirmation Component
export default function EmailConfirmation() {
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // The page promises a redirect, so make it happen.
    useEffect(() => {
        if (!isConfirmed) return;
        const timer = window.setTimeout(() => router.push('/dashboard'), 3000);
        return () => window.clearTimeout(timer);
    }, [isConfirmed, router]);

    useEffect(() => {
        const handleEmailConfirmation = async () => {
            try {
                // The secure /auth/confirm route consumes the one-time
                // token_hash and establishes the Supabase session before this
                // page is rendered. Never accept access/refresh tokens from a
                // URL hash or query string here.
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    setError('Please use the secure confirmation link or sign in again.');
                } else {
                    setIsConfirmed(true);
                }

                // Remove any legacy token-shaped URL fragments without reading
                // or consuming them.
                window.history.replaceState({}, document.title, '/email-confirmed');
            } catch (err: any) {
                console.error('Email confirmation error:', err);
                setError(err.message || 'Failed to confirm email. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        handleEmailConfirmation();
    }, []);

    return (
        <main className="flex min-h-screen items-center justify-center bg-yellow-tint px-4 py-12 text-ink">
            <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-notebook sm:p-8">
                <Image
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro Logo"
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16 object-contain"
                />

                {isLoading ? (
                    <>
                        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-soft text-ink" aria-hidden="true">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                        <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight text-ink">Confirming your email...</h1>
                        <p className="mt-3 leading-7 text-ink-muted">Please wait while we verify your account.</p>
                    </>
                ) : error ? (
                    <>
                        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-error" aria-hidden="true">
                            <X className="h-8 w-8" />
                        </div>
                        <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight text-ink">Confirmation Failed</h1>
                        <p className="mt-3 leading-7 text-ink-muted">{error}</p>
                        <div className="mt-8 grid gap-3">
                            <Button onClick={() => router.push('/')} className="w-full">
                                Go to Homepage
                            </Button>
                        </div>
                    </>
                ) : isConfirmed ? (
                    <>
                        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-success" aria-hidden="true">
                            <CheckCircle className="h-8 w-8" />
                        </div>
                        <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                            Thanks for confirming your email!
                        </h1>
                        <p className="mt-3 leading-7 text-ink-muted">
                            Your account has been successfully verified. Taking you to your dashboard in a few seconds.
                        </p>
                        <div className="mt-8 grid gap-3">
                            <Button onClick={() => router.push('/dashboard')} className="w-full">
                                Go to dashboard
                            </Button>
                            <Button onClick={() => router.push('/')} variant="secondary" className="w-full">
                                Back to Homepage
                            </Button>
                        </div>
                    </>
                ) : null}
            </div>
        </main>
    );
}
