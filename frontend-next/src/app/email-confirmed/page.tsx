"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from '@/lib/supabase';
import { trackMarketingEvent } from '@/lib/analytics';
import { CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Email Confirmation Component
export default function EmailConfirmation() {
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const handleEmailConfirmation = async () => {
            try {
                // Check both hash and query parameters (Supabase can use either)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const queryParams = new URLSearchParams(window.location.search);

                const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
                const type = hashParams.get('type') || queryParams.get('type');

                if (type === 'signup' && accessToken) {
                    // Set the session
                    const { data, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || ''
                    });

                    if (sessionError) {
                        throw sessionError;
                    }

                    if (data.session) {
                        // Email-confirmation signups have no session at the
                        // original sign-up form. Record the funnel event only
                        // after Supabase has confirmed and established the user
                        // session, so the server can verify its identity.
                        trackMarketingEvent('signup_created', {
                            source: 'landing_page',
                            properties: {
                                signup_method: 'email_confirmation',
                            },
                        });
                        setIsConfirmed(true);
                        // Clear URL hash/query to clean up the URL
                        window.history.replaceState({}, document.title, '/email-confirmed');
                    }
                } else {
                    // Check if user is already confirmed (might have been redirected here after confirmation)
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        if (type === 'signup') {
                            trackMarketingEvent('signup_created', {
                                source: 'landing_page',
                                properties: {
                                    signup_method: 'email_confirmation',
                                },
                            });
                        }
                        setIsConfirmed(true);
                        // Clear URL hash/query to clean up the URL
                        window.history.replaceState({}, document.title, '/email-confirmed');
                    } else {
                        // If no session and no token, show error
                        setError('Invalid confirmation link. Please try signing up again.');
                    }
                }
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
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                                style={{ borderColor: '#000000' }}></div>
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
                                className="w-full"
                                style={{
                                    background: 'linear-gradient(135deg, #000000 0%, #000000 100%)',
                                    color: 'white'
                                }}
                            >
                                Go to Homepage
                            </Button>
                        </>
                    ) : isConfirmed ? (
                        <>
                            <div className="mb-4">
                                <CheckCircle className="h-16 w-16 mx-auto" style={{ color: '#000000' }} />
                            </div>
                            <h1 className="text-3xl font-bold mb-4" style={{ color: '#000000' }}>
                                Thanks for confirming your email!
                            </h1>
                            <p className="text-gray-600 mb-6">
                                Your account has been successfully verified. You'll be redirected to your dashboard shortly.
                            </p>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => router.push('/dashboard')}
                                    className="w-full"
                                    style={{
                                        background: 'linear-gradient(135deg, #000000 0%, #000000 100%)',
                                        color: 'white'
                                    }}
                                >
                                    Sign In
                                </Button>
                                <Button
                                    onClick={() => router.push('/')}
                                    variant="outline"
                                    className="w-full"
                                    style={{
                                        borderColor: '#000000',
                                        color: '#000000'
                                    }}
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
