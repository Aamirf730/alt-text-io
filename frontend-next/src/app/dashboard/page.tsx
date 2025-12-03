"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { PAYPAL_PLAN_IDS, paypalOptions, paypalSubscriptionOptions } from '@/lib/paypal';
import { toast } from "sonner";
import {
    Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket,
    Chrome, Upload, Eye, EyeOff, Download, Check, Search,
    CreditCard, Calendar, TrendingUp, Key, Copy, Info, AlertTriangle,
    RefreshCw, Book, FileText, HelpCircle, Settings, Code, DollarSign,
    Wrench, Globe, LogOut, MessageCircle, Image as ImageIcon, Crown, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [usageStats, setUsageStats] = useState<any>(null);
    const [testImage, setTestImage] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [subscriptionData, setSubscriptionData] = useState<any>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedAltText, setGeneratedAltText] = useState("");
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);

    const router = useRouter();

    useEffect(() => {
        loadDashboard();
        loadHistory();
    }, []);

    // Load API key when user is available
    useEffect(() => {
        if (user && user.token) {
            loadApiKey();
        }
    }, [user]);

    // Load subscription data from API
    const loadSubscriptionData = async (token: string) => {
        try {
            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Use localhost Netlify Dev functions (port 9999)
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                apiBase = '/.netlify/functions';
            }

            const response = await fetch(`${apiBase}/get-subscription`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSubscriptionData(data);
            } else {
                console.warn('Subscription API not available, using fallback data');
                // Fallback subscription data for development
                setSubscriptionData({
                    subscription: {
                        plan: 'free',
                        status: 'active',
                        subscription_id: null,
                        next_billing_date: null
                    }
                });
            }
        } catch (error: any) {
            console.warn('Subscription API not available, using fallback data:', error.message);
            // Fallback subscription data for development
            setSubscriptionData({
                subscription: {
                    plan: 'free',
                    status: 'active',
                    subscription_id: null,
                    next_billing_date: null
                }
            });
        }
    };

    // Handle upgrade plan selection
    const handleUpgradePlan = (planId: string, planName: string, planPrice: string) => {
        setSelectedUpgradePlan({ id: planId, name: planName, price: planPrice });
        setShowUpgradeModal(true);
    };

    // Handle PayPal subscription creation for upgrades (using SDK)
    const createUpgradePayPalSubscription = async (data: any, actions: any) => {
        try {
            if (!user?.token) {
                throw new Error('No valid session');
            }

            // Get the PayPal plan ID for the selected upgrade plan
            // Default to monthly for upgrades as dashboard doesn't have billing cycle toggle yet
            const planGroup = PAYPAL_PLAN_IDS[selectedUpgradePlan.id];
            const paypalPlanId = planGroup?.monthly;

            if (!paypalPlanId) {
                throw new Error(`No PayPal plan ID found for ${selectedUpgradePlan.id}`);
            }

            console.log('Creating PayPal subscription via SDK for upgrade plan:', selectedUpgradePlan.id);
            console.log('PayPal Plan ID:', paypalPlanId);

            // Use PayPal SDK's createSubscription method
            return actions.subscription.create({
                plan_id: paypalPlanId
            });
        } catch (error) {
            console.error('PayPal subscription creation error:', error);
            toast.error('Failed to create subscription. Please try again.');
            throw error;
        }
    };

    // Handle PayPal payment creation for upgrades (one-time payments)
    const createUpgradePayPalOrder = async (data: any, actions: any) => {
        try {
            if (!selectedUpgradePlan) {
                throw new Error('No plan selected');
            }

            // Create order directly using PayPal SDK
            return actions.order.create({
                purchase_units: [{
                    description: `${selectedUpgradePlan.name} - 300 Credits`,
                    amount: {
                        currency_code: 'USD',
                        value: '5.00'
                    }
                }],
                application_context: {
                    brand_name: 'Alt Text Pro',
                    shipping_preference: 'NO_SHIPPING'
                }
            });
        } catch (error: any) {
            console.error('PayPal order creation error:', error);
            toast.error('Failed to create payment. Please try again.');
            throw error;
        }
    };

    // Handle PayPal subscription approval for upgrades (using SDK)
    const onUpgradePayPalSubscriptionApprove = async (data: any, actions: any) => {
        try {
            if (!user?.token) {
                throw new Error('No valid session');
            }

            console.log('PayPal subscription approved for upgrade:', data);
            console.log('Subscription ID:', data.subscriptionID);

            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Use localhost Netlify Dev functions (port 9999)
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                apiBase = '/.netlify/functions';
            }

            // Complete the subscription on our backend
            const response = await fetch(`${apiBase}/complete-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    subscriptionId: data.subscriptionID,
                    planId: selectedUpgradePlan.id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Subscription completion failed');
            }

            toast.success(`Successfully upgraded to ${selectedUpgradePlan.name}!`);
            setShowUpgradeModal(false);
            setSelectedUpgradePlan(null);

            // Reload dashboard data
            await loadDashboard();

        } catch (error) {
            console.error('PayPal subscription approval error:', error);
            toast.error('Subscription failed. Please try again.');
        }
    };

    // Handle PayPal payment approval for upgrades (one-time payments)
    const onUpgradePayPalApprove = async (data: any, actions: any) => {
        try {
            if (!user?.token) {
                throw new Error('No valid session');
            }

            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Use localhost Netlify Dev functions (port 9999)
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                apiBase = '/.netlify/functions';
            }

            // For one-time payments, capture the order first using PayPalButtons actions
            if (actions && actions.order) {
                const captureResult = await actions.order.capture();
                console.log('PayPal order captured:', captureResult);
            }

            const response = await fetch(`${apiBase}/complete-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    paymentId: data.orderID,
                    planId: selectedUpgradePlan.id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Payment completion failed');
            }

            toast.success(`Successfully purchased ${selectedUpgradePlan.name}!`);
            setShowUpgradeModal(false);
            setSelectedUpgradePlan(null);

            // Reload dashboard data
            await loadDashboard();

        } catch (error) {
            console.error('PayPal approval error:', error);
            toast.error('Payment failed. Please try again.');
        }
    };

    // Load history when user or stats change
    useEffect(() => {
        if (user) {
            loadHistory();
        }
    }, [user]);

    // Load API key for WordPress plugin
    const loadApiKey = async () => {
        if (!user?.id) return;

        setIsLoadingApiKey(true);
        try {
            // First, try to get existing API key from Supabase
            const { data: existingKeys, error: fetchError } = await supabase
                .from('api_keys')
                .select('api_key')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (fetchError) {
                console.error('Error fetching API key:', fetchError);
                // If table doesn't exist or RLS issue, try using the function
                const { data: functionResult, error: functionError } = await supabase
                    .rpc('get_or_create_api_key', { p_user_id: user.id });

                if (functionError) {
                    console.error('Error calling get_or_create_api_key:', functionError);
                    toast.error('Error loading API key');
                    return;
                }

                setApiKey(functionResult);
                return;
            }

            // If we have an existing key, use it
            if (existingKeys && existingKeys.length > 0) {
                setApiKey(existingKeys[0].api_key);
                return;
            }

            // If no key exists, create one using the function
            const { data: newKey, error: createError } = await supabase
                .rpc('get_or_create_api_key', { p_user_id: user.id });

            if (createError) {
                console.error('Error creating API key:', createError);
                toast.error('Error creating API key');
                return;
            }

            setApiKey(newKey);
        } catch (error) {
            console.error('Error loading API key:', error);
            toast.error('Error loading API key');
        } finally {
            setIsLoadingApiKey(false);
        }
    };

    const loadDashboard = async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                toast.error("Please sign in to access the dashboard");
                router.push("/");
                return;
            }

            setUser({
                email: session.user.email,
                id: session.user.id,
                token: session.access_token
            });

            // Fetch real usage data from API (same endpoint the plugin uses for consistency)
            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Use localhost Netlify Dev functions (port 9999)
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                apiBase = '/.netlify/functions';
            }

            try {
                const usageResponse = await fetch(`${apiBase}/get-usage`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (usageResponse.ok) {
                    const usageData = await usageResponse.json();
                    if (usageData.success && usageData.data) {
                        setUsageStats({
                            credits_remaining: usageData.data.credits_remaining || 0,
                            total_processed: usageData.data.total_generated || 0,
                            plan: usageData.data.subscription_plan || 'free'
                        });
                    } else {
                        throw new Error('Invalid API response format');
                    }
                } else {
                    throw new Error(`API returned status ${usageResponse.status}`);
                }
            } catch (error) {
                console.error('Error loading usage data from API:', error);
                // Fallback: try direct Supabase query as backup
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('credits_remaining, total_processed, subscription_plan, subscription_status, next_billing_date')
                    .eq('id', session.user.id)
                    .single();

                if (profileError || !profile) {
                    console.error('Error loading profile:', profileError);
                    // Final fallback to default if both methods fail
                    setUsageStats({
                        credits_remaining: 50,
                        total_processed: 0,
                        plan: 'Free Trial'
                    });
                } else {
                    setUsageStats({
                        credits_remaining: profile.credits_remaining || 50,
                        total_processed: profile.total_processed || 0,
                        plan: profile.subscription_plan || 'Free Trial'
                    });
                }
            }

            // Load subscription data from API (non-blocking)
            loadSubscriptionData(session.access_token).catch(err => {
                console.warn('Could not load subscription data:', err.message);
            });

            setIsLoading(false);
        } catch (error) {
            console.error("Failed to load dashboard:", error);
            toast.error("Failed to load dashboard. Please try logging in again.");
            router.push("/");
        }
    };

    const loadHistory = async () => {
        if (!user?.id) return;

        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('usage_logs')
                .select('id, alt_text_generated, image_context, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error loading history:', error);
            } else {
                setHistory(data || []);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setTestImage(e.target?.result as string);
                setTestResult(null);
                setGeneratedAltText("");
            };
            reader.readAsDataURL(file);
        }
    };

    const generateTestAltText = async () => {
        if (!testImage) {
            toast.error("Please upload an image first");
            return;
        }

        if (!user?.token) {
            toast.error("Session expired. Please sign in again.");
            router.push("/");
            return;
        }

        // Check if user has credits
        if (usageStats?.credits_remaining <= 0) {
            toast.error("No credits remaining. Please upgrade your plan to continue.");
            setShowUpgradeModal(true);
            return;
        }

        setIsGenerating(true);
        try {
            // Extract base64 from data URL
            const base64Data = testImage.split(',')[1];

            // Determine API endpoint - use local development or production
            // For localhost, use production API (Netlify Dev server not required)
            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Use localhost Netlify Dev functions (port 9999)
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                // Production - use relative path
                apiBase = '/.netlify/functions';
            }

            const endpoint = `${apiBase}/generate-alt-text`;

            console.log('🔍 Generating alt-text:', {
                endpoint,
                hasImage: !!base64Data,
                imageSize: base64Data?.length,
                hasToken: !!user.token
            });

            // Call the real API
            const apiResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    image_base64: base64Data,
                    context: 'Dashboard test'
                })
            });

            // Check if response is OK before parsing JSON
            let data;
            try {
                const responseText = await apiResponse.text();
                if (!responseText) {
                    throw new Error('Empty response from server');
                }
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                toast.error("Invalid response from server. Please try again.");
                return;
            }

            if (apiResponse.ok) {
                // Update with real data from API response
                const result = {
                    alt_text: data.alt_text || data.altText,
                    credits_used: 1,
                    credits_remaining: data.credits_remaining
                };

                setTestResult(result);

                // Update usage stats with real credits from API
                setUsageStats((prev: any) => ({
                    ...prev,
                    credits_remaining: data.credits_remaining,
                    total_processed: data.total_processed || (prev?.total_processed || 0) + 1
                }));

                // Update generated alt-text state for display
                setGeneratedAltText(result.alt_text);

                // Reload history to show new generation
                loadHistory();

                toast.success("Alt-text generated successfully!");
            } else {
                console.error('API Error Response:', {
                    status: apiResponse.status,
                    statusText: apiResponse.statusText,
                    data: data
                });

                if (apiResponse.status === 401) {
                    toast.error("Session expired. Please sign in again.");
                    router.push("/");
                } else if (apiResponse.status === 402) {
                    toast.error("No credits remaining. Please upgrade your plan.");
                } else {
                    toast.error(data.error || `Server error (${apiResponse.status}). Please try again.`);
                }
            }
        } catch (error) {
            console.error("Failed to generate alt-text:", error);
            toast.error("Failed to generate alt-text. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Navigation */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link href="/" className="flex items-center space-x-3">
                            <img
                                src="/logo-alt-text-pro.png"
                                alt="Alt Text Pro Logo"
                                className="h-8 w-8 object-contain"
                            />
                            <span className="text-xl font-bold text-gray-900">Alt Text Pro</span>
                        </Link>
                        <div className="flex items-center space-x-4">
                            <div className="hidden md:block text-sm text-gray-500">
                                Logged in as <span className="font-medium text-gray-900">{user?.email}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-600 hover:text-gray-900"
                                onClick={async () => {
                                    try {
                                        const { error } = await supabase.auth.signOut();
                                        if (!error) {
                                            toast.success("Logged out successfully");
                                            router.push("/");
                                        }
                                    } catch (error) {
                                        toast.error("Logout failed");
                                    }
                                }}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Sign Out
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-gray-500 mt-1">Manage your account, credits, and API keys</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Plugin v1.4.21</span>
                        <a
                            href="/wordpress-plugin/alt-text-pro-plugin-1.4.21.zip"
                            download="alt-text-pro-plugin-1.4.21.zip"
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-all rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5"
                            style={{
                                background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'
                            }}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download Plugin
                        </a>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Credits Card */}
                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Available Credits</p>
                                    <h3 className="text-3xl font-bold text-gray-900 mt-1">{usageStats?.credits_remaining || 0}</h3>
                                </div>
                                <div className="p-2 bg-teal-50 rounded-lg">
                                    <Zap className="h-6 w-6 text-teal-600" />
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                                <div
                                    className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(((usageStats?.credits_remaining || 0) / 50) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>{usageStats?.plan === 'free' ? '50 total' : 'Monthly quota'}</span>
                                <button
                                    onClick={() => handleUpgradePlan('pay_as_go', 'Pay as you go', '$5')}
                                    className="text-teal-600 font-medium hover:text-teal-700"
                                >
                                    Top up +
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Generated Card */}
                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Total Generated</p>
                                    <h3 className="text-3xl font-bold text-gray-900 mt-1">{usageStats?.total_processed || 0}</h3>
                                </div>
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <ImageIcon className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500">
                                Images processed successfully
                            </p>
                        </CardContent>
                    </Card>

                    {/* Plan Card */}
                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Current Plan</p>
                                    <h3 className="text-3xl font-bold text-gray-900 mt-1 capitalize">{usageStats?.plan || 'Free'}</h3>
                                </div>
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <Crown className="h-6 w-6 text-purple-600" />
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center"
                            >
                                Manage Subscription <ArrowRight className="h-4 w-4 ml-1" />
                            </button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content Area - Left 2/3 */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Test Alt Text Section */}
                        <Card className="border-none shadow-sm">
                            <CardHeader className="border-b border-gray-100 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-semibold text-gray-900">Quick Test</CardTitle>
                                        <p className="text-sm text-gray-500">Generate alt-text for an image instantly</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 rounded-full">
                                        <Brain className="h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                {!testImage ? (
                                    <div
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-all duration-200"
                                        onClick={() => document.getElementById('image-upload-input')?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.add('border-teal-500', 'bg-teal-50');
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50');
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50');
                                            const file = e.dataTransfer.files[0];
                                            if (file && file.type.startsWith('image/')) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    setTestImage(event.target?.result as string);
                                                    setTestResult(null);
                                                    setGeneratedAltText("");
                                                };
                                                reader.readAsDataURL(file);
                                            } else {
                                                toast.error("Please upload an image file");
                                            }
                                        }}
                                    >
                                        <input
                                            id="image-upload-input"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Upload className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <h4 className="text-gray-900 font-medium mb-1">Click to upload or drag and drop</h4>
                                        <p className="text-sm text-gray-500">
                                            PNG, JPG, GIF up to 10MB
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="flex gap-6">
                                            <div className="w-1/3 relative group">
                                                <img
                                                    src={testImage}
                                                    alt="Test"
                                                    className="w-full h-48 object-cover rounded-lg shadow-sm"
                                                />
                                                <button
                                                    onClick={() => {
                                                        setTestImage(null);
                                                        setTestResult(null);
                                                        setGeneratedAltText("");
                                                    }}
                                                    className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                                >
                                                    <X className="h-4 w-4 text-gray-600" />
                                                </button>
                                            </div>
                                            <div className="w-2/3 space-y-4">
                                                <div className="bg-gray-50 rounded-lg p-4 h-full border border-gray-100">
                                                    {isGenerating ? (
                                                        <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
                                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                                                            <p className="text-sm font-medium">Analyzing image...</p>
                                                        </div>
                                                    ) : generatedAltText ? (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">Generated Result</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(generatedAltText);
                                                                        toast.success("Copied to clipboard");
                                                                    }}
                                                                >
                                                                    <Copy className="h-3 w-3 text-gray-500" />
                                                                </Button>
                                                            </div>
                                                            <p className="text-gray-800 text-sm leading-relaxed">{generatedAltText}</p>
                                                            <div className="pt-2 flex items-center gap-2 text-xs text-gray-400">
                                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                                <span>SEO Optimized</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                                                            <Brain className="h-8 w-8 opacity-20" />
                                                            <p className="text-sm">Ready to generate</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!generatedAltText && (
                                            <Button
                                                onClick={generateTestAltText}
                                                disabled={isGenerating}
                                                className="w-full"
                                                style={{
                                                    background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'
                                                }}
                                            >
                                                {isGenerating ? 'Generating...' : 'Generate Alt Text'}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent History */}
                        <Card className="border-none shadow-sm">
                            <CardHeader className="border-b border-gray-100 pb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-semibold text-gray-900">Recent History</CardTitle>
                                    <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                                        View All
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingHistory ? (
                                    <div className="p-8 text-center text-gray-500">Loading history...</div>
                                ) : history.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        <p>No history yet. Generate your first alt-text!</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {history.map((item: any) => (
                                            <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                                                <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                                                    <ImageIcon className="h-5 w-5 text-gray-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-900 font-medium truncate">{item.alt_text_generated}</p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(item.created_at).toLocaleDateString()} • {item.image_context || 'No context'}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.alt_text_generated);
                                                        toast.success("Copied to clipboard");
                                                    }}
                                                >
                                                    <Copy className="h-4 w-4 text-gray-400" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar - Right 1/3 */}
                    <div className="space-y-8">
                        {/* API Key Section */}
                        <Card className="border-none shadow-sm bg-gray-900 text-white overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-32 bg-teal-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <CardHeader className="relative z-10">
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Key className="h-5 w-5 text-teal-400" />
                                    API Key
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <p className="text-gray-400 text-sm mb-4">
                                    Use this key to authenticate your requests in the WordPress plugin.
                                </p>
                                <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-between mb-4 border border-gray-700">
                                    <code className="text-teal-400 font-mono text-sm truncate mr-2">
                                        {isLoadingApiKey ? 'Loading...' : (showApiKey ? (apiKey || 'No API Key found') : '•'.repeat(24))}
                                    </code>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
                                        >
                                            {showApiKey ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (apiKey) {
                                                    navigator.clipboard.writeText(apiKey);
                                                    toast.success("API key copied");
                                                } else {
                                                    toast.error("No API key to copy");
                                                }
                                            }}
                                            className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
                                        >
                                            <Copy className="h-4 w-4 text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                                        onClick={() => router.push('/docs')}
                                    >
                                        <Book className="h-4 w-4 mr-2" />
                                        Docs
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                                        onClick={loadApiKey}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Regenerate
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Support Card */}
                        <Card className="border-none shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <HelpCircle className="h-5 w-5 text-purple-500" />
                                    Need Help?
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <Link
                                        href="/docs"
                                        className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="p-2 bg-purple-50 rounded-md group-hover:bg-purple-100 transition-colors">
                                            <FileText className="h-4 w-4 text-purple-600" />
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-gray-900">Documentation</p>
                                            <p className="text-xs text-gray-500">Read the guides</p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-purple-500" />
                                    </Link>
                                    <Link
                                        href="/contact"
                                        className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="p-2 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors">
                                            <MessageCircle className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-gray-900">Contact Support</p>
                                            <p className="text-xs text-gray-500">Get in touch</p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-blue-500" />
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h2>
                                <p className="text-gray-500 mt-1">Choose the perfect plan for your needs</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowUpgradeModal(false);
                                    setSelectedUpgradePlan(null);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-8">
                            {selectedUpgradePlan ? (
                                <div className="max-w-md mx-auto">
                                    <div className="text-center mb-8">
                                        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Crown className="h-8 w-8 text-teal-600" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Complete Purchase</h3>
                                        <p className="text-gray-500 mt-2">
                                            You are upgrading to <span className="font-semibold text-gray-900">{selectedUpgradePlan.name}</span>
                                        </p>
                                        <div className="mt-4 text-3xl font-bold text-teal-600">
                                            {selectedUpgradePlan.price}
                                            {selectedUpgradePlan.id !== 'pay_as_go' && <span className="text-sm text-gray-500 font-normal">/month</span>}
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-xl p-6 mb-8">
                                        <h4 className="font-medium text-gray-900 mb-4">Order Summary</h4>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-gray-600">{selectedUpgradePlan.name}</span>
                                            <span className="font-medium">{selectedUpgradePlan.price}</span>
                                        </div>
                                        <Separator className="my-4" />
                                        <div className="flex justify-between items-center text-lg font-bold">
                                            <span>Total</span>
                                            <span>{selectedUpgradePlan.price}</span>
                                        </div>
                                    </div>

                                    <PayPalScriptProvider options={selectedUpgradePlan.id === 'pay_as_go' ? paypalOptions : paypalSubscriptionOptions}>
                                        <PayPalButtons
                                            style={{ layout: "vertical", shape: "rect", label: selectedUpgradePlan.id === 'pay_as_go' ? "pay" : "subscribe" }}
                                            createOrder={selectedUpgradePlan.id === 'pay_as_go' ? createUpgradePayPalOrder : undefined}
                                            createSubscription={selectedUpgradePlan.id !== 'pay_as_go' ? createUpgradePayPalSubscription : undefined}
                                            onApprove={selectedUpgradePlan.id === 'pay_as_go' ? onUpgradePayPalApprove : onUpgradePayPalSubscriptionApprove}
                                            onError={(err) => {
                                                console.error("PayPal Error:", err);
                                                toast.error("Payment failed. Please try again.");
                                            }}
                                        />
                                    </PayPalScriptProvider>

                                    <button
                                        onClick={() => setSelectedUpgradePlan(null)}
                                        className="w-full mt-4 text-gray-500 hover:text-gray-900 text-sm font-medium"
                                    >
                                        Back to plans
                                    </button>
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-3 gap-8">
                                    {/* Tier 1 */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-teal-500 hover:shadow-lg transition-all cursor-pointer relative group">
                                        <div className="absolute top-0 right-0 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                                            POPULAR
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900">Starter</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$12</span>
                                            <span className="text-gray-500">/month</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-teal-500 mr-2" />
                                                1,000 credits/month
                                            </li>
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-teal-500 mr-2" />
                                                Priority support
                                            </li>
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-teal-500 mr-2" />
                                                Bulk processing
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full"
                                            onClick={() => handleUpgradePlan('tier1', 'Starter Plan', '$12')}
                                            style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                                        >
                                            Choose Starter
                                        </Button>
                                    </div>

                                    {/* Tier 2 */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer">
                                        <h3 className="text-lg font-bold text-gray-900">Pro</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$20</span>
                                            <span className="text-gray-500">/month</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-purple-500 mr-2" />
                                                2,400 credits/month
                                            </li>
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-purple-500 mr-2" />
                                                Premium support
                                            </li>
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-purple-500 mr-2" />
                                                Advanced analytics
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-50"
                                            onClick={() => handleUpgradePlan('tier2', 'Pro Plan', '$20')}
                                        >
                                            Choose Pro
                                        </Button>
                                    </div>

                                    {/* Pay As You Go */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-amber-50 to-orange-50">
                                        <h3 className="text-lg font-bold text-gray-900">Pay As You Go</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$5</span>
                                            <span className="text-gray-500">/pack</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-amber-500 mr-2" />
                                                300 credits
                                            </li>
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-amber-500 mr-2" />
                                                Never expires
                                            </li>
                                            <li className="flex items-center text-sm text-gray-600">
                                                <Check className="h-4 w-4 text-amber-500 mr-2" />
                                                Adds to existing credits
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full text-white"
                                            style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
                                            onClick={() => handleUpgradePlan('pay_as_go', 'Credit Pack', '$5')}
                                        >
                                            Buy Credits
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
