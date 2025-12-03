"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Payment Success Handler Component
// Following guidance pattern - simplified subscription activation
export default function PaymentSuccess() {
    const [status, setStatus] = useState('processing');
    const router = useRouter();

    useEffect(() => {
        // Use URLSearchParams to get query parameters (following guidance pattern)
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const subscriptionId = searchParams.get('subscription_id') ||
            searchParams.get('subscriptionId') ||
            hashParams.get('subscription_id') ||
            hashParams.get('subscriptionId') ||
            searchParams.get('token') ||
            hashParams.get('token');

        if (subscriptionId) {
            // Determine API base URL
            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                apiBase = '/.netlify/functions';
            }

            // Activate subscription (following guidance pattern)
            fetch(`${apiBase}/activate-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'ACTIVE') {
                        setStatus('success');
                        // Redirect to dashboard or update user state
                        setTimeout(() => {
                            router.push('/dashboard');
                        }, 2000);
                    } else if (data.status === 'APPROVAL_PENDING' || data.status === 'APPROVED') {
                        setStatus('pending');
                        // Still redirect - webhook will activate
                        setTimeout(() => {
                            router.push('/dashboard');
                        }, 2000);
                    } else {
                        setStatus('pending');
                        // Unknown status - redirect anyway
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
            // No subscription ID found - might be one-time payment or error
            console.warn('No subscription ID found in URL parameters');
            setStatus('error');
        }
    }, [router]);

    // Following guidance pattern - simple status-based rendering
    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
                <div className="text-center max-w-md mx-auto p-6">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">✓ Subscription Activated!</h1>
                    <p className="text-gray-600 mb-6">Welcome to Alt Text Pro! Your subscription is now active.</p>
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
                    <p className="text-gray-700">Processing your subscription...</p>
                </div>
            </div>
        );
    }

    if (status === 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Subscription Pending</h2>
                    <p className="text-gray-600 mb-6">Your subscription is being processed. You will be redirected to your dashboard shortly.</p>
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
