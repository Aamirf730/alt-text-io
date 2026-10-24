"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from '@/lib/supabase';
import { CheckCircle, X } from "lucide-react";
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
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <Image
                            src="/logo-alt-text-pro.png"
                            alt="Alt Text Pro Logo"
                            width={64}
                            height={64}
                            className="h-16 w-16 object-contain"
                        />
                    </div>

                    {isLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirming your email...</h1>
                            <p className="text-gray-600">Please wait while we verify your account.</p>
                        </>
                    ) : error ? (
                        <>
                            <div className="mb-4">
                                <X className="h-12 w-12 mx-auto text-red-500" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirmation Failed</h1>
                            <p className="text-gray-600 mb-6">{error}</p>
                            <Button
                                onClick={() => router.push('/')}
                                className="w-full bg-black text-white"
                            >
                                Go to Homepage
                            </Button>
                        </>
                    ) : isConfirmed ? (
                        <>
                            <div className="mb-4">
                                <CheckCircle className="h-16 w-16 mx-auto text-black" />
                            </div>
                            <h1 className="text-3xl font-bold mb-4 text-black">
                                Thanks for confirming your email!
                            </h1>
                            <p className="text-gray-600 mb-6">
                                Your account has been successfully verified. Taking you to your dashboard in a few seconds.
                            </p>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => router.push('/dashboard')}
                                    className="w-full bg-black text-white"
                                >
                                    Go to dashboard
                                </Button>
                                <Button
                                    onClick={() => router.push('/')}
                                    variant="outline"
                                    className="w-full border-black text-black"
                                >
                                    Back to Homepage
                                </Button>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </main>
    );
}
