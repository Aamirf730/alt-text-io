"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { supabase } from '@/lib/supabase';
import { getApiBase, PLAN_CREDIT_LIMITS, PLUGIN_VERSION } from '@/lib/utils';
import { trackMarketingEvent } from '@/lib/analytics';
import { getPolarProductId } from '@/lib/polar-products';
import { CREDIT_PACKS, getPurchaseOption, SUBSCRIPTION_PLANS } from '@/lib/pricing-catalog';

type UsageHistoryItem = {
    id: string;
    alt: string;
    context: string | null;
    date: string;
};
import { toast } from "sonner";
import {
    Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket,
    Chrome, Upload, Eye, EyeOff, Download, Check, Search, History,
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
    const [history, setHistory] = useState<UsageHistoryItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);

    const router = useRouter();
    const currentPlan = String(usageStats?.plan || 'free');
    const currentPlanLimit = PLAN_CREDIT_LIMITS[currentPlan] || PLAN_CREDIT_LIMITS.free;
    const billingCycle = String(usageStats?.billing_cycle || subscriptionData?.subscription?.billing_cycle || '');
    const monthlyCreditAllowance = Number(usageStats?.monthly_credit_allowance || subscriptionData?.subscription?.monthly_credit_allowance || 0);
    const monthlyCreditLimit = Number(usageStats?.monthly_credit_limit || 0);
    const bonusCreditsRemaining = Number(usageStats?.bonus_credits_remaining || 0);
    const purchasedCreditsRemaining = Number(usageStats?.purchased_credits_remaining || 0);
    const planAllowance = monthlyCreditLimit || (billingCycle === 'annual' && monthlyCreditAllowance > 0 ? monthlyCreditAllowance : currentPlanLimit);
    const creditsUsed = Number(usageStats?.monthly_credits_used ?? usageStats?.total_processed ?? 0);
    const creditsRemaining = Number(usageStats?.monthly_credits_remaining ?? usageStats?.credits_remaining ?? 0);
    const creditUsagePercent = planAllowance > 0 ? Math.min((creditsUsed / planAllowance) * 100, 100) : 0;
    const planLabels: Record<string, string> = {
        free: 'Free',
        tier1: 'Lite',
        tier2: 'Standard',
        tier3: 'Pro',
        tier4: 'Agency',
        lite: 'Lite',
        standard: 'Standard',
        pro: 'Pro',
        agency: 'Agency',
        small_pack: 'Credit Pack',
        pay_as_go: 'Credit Pack',
    };
    const basePlanLabel = planLabels[currentPlan] || currentPlan.replace(/_/g, ' ');
    const displayPlanLabel = billingCycle && currentPlan !== 'free' && currentPlan !== 'small_pack' && currentPlan !== 'pay_as_go'
        ? `${basePlanLabel} ${billingCycle === 'annual' ? 'Annual' : 'Monthly'}`
        : basePlanLabel;
    const creditCardDescription = purchasedCreditsRemaining > 0 && bonusCreditsRemaining > 0
        ? `${purchasedCreditsRemaining.toLocaleString()} purchased and ${bonusCreditsRemaining.toLocaleString()} promotional credits remain in addition to your plan allowance.`
        : purchasedCreditsRemaining > 0
        ? `${purchasedCreditsRemaining.toLocaleString()} purchased credits remain in addition to your plan allowance.`
        : bonusCreditsRemaining > 0
        ? `${bonusCreditsRemaining.toLocaleString()} promotional credits remain in addition to your plan allowance.`
        : billingCycle === 'annual' && monthlyCreditAllowance > 0
        ? `Credits left this month. Annual plan provides ${planAllowance.toLocaleString()} credits each month.`
        : 'Credits left this month';
    const hasApiKeyReady = Boolean(apiKey);
    const hasGeneratedFirstAltText = Number(usageStats?.total_processed || 0) > 0 || history.length > 0;
    const selectedUpgradeDetails = selectedUpgradePlan
        ? getPurchaseOption(selectedUpgradePlan.id)
        : undefined;
    const selectedUpgradeIsPack = Boolean(selectedUpgradeDetails && 'price' in selectedUpgradeDetails);

    // Load subscription data from API
    const loadSubscriptionData = useCallback(async (token: string) => {
        try {
            // Use the same Netlify function path in local development and production.
            const response = await fetch(`${getApiBase()}/get-subscription`, {
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
    }, []);

    // Handle upgrade plan selection
    const handleUpgradePlan = (planId: string, planName: string, planPrice: string) => {
        setSelectedUpgradePlan({ id: planId, name: planName, price: planPrice });
        setShowUpgradeModal(true);
    };

    // Redirect to Polar.sh checkout
    const redirectToCheckout = async (productId: string) => {
        if (!productId) {
            toast.error('Product not configured. Please contact support.');
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            toast.error('Please sign in again before starting checkout.');
            return;
        }

        trackMarketingEvent("checkout_started", {
            source: "dashboard",
            userId: user?.id,
            userEmail: session.user.email || user?.email,
            properties: {
                product_id: productId,
                plan_id: selectedUpgradePlan?.id,
                plan_name: selectedUpgradePlan?.name,
                plan_price: selectedUpgradePlan?.price,
            },
        });

        const response = await fetch(
            `/api/checkout?products=${encodeURIComponent(productId)}&format=json`,
            {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    Accept: 'application/json',
                },
            },
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.url) {
            toast.error(data.error || 'Could not start checkout. Please try again.');
            return;
        }

        window.location.href = data.url;
    };

    const openCustomerPortal = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                toast.error('Please sign in again to manage billing.');
                return;
            }

            const response = await fetch('/api/customer-portal?format=json', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Accept': 'application/json',
                },
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.url) {
                toast.error(data.error || 'Could not open billing portal.');
                return;
            }

            window.location.href = data.url;
        } catch (error) {
            console.error('Customer portal error:', error);
            toast.error('Could not open billing portal.');
        }
    };

    // Load API key for WordPress plugin
    const loadApiKey = useCallback(async () => {
        if (!user?.id || !user?.token) return;

        setIsLoadingApiKey(true);
        try {
            const response = await fetch(`${getApiBase()}/get-api-key`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.api_key) {
                throw new Error(data.error || 'Failed to load API key');
            }

            setApiKey(data.api_key);
        } catch (error) {
            console.error('Error loading API key:', error);
            toast.error('Error loading API key');
        } finally {
            setIsLoadingApiKey(false);
        }
    }, [user]);

    const loadDashboard = useCallback(async () => {
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

            // Use the same Netlify function path in local development and production,
            // with the existing direct Supabase query as a fallback.
            try {
                const usageResponse = await fetch(`${getApiBase()}/get-usage`, {
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
                            bonus_credits_remaining: usageData.data.bonus_credits_remaining || 0,
                            purchased_credits_remaining: usageData.data.purchased_credits_remaining || 0,
                            monthly_credits_remaining: usageData.data.monthly_credits_remaining,
                            monthly_credit_limit: usageData.data.monthly_credit_limit,
                            monthly_credits_used: usageData.data.monthly_credits_used,
                            total_processed: usageData.data.total_processed || usageData.data.credits_used || 0,
                            plan: usageData.data.subscription_plan || 'free',
                            billing_cycle: usageData.data.billing_cycle || null,
                            monthly_credit_allowance: usageData.data.monthly_credit_allowance || null
                        });
                    } else {
                        throw new Error('Invalid API response format');
                    }
                } else {
                    throw new Error(`API returned status ${usageResponse.status}`);
                }
            } catch (error) {
                console.error('Error loading usage data from API:', error);
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('credits_remaining, bonus_credits_remaining, purchased_credits_remaining, total_processed, subscription_plan, subscription_status, next_billing_date, subscription_id, billing_cycle, monthly_credit_allowance')
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
                        bonus_credits_remaining: profile.bonus_credits_remaining || 0,
                        purchased_credits_remaining: profile.purchased_credits_remaining || 0,
                        total_processed: profile.total_processed || 0,
                        plan: profile.subscription_plan || 'free',
                        billing_cycle: profile.billing_cycle || null,
                        monthly_credit_allowance: profile.monthly_credit_allowance || null
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
    }, [loadSubscriptionData, router]);

    const loadHistory = useCallback(async () => {
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
                const normalizedHistory = (data || []).map((item: any) => ({
                    id: item.id,
                    alt: item.alt_text_generated || 'Alt text unavailable',
                    context: item.image_context || null,
                    date: item.created_at
                }));
                setHistory(normalizedHistory);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [user]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadDashboard();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadDashboard]);

    // Load API key and recent history after the authenticated user is available.
    useEffect(() => {
        if (!user?.token) return;

        const timer = window.setTimeout(() => {
            void loadApiKey();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadApiKey, user?.token]);

    useEffect(() => {
        if (!user?.id) return;

        const timer = window.setTimeout(() => {
            void loadHistory();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadHistory, user?.id]);

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

    const rotateApiKey = async () => {
        if (!user?.id || !user?.token) return;

        if (!confirm("Rotate your API key? Your old key will stop working immediately.")) {
            return;
        }

        setIsLoadingApiKey(true);
        try {
            const response = await fetch(`${getApiBase()}/get-api-key`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rotate: true }),
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.api_key) {
                throw new Error(data.error || 'Failed to rotate API key');
            }

            setApiKey(data.api_key);
            toast.success("API Key rotated successfully");
        } catch (error) {
            console.error('Error rotating API key:', error);
            toast.error("Failed to rotate API key");
        } finally {
            setIsLoadingApiKey(false);
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
                const wasFirstProcessedImage = (usageStats?.total_processed || 0) === 0;

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

                if (wasFirstProcessedImage) {
                    trackMarketingEvent("first_image_processed", {
                        source: "dashboard",
                        userId: user?.id,
                        userEmail: user?.email,
                        properties: {
                            context: "dashboard_test",
                            credits_remaining: data.credits_remaining,
                        },
                    });
                }

                if (typeof data.credits_remaining === 'number' && data.credits_remaining <= 5) {
                    trackMarketingEvent("credits_low", {
                        source: "dashboard",
                        userId: user?.id,
                        userEmail: user?.email,
                        properties: {
                            credits_remaining: data.credits_remaining,
                            trigger: "dashboard_generation",
                        },
                    });
                }

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
            <main className="min-h-screen bg-slate-50 flex items-center justify-center" aria-busy="true">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#000000] mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading dashboard...</p>
                </div>
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-notebook-paper text-notebook-slate pb-20 font-sans selection:bg-notebook-blue/10 selection:text-notebook-slate">
            {/* Navigation */}
            <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <Link href="/" className="flex items-center space-x-3 group">
                            <NextImage
                                src="/logo-alt-text-pro.png"
                                alt="Alt Text Pro Logo"
                                width={40}
                                height={40}
                                className="h-10 w-10 object-contain transition-transform group-hover:rotate-12"
                            />
                            <span className="text-2xl font-bold text-notebook-slate tracking-tight font-outfit">Alt Text Pro</span>
                        </Link>
                        <div className="flex items-center space-x-6">
                            <div className="hidden md:block text-xs text-slate-400 font-medium">
                                <span className="opacity-70 uppercase tracking-widest">Account:</span> <span className="text-notebook-slate ml-2">{user?.email}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-500 hover:text-notebook-blue hover:bg-notebook-blue/5 rounded-full px-4 transition-all"
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

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                    <div className="space-y-3">
                        <div className="inline-flex items-center space-x-2 bg-notebook-blue/5 text-notebook-blue px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-notebook-blue/10">
                            <Rocket className="h-3 w-3" />
                            <span>Dashboard Overview</span>
                        </div>
                        <h1 className="text-4xl font-semibold text-notebook-slate tracking-tight font-outfit">Overview</h1>
                        <p className="text-slate-500 font-medium">Manage your account, credits, and see your recent activity.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm uppercase tracking-widest">
                            v{PLUGIN_VERSION}
                        </span>
                        <a
                            href={`/wordpress-plugin/alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                            download={`alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                            onClick={() => trackMarketingEvent("plugin_downloaded", {
                                source: "dashboard",
                                userId: user?.id,
                                userEmail: user?.email,
                                properties: {
                                    plugin_version: PLUGIN_VERSION,
                                    location: "dashboard_header",
                                },
                            })}
                            className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-notebook-blue hover:bg-notebook-blue/90 transition-all rounded-full shadow-sm hover:-translate-y-0.5"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download Plugin
                        </a>
                    </div>
                </div>

                {/* First-run onboarding */}
                <Card className="bg-white border-notebook-slate/5 shadow-notebook rounded-[2rem] mb-16 overflow-hidden">
                    <CardContent className="p-8 lg:p-10">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-8">
                            <div className="space-y-3">
                                <div className="inline-flex items-center space-x-2 bg-notebook-teal/10 text-notebook-blue px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-notebook-teal/20">
                                    <CheckCircle className="h-3 w-3" />
                                    <span>First Alt Text Setup</span>
                                </div>
                                <h2 className="text-2xl font-semibold text-notebook-slate tracking-tight font-outfit">
                                    Connect WordPress, then generate one image.
                                </h2>
                                <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                                    The fastest path is to install the plugin, click Connect in WordPress, then run one manual generation before starting a bulk batch.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Link
                                    href="/docs#installation"
                                    className="inline-flex items-center justify-center px-5 py-3 text-xs font-bold text-notebook-slate bg-notebook-cloud/30 hover:bg-notebook-cloud/60 border border-notebook-cloud transition-all rounded-2xl uppercase tracking-widest font-outfit"
                                >
                                    Setup Guide <ArrowRight className="h-4 w-4 ml-2" />
                                </Link>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {[
                                {
                                    label: "1. Install plugin",
                                    body: `Use version ${PLUGIN_VERSION} from this dashboard or WordPress.org.`,
                                    status: "Ready",
                                    icon: Chrome,
                                    complete: true,
                                },
                                {
                                    label: "2. Connect account",
                                    body: hasApiKeyReady ? "Your API key is ready if the plugin needs manual fallback." : "Open Alt Text Pro in WordPress and click Connect.",
                                    status: hasApiKeyReady ? "Key ready" : "Next",
                                    icon: Key,
                                    complete: hasApiKeyReady,
                                },
                                {
                                    label: "3. Generate one image",
                                    body: hasGeneratedFirstAltText ? "Your first generation is complete. Try a small bulk batch next." : "Generate one manual alt text before running a bulk job.",
                                    status: hasGeneratedFirstAltText ? "Complete" : "Recommended",
                                    icon: ImageIcon,
                                    complete: hasGeneratedFirstAltText,
                                },
                            ].map((step) => {
                                const Icon = step.icon;
                                return (
                                    <div key={step.label} className="rounded-3xl border border-notebook-cloud bg-notebook-cloud/10 p-6">
                                        <div className="flex items-start justify-between gap-4 mb-5">
                                            <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-notebook-slate/5">
                                                <Icon className="h-5 w-5 text-notebook-blue" />
                                            </div>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 ${step.complete ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-white text-slate-500 border border-notebook-cloud'}`}>
                                                {step.status}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-bold text-notebook-slate uppercase tracking-widest font-outfit mb-3">
                                            {step.label}
                                        </h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            {step.body}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    {/* Credits Card */}
                    <Card className="bg-white border-notebook-slate/5 shadow-notebook rounded-[2rem] hover:shadow-notebook-lg transition-all duration-300 group overflow-hidden">
                        <CardContent className="p-10">
                            <div className="flex justify-between items-start mb-10">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em] mb-4">Available Credits</p>
                                    <h3 className="text-5xl font-medium text-notebook-slate tracking-tighter font-outfit flex items-baseline">
                                        {creditsRemaining.toLocaleString()}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-3 leading-relaxed max-w-[260px]">
                                        {creditCardDescription}
                                    </p>
                                </div>
                                <div className="p-4 bg-notebook-teal/10 text-notebook-blue rounded-3xl group-hover:scale-105 transition-transform duration-500">
                                    <Zap className="h-7 w-7" />
                                </div>
                            </div>
                            <div className="w-full bg-notebook-cloud rounded-full h-1.5 mb-6 overflow-hidden">
                                <div
                                    className="bg-notebook-blue h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${creditUsagePercent}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                                    {creditsUsed.toLocaleString()} used
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                                    {planAllowance.toLocaleString()} {billingCycle === 'annual' ? 'monthly allowance' : 'plan credits'}
                                </span>
                            </div>
                            <div className="flex justify-end items-center mt-5">
                                <button
                                    onClick={() => handleUpgradePlan('small_pack', 'Small Pack', '$5')}
                                    className="text-notebook-blue text-xs font-semibold hover:opacity-80 transition-opacity flex items-center group/btn font-outfit uppercase tracking-[0.15em]"
                                >
                                    Top up <ArrowRight className="h-3 w-3 ml-2 transition-transform group-hover/btn:translate-x-1" />
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Generated Card */}
                    <Card className="bg-white border-notebook-slate/5 shadow-notebook rounded-[2rem] hover:shadow-notebook-lg transition-all duration-300 group overflow-hidden">
                        <CardContent className="p-10">
                            <div className="flex justify-between items-start mb-10">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em] mb-4">Images Optimized</p>
                                    <h3 className="text-5xl font-medium text-notebook-slate tracking-tighter font-outfit">{usageStats?.total_processed || 0}</h3>
                                </div>
                                <div className="p-4 bg-slate-50 text-notebook-slate rounded-3xl group-hover:scale-105 transition-transform duration-500">
                                    <ImageIcon className="h-7 w-7" />
                                </div>
                            </div>
                            <div className="mt-8 flex items-center space-x-3">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-notebook-cloud flex items-center justify-center text-[10px] font-bold text-slate-400">
                                            {i}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Images Processed</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Plan Card */}
                    <Card className="bg-white border-notebook-slate/5 shadow-notebook rounded-[2rem] hover:shadow-notebook-lg transition-all duration-300 group overflow-hidden">
                        <CardContent className="p-10">
                            <div className="flex justify-between items-start mb-10">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em] mb-4">Your Current Plan</p>
                                    <h3 className="text-4xl font-medium text-notebook-slate tracking-tight font-outfit capitalize">{displayPlanLabel}</h3>
                                    {billingCycle === 'annual' && monthlyCreditAllowance > 0 && (
                                        <p className="text-xs text-slate-500 mt-3">
                                            {monthlyCreditAllowance.toLocaleString()} credits added monthly
                                        </p>
                                    )}
                                </div>
                                <div className="p-4 bg-orange-50 text-orange-500 rounded-3xl group-hover:scale-105 transition-transform duration-500">
                                    <Crown className="h-7 w-7" />
                                </div>
                            </div>
                            <div className="mt-7">
                                {usageStats?.plan && usageStats.plan !== 'free' ? (
                                    <div className="flex flex-col gap-4">
                                        {subscriptionData?.subscription?.polar_customer_id ? (
	                                            <>
	                                                <button
	                                                    onClick={openCustomerPortal}
	                                                    className="text-xs text-notebook-blue font-semibold hover:opacity-80 transition-all flex items-center font-outfit uppercase tracking-[0.15em]"
	                                                >
	                                                    Manage Subscription <ArrowRight className="h-4 w-4 ml-2" />
	                                                </button>
	                                                <button
	                                                    onClick={openCustomerPortal}
	                                                    className="text-[10px] text-slate-500 hover:text-red-500 transition-colors uppercase tracking-[0.2em] font-bold text-left"
	                                                >
                                                    Cancel Subscription
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => router.push('/#pricing')}
                                                className="text-xs text-notebook-blue font-semibold hover:opacity-80 transition-all flex items-center font-outfit uppercase tracking-[0.15em]"
                                            >
                                                Plan Details <ArrowRight className="h-4 w-4 ml-2" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowUpgradeModal(true)}
                                        className="text-xs text-notebook-slate font-semibold hover:text-notebook-blue transition-all flex items-center group/btn font-outfit uppercase tracking-[0.15em]"
                                    >
                                        Upgrade Your Plan <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
                                    </button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content Area - Left 2/3 */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Quick Test Section */}
                        <Card className="bg-white border-notebook-slate/5 shadow-notebook rounded-[2rem] overflow-hidden group">
                            <CardContent className="p-10">
                                <div className="flex items-center space-x-4 mb-12">
                                    <div className="p-3 bg-notebook-teal/10 text-notebook-blue rounded-2xl border border-notebook-teal/20">
                                        <Brain className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-semibold text-notebook-slate tracking-tight font-outfit">Quick Generate</h2>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Create Alt Text in One Click</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-8">
                                        <div
                                            className="border-2 border-dashed border-notebook-cloud rounded-[2rem] p-12 text-center cursor-pointer hover:border-notebook-blue/30 hover:bg-notebook-cloud/30 transition-all duration-500 group/drop bg-notebook-cloud/10"
                                            onClick={() => document.getElementById('image-upload-input')?.click()}
                                        >
                                            <input
                                                id="image-upload-input"
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                            />
                                            {testImage ? (
                                                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-sm">
                                                    <NextImage
                                                        src={testImage}
                                                        alt="Upload preview"
                                                        fill
                                                        unoptimized
                                                        sizes="(min-width: 768px) 50vw, 100vw"
                                                        className="object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-notebook-slate/20 opacity-0 group-hover/drop:opacity-100 transition-opacity flex items-center justify-center">
                                                        <p className="text-white text-xs font-bold uppercase tracking-widest">Change Image</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-6 flex flex-col items-center">
                                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-50 group-hover/drop:scale-110 transition-transform duration-500">
                                                        <Upload className="h-6 w-6 text-notebook-blue" />
                                                    </div>
                                                    <p className="text-sm font-semibold text-notebook-slate mb-2">Drop image here</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or click to browse filesystem</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-notebook-cloud/20 rounded-3xl border border-notebook-cloud/50">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-notebook-slate/5">
                                                    <Settings className="h-5 w-5 text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-notebook-slate uppercase tracking-widest">Generation Mode</p>
                                                    <p className="text-[10px] font-medium text-slate-500 font-outfit">Reviewable AI draft</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 bg-notebook-cloud/10 rounded-[2rem] p-8 border border-notebook-cloud/50 relative overflow-hidden group/result">
                                            {isGenerating ? (
                                                <div className="h-full flex flex-col items-center justify-center space-y-6">
                                                    <div className="relative w-16 h-16">
                                                        <div className="absolute inset-0 border-4 border-notebook-blue/10 rounded-full"></div>
                                                        <div className="absolute inset-0 border-4 border-t-notebook-blue rounded-full animate-spin"></div>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-semibold text-notebook-slate mb-1">Analyzing image...</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Understanding image data</p>
                                                    </div>
                                                </div>
                                            ) : generatedAltText ? (
                                                <div className="h-full flex flex-col">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest bg-notebook-teal/10 px-3 py-1 rounded-full">Ready to Use</span>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(generatedAltText);
                                                                toast.success("Copied to clipboard");
                                                            }}
                                                            className="p-2 hover:bg-white rounded-xl transition-colors shadow-none hover:shadow-sm border-transparent hover:border-gray-100 border text-slate-400 hover:text-notebook-blue"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <div className="flex-1 text-notebook-slate text-sm font-medium leading-relaxed bg-white/50 rounded-2xl p-6 border border-white">
                                                        {generatedAltText}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                                                        <FileText className="h-5 w-5 text-slate-300" />
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Waiting for image</p>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={generateTestAltText}
                                            disabled={!testImage || isGenerating}
                                            className="mt-6 w-full py-4 bg-notebook-slate text-white rounded-2xl font-semibold text-sm hover:bg-notebook-slate/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md uppercase tracking-[0.2em] font-outfit"
                                        >
                                            {isGenerating ? 'Generating...' : 'Start Analysis'}
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent History */}
                        <Card className="bg-white border-notebook-slate/5 shadow-notebook rounded-[2rem] overflow-hidden">
                            <CardContent className="p-10">
                                <div className="flex items-center justify-between mb-12">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                                            <History className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold text-notebook-slate tracking-tight font-outfit">Recent Activity</h2>
                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Your Generated Alt Text</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-notebook-blue font-bold uppercase tracking-widest text-[10px]">Archive View</Button>
                                </div>

                                <div className="space-y-6">
                                    {isLoadingHistory ? (
                                        <div className="text-center py-20 bg-notebook-cloud/10 rounded-[2rem] border border-dashed border-notebook-cloud">
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                                <RefreshCw className="h-6 w-6 text-slate-200 animate-spin" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-400">Loading activity</p>
                                        </div>
                                    ) : history.length > 0 ? (
                                        history.map((item, index) => (
                                            <div key={item.id || index} className="flex items-center space-x-6 p-6 rounded-[1.5rem] hover:bg-notebook-cloud/30 transition-all group border border-transparent hover:border-notebook-cloud/50">
                                                <div className="h-16 w-16 rounded-xl bg-notebook-cloud/50 overflow-hidden flex-shrink-0 border border-notebook-cloud group-hover:scale-105 transition-transform flex items-center justify-center">
                                                    <ImageIcon className="h-6 w-6 text-slate-300" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-notebook-slate line-clamp-2 leading-relaxed italic">"{item.alt}"</p>
                                                    {item.context && (
                                                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.context}</p>
                                                    )}
                                                    <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest font-bold font-outfit">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.alt);
                                                        toast.success("Copied to clipboard");
                                                    }}
                                                    className="p-3 text-slate-300 hover:text-notebook-blue hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 bg-notebook-cloud/10 rounded-[2rem] border border-dashed border-notebook-cloud">
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                                <ImageIcon className="h-6 w-6 text-slate-200" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-400">Activity log is currently empty</p>
                                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Start generating alt text above</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-8">
                        {/* API Key Section */}
                        <Card className="bg-white border-notebook-slate/5 shadow-notebook relative overflow-hidden group rounded-[2rem]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500/20 to-teal-500 group-hover:h-2 transition-all"></div>
                            <CardContent className="p-8">
                                <div className="flex items-center space-x-4 mb-10">
                                    <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl border border-teal-100">
                                        <Key className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-notebook-slate tracking-tight font-outfit">API Settings</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Your API Key</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="relative group/key">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                                            Secret API Key
                                        </label>
                                        <div className="flex items-center bg-notebook-cloud/20 border border-notebook-cloud rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500/50 transition-all">
                                            <div className="pl-5 py-4 flex-1 overflow-hidden">
                                                {isLoadingApiKey ? (
                                                    <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded"></div>
                                                ) : (
                                                    <span className="text-xs font-mono text-notebook-slate/70 truncate block">
                                                        {showApiKey ? apiKey : '••••••••••••••••••••••••••••••'}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                className="p-4 text-slate-300 hover:text-notebook-slate transition-colors"
                                                title={showApiKey ? "Hide Key" : "Show Key"}
                                            >
                                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                            <div className="w-px h-10 bg-notebook-cloud"></div>
                                            <button
                                                onClick={() => {
                                                    if (apiKey) {
                                                        navigator.clipboard.writeText(apiKey);
                                                        toast.success("API key copied to clipboard");
                                                    }
                                                }}
                                                className="p-4 text-slate-300 hover:text-teal-600 hover:bg-white transition-colors"
                                                title="Copy to Clipboard"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="w-full h-12 border-notebook-cloud text-notebook-slate hover:bg-notebook-cloud/30 hover:border-notebook-cloud font-semibold text-xs uppercase tracking-widest font-outfit transition-all"
                                        onClick={rotateApiKey}
                                        disabled={isLoadingApiKey}
                                    >
                                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingApiKey ? 'animate-spin' : ''}`} />
                                        {isLoadingApiKey ? 'Generating...' : 'Generate New Key'}
                                    </Button>

                                    <div className="p-5 bg-orange-50/50 border border-orange-100 rounded-[1.5rem] flex items-start space-x-4">
                                        <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-orange-800/70 leading-relaxed font-medium">
                                            This key gives access to your account. Change it immediately if you think someone else has it.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Help & Support */}
                        <Card className="bg-white border-notebook-slate/5 shadow-notebook relative overflow-hidden group rounded-[2rem]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-notebook-teal/20 to-notebook-blue group-hover:h-2 transition-all"></div>
                            <CardContent className="p-8">
                                <div className="flex items-center space-x-4 mb-10">
                                    <div className="p-3 bg-notebook-teal/10 text-notebook-blue rounded-2xl border border-notebook-teal/20">
                                        <HelpCircle className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-notebook-slate tracking-tight font-outfit">Help & Support</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Knowledge & Support</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Link href="/docs" className="flex items-center justify-between p-5 rounded-2xl border border-notebook-cloud hover:border-notebook-blue/30 hover:bg-notebook-teal/10 transition-all group/link">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-notebook-slate/5">
                                                <Book className="h-5 w-5 text-slate-400 group-hover/link:text-notebook-blue transition-colors" />
                                            </div>
                                            <span className="font-semibold text-notebook-slate group-hover/link:text-notebook-slate">Documentation</span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover/link:text-notebook-blue group-hover/link:translate-x-1 transition-all" />
                                    </Link>

                                    <Link href="/contact" className="flex items-center justify-between p-5 rounded-2xl border border-notebook-cloud hover:border-notebook-blue/30 hover:bg-notebook-teal/10 transition-all group/link">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-notebook-slate/5">
                                                <MessageCircle className="h-5 w-5 text-slate-400 group-hover/link:text-notebook-blue transition-colors" />
                                            </div>
                                            <span className="font-semibold text-notebook-slate group-hover/link:text-notebook-slate">Contact Support</span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover/link:text-notebook-blue group-hover/link:translate-x-1 transition-all" />
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-20 text-center pb-12 border-t border-notebook-cloud pt-12">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
                        Alt Text Pro System v{PLUGIN_VERSION} • System Status: <span className="text-green-500">Active</span>
                    </p>
                    <p className="text-[10px] text-slate-300 mt-4 font-medium">© 2026 ALT Text Pro. All rights reserved.</p>
                </div>
            </main>
            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-[#1A1C1E]/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-white border border-[#F1F3F4] rounded-[2.5rem] max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        {/* Modal Header */}
                        <div className="relative p-10 border-b border-[#F1F3F4] shrink-0 bg-[#FAF9F6]">
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="absolute top-8 right-8 p-2 rounded-full hover:bg-[#F1F3F4] text-[#5F6368] transition-colors z-10"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            <div className="relative z-10 max-w-2xl">
                                <div className="inline-flex items-center space-x-2 bg-notebook-teal/10 text-[#000000] px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest mb-6 border border-notebook-teal/20">
                                    <Crown className="h-3.5 w-3.5" />
                                    <span>Plan Management</span>
                                </div>
                                <h2 className="text-4xl font-semibold text-[#1A1C1E] mb-4 tracking-tight font-outfit">
                                    Choose a <span className="text-[#000000]">Plan</span>
                                </h2>
                                <p className="text-[#5F6368] text-lg font-inter">
                                    Compare the available plans and credit allowances.
                                </p>
                            </div>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="p-10 overflow-y-auto bg-white">
                            {selectedUpgradePlan ? (
                                <div className="max-w-md mx-auto">
                                    <div className="bg-[#FAF9F6] border border-[#F1F3F4] rounded-[2rem] p-10 mb-8 shadow-sm text-center">
                                        <div className="w-20 h-20 bg-notebook-teal/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8">
                                            <Crown className="h-10 w-10 text-[#000000]" />
                                        </div>
                                        <h3 className="text-2xl font-semibold text-[#1A1C1E] mb-2 font-outfit">
                                            {selectedUpgradePlan.name}{selectedUpgradeIsPack ? '' : ' Plan'}
                                        </h3>
                                        <div className="text-5xl font-semibold text-[#1A1C1E] mb-8 font-outfit">
                                            {selectedUpgradePlan.price}<span className="text-xl text-[#5F6368] font-normal font-inter">{selectedUpgradeIsPack ? ' one time' : '/mo'}</span>
                                        </div>
                                        <div className="space-y-5 text-left mb-10 pt-8 border-t border-[#F1F3F4] font-inter">
                                            {selectedUpgradeDetails?.features.map((feature) => (
                                                <div key={feature} className="flex items-center text-[#5F6368]">
                                                    <div className="w-5 h-5 rounded-full bg-notebook-teal/10 flex items-center justify-center mr-4 shrink-0">
                                                        <Check className="h-3 w-3 text-[#000000]" />
                                                    </div>
                                                    <span>{feature}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            onClick={() => {
                                                const productId = getPolarProductId(selectedUpgradePlan.id);
                                                void redirectToCheckout(productId);
                                            }}
                                            className="w-full h-14 bg-[#000000] hover:bg-[#000000] text-white font-semibold text-lg rounded-xl transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                        >
                                            {selectedUpgradeIsPack ? 'Buy Credits' : 'Upgrade Now'}
                                            <ArrowRight className="h-5 w-5 ml-2" />
                                        </Button>

                                        <button
                                            onClick={() => setSelectedUpgradePlan(null)}
                                            className="w-full mt-6 text-[#5F6368] hover:text-[#1A1C1E] text-sm font-medium transition-colors p-2"
                                        >
                                            Back to Plans
                                        </button>
                                    </div>
                                    <div className="text-center text-xs text-[#9AA0A6] flex items-center justify-center gap-2">
                                        <Shield className="h-3.5 w-3.5" /> Encrypted Transaction via Polar.sh
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    <div>
                                        <h3 className="text-lg font-semibold text-[#1A1C1E] mb-8 font-outfit border-l-4 border-[#000000] pl-4">Monthly Subscriptions</h3>
                                        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">
                                            {SUBSCRIPTION_PLANS.filter((plan) => plan.id !== 'free').map((plan) => (
                                                <article
                                                    key={plan.id}
                                                    className={`relative flex flex-col rounded-[2rem] bg-white p-8 transition-all ${
                                                        plan.featured
                                                            ? 'border-2 border-[#000000] shadow-[0_20px_45px_rgba(0,0,0,0.10)] hover:-translate-y-2'
                                                            : 'border border-[#F1F3F4] hover:border-[#000000]/20 hover:shadow-[0_16px_36px_rgba(0,0,0,0.08)]'
                                                    }`}
                                                >
                                                    {plan.featured && (
                                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#000000] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-lg">
                                                            Most popular
                                                        </div>
                                                    )}
                                                    <h4 className="text-lg font-semibold text-[#1A1C1E] font-outfit">{plan.name}</h4>
                                                    <div className="mt-4 mb-8">
                                                        <span className="text-4xl font-semibold text-[#1A1C1E] font-outfit">{plan.monthlyPrice}</span>
                                                        <span className="text-[#5F6368] font-normal ml-1 font-inter">/mo</span>
                                                    </div>
                                                    <ul className="space-y-4 mb-10 flex-1 font-inter">
                                                        <li className="flex items-start text-sm text-[#5F6368]">
                                                            <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                                                                <Check className="h-3 w-3 text-[#000000]" aria-hidden="true" />
                                                            </div>
                                                            <span>{plan.creditCount.toLocaleString()} credits every month</span>
                                                        </li>
                                                        {plan.features.map((feature) => (
                                                            <li key={feature} className="flex items-start text-sm text-[#5F6368]">
                                                                <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                                                                    <Check className="h-3 w-3 text-[#000000]" aria-hidden="true" />
                                                                </div>
                                                                <span>{feature}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <Button
                                                        type="button"
                                                        onClick={() => setSelectedUpgradePlan({
                                                            id: `${plan.id}_monthly`,
                                                            name: plan.name,
                                                            price: plan.monthlyPrice,
                                                        })}
                                                        className={`w-full rounded-xl font-medium ${
                                                            plan.featured
                                                                ? 'bg-[#000000] text-white hover:bg-[#000000] shadow-[0_10px_24px_rgba(0,0,0,0.18)]'
                                                                : 'bg-[#FAF9F6] text-[#1A1C1E] hover:bg-[#F1F3F4] border border-[#F1F3F4]'
                                                        }`}
                                                    >
                                                        Select Plan
                                                    </Button>
                                                </article>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-[#1A1C1E] mb-8 font-outfit border-l-4 border-amber-400 pl-4">Credits (One-Time)</h3>
                                        <div className="grid md:grid-cols-2 gap-8">
                                            {CREDIT_PACKS.map((pack) => (
                                                <article
                                                    key={pack.id}
                                                    className="flex flex-col rounded-[2rem] border border-[#F1F3F4] bg-[#FAF9F6] p-8 transition-all hover:shadow-lg"
                                                >
                                                    <h4 className="text-lg font-semibold text-[#1A1C1E] font-outfit">{pack.name}</h4>
                                                    <div className="mt-4 mb-8">
                                                        <span className="text-4xl font-semibold text-[#1A1C1E] font-outfit">{pack.price}</span>
                                                        <span className="text-[#5F6368] font-normal ml-2 font-inter text-sm">one-time purchase</span>
                                                    </div>
                                                    <ul className="space-y-4 mb-10 flex-1 font-inter">
                                                        {pack.features.map((feature) => (
                                                            <li key={feature} className="flex items-start text-sm text-[#5F6368]">
                                                                <div className="w-5 h-5 rounded-full bg-amber-50 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                                                                    <Check className="h-3 w-3 text-amber-600" aria-hidden="true" />
                                                                </div>
                                                                <span>{feature}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <Button
                                                        type="button"
                                                        onClick={() => setSelectedUpgradePlan({
                                                            id: pack.id,
                                                            name: pack.name,
                                                            price: pack.price,
                                                        })}
                                                        className="w-full bg-white text-[#1A1C1E] hover:bg-[#F1F3F4] border border-[#F1F3F4] rounded-xl font-medium"
                                                    >
                                                        Buy Credits
                                                    </Button>
                                                </article>
                                            ))}
                                        </div>
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
