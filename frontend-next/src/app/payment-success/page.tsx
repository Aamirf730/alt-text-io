"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackMarketingEvent } from "@/lib/analytics";

// Payment Success Handler Component
// Works with Polar.sh checkout flow
export default function PaymentSuccess() {
    const [status, setStatus] = useState('processing');
    const router = useRouter();

    useEffect(() => {
        // Polar checkout returns customer_session_token after successful payment
        // The actual credit update happens via webhook, so we just show success here
        const searchParams = new URLSearchParams(window.location.search);

        // Check for Polar's customer session token (indicates successful checkout)
        const customerSessionToken = searchParams.get('customer_session_token');

        trackMarketingEvent("purchase_completed", {
            source: "web_app",
            properties: {
                provider: "polar",
                has_customer_session_token: Boolean(customerSessionToken),
            },
        });

        if (customerSessionToken) {
            // Polar checkout was successful - credits will be applied via webhook
            console.log('Polar checkout successful, token:', customerSessionToken);
            setStatus('success');

            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push('/dashboard');
            }, 3000);
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
