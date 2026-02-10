"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase';
import { getApiBase, PLUGIN_VERSION } from '@/lib/utils';
// Polar.sh product IDs from environment variables
const POLAR_PRODUCTS = {
    tier1_monthly: process.env.NEXT_PUBLIC_POLAR_TIER1_MONTHLY || '',
    tier1_annual: process.env.NEXT_PUBLIC_POLAR_TIER1_ANNUAL || '',
    tier2_monthly: process.env.NEXT_PUBLIC_POLAR_TIER2_MONTHLY || '',
    tier2_annual: process.env.NEXT_PUBLIC_POLAR_TIER2_ANNUAL || '',
    tier3_monthly: process.env.NEXT_PUBLIC_POLAR_TIER3_MONTHLY || '',
    tier3_annual: process.env.NEXT_PUBLIC_POLAR_TIER3_ANNUAL || '',
    small_pack: process.env.NEXT_PUBLIC_POLAR_SMALL_PACK || '',
    credit_pack: process.env.NEXT_PUBLIC_POLAR_CREDIT_PACK || '',
};
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
            // Skip API call on localhost - use fallback data for development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Using fallback subscription data for localhost');
                setSubscriptionData({
                    subscription: {
                        plan: 'free',
                        status: 'active',
                        subscription_id: null,
                        next_billing_date: null
                    }
                });
                return;
            }

            // Production: call Netlify function
            const response = await fetch(`/.netlify/functions/get-subscription`, {
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

    // Redirect to Polar.sh checkout
    const redirectToCheckout = (productId: string) => {
        if (!productId) {
            toast.error('Product not configured. Please contact support.');
            return;
        }

        let checkoutUrl = `/api/checkout?products=${productId}`;

        // Add customer email if user is logged in
        if (user?.email) {
            checkoutUrl += `&customerEmail=${encodeURIComponent(user.email)}`;
        }

        window.location.href = checkoutUrl;
    };

    // Get the correct Polar product ID based on plan
    const getPolarProductId = (planId: string): string => {
        // For dashboard upgrades, default to monthly plans
        if (planId === 'tier1') {
            return POLAR_PRODUCTS.tier1_monthly;
        }
        if (planId === 'tier2') {
            return POLAR_PRODUCTS.tier2_monthly;
        }
        if (planId === 'tier3') {
            return POLAR_PRODUCTS.tier3_monthly;
        }
        if (planId === 'small_pack') {
            return POLAR_PRODUCTS.small_pack;
        }
        if (planId === 'credit_pack' || planId === 'pay_as_go') {
            return POLAR_PRODUCTS.credit_pack;
        }
        return '';
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

            // On localhost, skip Netlify function and use direct Supabase query
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Using direct Supabase query for localhost');
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('credits_remaining, total_processed, subscription_plan, subscription_status, next_billing_date, polar_customer_id')
                    .eq('id', session.user.id)
                    .single();

                if (profileError || !profile) {
                    console.error('Error loading profile:', profileError);
                    setUsageStats({
                        credits_remaining: 0,
                        total_processed: 0,
                        plan: 'free'
                    });
                } else {
                    setUsageStats({
                        credits_remaining: profile.credits_remaining || 0,
                        total_processed: profile.total_processed || 0,
                        plan: profile.subscription_plan || 'free'
                    });
                }
            } else {
                // Production: try Netlify function first, fallback to Supabase
                try {
                    const usageResponse = await fetch(`/.netlify/functions/get-usage`, {
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
                        .select('credits_remaining, total_processed, subscription_plan, subscription_status, next_billing_date, polar_customer_id')
                        .eq('id', session.user.id)
                        .single();

                    if (profileError || !profile) {
                        console.error('Error loading profile:', profileError);
                        setUsageStats({
                            credits_remaining: 0,
                            total_processed: 0,
                            plan: 'free'
                        });
                    } else {
                        setUsageStats({
                            credits_remaining: profile.credits_remaining || 0,
                            total_processed: profile.total_processed || 0,
                            plan: profile.subscription_plan || 'free'
                        });
                    }
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

            // Determine API endpoint
            const apiBase = getApiBase();

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
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Plugin v{PLUGIN_VERSION}</span>
                        <a
                            href={`/wordpress-plugin/alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                            download={`alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
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
                                    style={{ width: `${Math.min(((usageStats?.credits_remaining || 0) / (({ 'free': 30, 'lite': 150, 'standard': 400, 'pro': 1000 } as Record<string, number>)[String(usageStats?.plan || 'free')] || 50)) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>{usageStats?.plan === 'free' ? '30 total' : 'Monthly quota'}</span>
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
                            {usageStats?.plan && usageStats.plan !== 'free' ? (
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => {
                                            const customerId = subscriptionData?.subscription?.polar_customer_id;
                                            if (customerId) {
                                                window.location.href = `/api/customer-portal?customerId=${customerId}`;
                                            } else {
                                                toast.info("Opening customer portal. Please sign in there if prompted.");
                                                window.location.href = `/api/customer-portal`;
                                            }
                                        }}
                                        className="text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center"
                                    >
                                        Manage Subscription <ArrowRight className="h-4 w-4 ml-1" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const customerId = subscriptionData?.subscription?.polar_customer_id;
                                            if (customerId) {
                                                window.location.href = `/api/customer-portal?customerId=${customerId}`;
                                            } else {
                                                window.location.href = `/api/customer-portal`;
                                            }
                                        }}
                                        className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center"
                                    >
                                        Cancel Subscription
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowUpgradeModal(true)}
                                    className="text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center"
                                >
                                    Upgrade Plan <ArrowRight className="h-4 w-4 ml-1" />
                                </button>
                            )}
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

                                    {/* Polar.sh Checkout Button */}
                                    <Button
                                        onClick={() => {
                                            const productId = getPolarProductId(selectedUpgradePlan.id);
                                            redirectToCheckout(productId);
                                        }}
                                        className="w-full h-12 text-white font-semibold"
                                        style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                                    >
                                        Continue to Checkout
                                    </Button>
                                    <p className="text-xs text-gray-500 text-center mt-2">
                                        You will be redirected to our secure payment processor
                                    </p>

                                    <button
                                        onClick={() => setSelectedUpgradePlan(null)}
                                        className="w-full mt-4 text-gray-500 hover:text-gray-900 text-sm font-medium"
                                    >
                                        Back to plans
                                    </button>
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                                    {/* Lite */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-teal-500 hover:shadow-lg transition-all cursor-pointer relative group">
                                        <h3 className="text-lg font-bold text-gray-900">Lite</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$3</span>
                                            <span className="text-gray-500">/month</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-teal-500 mr-2" />
                                                150 Credits
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-teal-500 mr-2" />
                                                Auto-Describe on Upload
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-teal-500 mr-2" />
                                                High-Accuracy Visual AI
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full"
                                            onClick={() => handleUpgradePlan('tier1', 'Lite', '$3')}
                                            style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                                        >
                                            Choose Lite
                                        </Button>
                                    </div>

                                    {/* Standard - Most Popular */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer relative">
                                        <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                                            POPULAR
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900">Standard</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$5</span>
                                            <span className="text-gray-500">/month</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-purple-500 mr-2" />
                                                400 Credits
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-purple-500 mr-2" />
                                                Bulk One-Click Library Fix
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-purple-500 mr-2" />
                                                Multi-Language AI (130+)
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-50"
                                            onClick={() => handleUpgradePlan('tier2', 'Standard', '$5')}
                                        >
                                            Choose Standard
                                        </Button>
                                    </div>

                                    {/* Pro */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer relative">
                                        <h3 className="text-lg font-bold text-gray-900">Pro</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$9</span>
                                            <span className="text-gray-500">/month</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-blue-500 mr-2" />
                                                1,000 Credits
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-blue-500 mr-2" />
                                                Advanced Context-Aware AI
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-blue-500 mr-2" />
                                                Premium 24/7 Support
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full bg-blue-600 text-white hover:bg-blue-700"
                                            onClick={() => handleUpgradePlan('tier3', 'Pro', '$9')}
                                        >
                                            Choose Pro
                                        </Button>
                                    </div>

                                    {/* Small Pack - $5 for 100 */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-amber-50 to-orange-50">
                                        <h3 className="text-lg font-bold text-gray-900">Small Pack</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$5</span>
                                            <span className="text-gray-500">/pack</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-amber-500 mr-2" />
                                                100 credits (one-time)
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-amber-500 mr-2" />
                                                Smart AI Optimization
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-amber-500 mr-2" />
                                                Never expires
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full text-white"
                                            style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
                                            onClick={() => handleUpgradePlan('small_pack', 'Small Pack', '$5')}
                                        >
                                            Buy 100 Images
                                        </Button>
                                    </div>

                                    {/* Credit Pack - $10 for 250 */}
                                    <div className="border border-gray-200 rounded-2xl p-6 hover:border-green-500 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-green-50 to-emerald-50">
                                        <h3 className="text-lg font-bold text-gray-900">Credit Pack</h3>
                                        <div className="mt-4 mb-6">
                                            <span className="text-4xl font-bold text-gray-900">$10</span>
                                            <span className="text-gray-500">/pack</span>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-green-500 mr-2" />
                                                250 credits (one-time)
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-green-500 mr-2" />
                                                Priority Support
                                            </li>
                                            <li className="flex items-center text-xs text-gray-600">
                                                <Check className="h-4 w-4 text-green-500 mr-2" />
                                                Best Value
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full text-white"
                                            style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                                            onClick={() => handleUpgradePlan('credit_pack', 'Credit Pack', '$10')}
                                        >
                                            Buy 250 Images
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
