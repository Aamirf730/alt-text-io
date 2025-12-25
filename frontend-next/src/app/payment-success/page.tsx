"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Payment Success Handler Component
// Updated to work with Polar.sh checkout flow
export default function PaymentSuccess() {
    const [status, setStatus] = useState('processing');
    const router = useRouter();

    useEffect(() => {
        // Polar checkout returns customer_session_token after successful payment
        // The actual credit update happens via webhook, so we just show success here
        const searchParams = new URLSearchParams(window.location.search);

        // Check for Polar's customer session token (indicates successful checkout)
        const customerSessionToken = searchParams.get('customer_session_token');

        // Also check for legacy PayPal parameters for backward compatibility
        const subscriptionId = searchParams.get('subscription_id') ||
            searchParams.get('subscriptionId') ||
            searchParams.get('token');

        if (customerSessionToken) {
            // Polar checkout was successful - credits will be applied via webhook
            console.log('Polar checkout successful, token:', customerSessionToken);
            setStatus('success');

            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push('/dashboard');
            }, 3000);
        } else if (subscriptionId) {
            // Legacy PayPal flow - try to activate subscription
            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                apiBase = '/.netlify/functions';
            }

            fetch(`${apiBase}/activate-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'ACTIVE') {
                        setStatus('success');
                        setTimeout(() => {
                            router.push('/dashboard');
                        }, 2000);
                    } else if (data.status === 'APPROVAL_PENDING' || data.status === 'APPROVED') {
                        setStatus('pending');
                        setTimeout(() => {
                            router.push('/dashboard');
                        }, 2000);
                    } else {
                        setStatus('pending');
                        setTimeout(() => {
                            router.push('/dashboard');
                        }, 2000);
                    }
                })
                .catch(error => {
                    console.error('Subscription activation error:', error);
                    setStatus('error');
                });
        } else {
            // No recognized token - could be direct access or one-time payment
            // For Polar one-time payments, the webhook handles everything
            // Show success and redirect to dashboard
            console.log('No session token found, showing success and redirecting');
            setStatus('success');
            setTimeout(() => {
                router.push('/dashboard');
            }, 3000);
        }
    }, [router]);

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
                <div className="text-center max-w-md mx-auto p-6">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
                    <p className="text-gray-600 mb-6">
                        Thank you for your purchase! Your credits will be added to your account shortly.
                    </p>
                    <p className="text-sm text-gray-500 mb-4">Redirecting to dashboard...</p>
                    <Button
                        onClick={() => router.push('/dashboard')}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg"
                    >
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    if (status === 'processing') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <p className="text-gray-700">Processing your payment...</p>
                </div>
            </div>
        );
    }

    if (status === 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Processing</h2>
                    <p className="text-gray-600 mb-6">Your payment is being processed. You will be redirected to your dashboard shortly.</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
                <div className="text-center max-w-md mx-auto p-6">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h2>
                    <p className="text-gray-600 mb-6">Please contact support if this issue persists.</p>
                    <Button
                        onClick={() => router.push('/dashboard')}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg"
                    >
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return null;
}
