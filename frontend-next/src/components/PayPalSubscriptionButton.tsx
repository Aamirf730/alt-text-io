"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PAYPAL_CLIENT_ID } from '@/lib/paypal';
import { toast } from 'sonner';

interface PayPalSubscriptionButtonProps {
    planId: string;
    planName: string;
    paypalPlanId: string;
    onSuccess?: () => void;
    onError?: (error: any) => void;
}



const PayPalSubscriptionButton: React.FC<PayPalSubscriptionButtonProps> = ({
    planId,
    planName,
    paypalPlanId,
    onSuccess,
    onError
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const buttonContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load PayPal SDK script if not already loaded
        if (!(window as any).paypal) {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
            script.async = true;
            script.setAttribute('data-sdk-integration-source', 'button-factory');
            script.onload = () => {
                setScriptLoaded(true);
            };
            script.onerror = () => {
                console.error('Failed to load PayPal SDK');
                onError?.({ message: 'Failed to load PayPal SDK. Please refresh the page.' });
            };
            document.body.appendChild(script);
        } else {
            setScriptLoaded(true);
        }

        return () => {
            // Cleanup: remove PayPal buttons if component unmounts
            if (buttonContainerRef.current) {
                buttonContainerRef.current.innerHTML = '';
            }
        };
    }, [onError]);

    useEffect(() => {
        if (!scriptLoaded || !(window as any).paypal || !buttonContainerRef.current) return;

        // Clear any existing buttons
        buttonContainerRef.current.innerHTML = '';

        // Render PayPal subscription button using native SDK
        (window as any).paypal.Buttons({
            style: {
                shape: 'pill',
                color: 'blue',
                layout: 'vertical',
                label: 'subscribe'
            },
            createSubscription: function (data: any, actions: any) {
                console.log('Creating PayPal subscription for plan:', paypalPlanId);
                return actions.subscription.create({
                    plan_id: paypalPlanId
                });
            },
            onApprove: async function (data: any, actions: any) {
                try {
                    setIsLoading(true);
                    console.log('PayPal subscription approved:', data);
                    console.log('Subscription ID:', data.subscriptionID);

                    // Get user session
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) {
                        throw new Error('Please sign in to continue');
                    }

                    // Determine API base URL
                    let apiBase;
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
                    } else {
                        apiBase = '/.netlify/functions';
                    }

                    // Complete the subscription on our backend
                    const response = await fetch(`${apiBase}/complete-payment`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            subscriptionId: data.subscriptionID,
                            planId: planId
                        })
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Subscription completion failed');
                    }

                    console.log('Subscription completed successfully:', result);
                    onSuccess?.();
                } catch (error) {
                    console.error('Subscription completion error:', error);
                    onError?.(error);
                } finally {
                    setIsLoading(false);
                }
            },
            onError: function (err: any) {
                console.error('PayPal button error:', err);
                setIsLoading(false);
                onError?.({ message: err.message || 'PayPal subscription failed. Please try again.' });
            },
            onCancel: function (data: any) {
                console.log('PayPal subscription cancelled:', data);
                setIsLoading(false);
                toast.info('Subscription cancelled');
            }
        }).render(buttonContainerRef.current);
    }, [scriptLoaded, paypalPlanId, planId, onSuccess, onError]);

    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-700">Processing subscription...</span>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div ref={buttonContainerRef} id={`paypal-button-container-${paypalPlanId}`}></div>
        </div>
    );
};

export default PayPalSubscriptionButton;
