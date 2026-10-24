"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { getAccessToken, supabase } from '@/lib/supabase';
import { getApiBase, PLAN_CREDIT_LIMITS, PLUGIN_VERSION } from '@/lib/utils';
import { trackMarketingEvent } from '@/lib/analytics';
import { getPolarProductId } from '@/lib/polar-products';
import { CREDIT_PACKS, getPlanDisplayName, getPurchaseOption, SUBSCRIPTION_PLANS } from '@/lib/pricing-catalog';
import { isCreditPackEligible as getIsCreditPackEligible } from '@/lib/credit-pack-eligibility';
import { getUsageDisplayLimit } from '@/lib/credit-display';
import { consumePendingCheckout } from '@/lib/pending-checkout';
import { hasLivePaidSubscription, SUBSCRIPTION_EXISTS_CODE, SUBSCRIPTION_EXISTS_MESSAGE } from '@/lib/subscription-status';

type UsageHistoryItem = {
    id: string;
    alt: string;
    context: string | null;
    date: string;
};

type UpgradeModalView = "plans" | "credit-packs";

const DASHBOARD_IMAGE_MAX_DIMENSION = 1600;
const DASHBOARD_IMAGE_MAX_BASE64_BYTES = 3 * 1024 * 1024;

function getBase64PayloadSize(dataUrl: string) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) return 0;

    return Math.ceil((dataUrl.length - commaIndex - 1) * 3 / 4);
}

function loadImageForDashboard(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('This image could not be prepared for generation.'));
        };
        image.src = objectUrl;
    });
}

async function prepareDashboardImage(file: File) {
    const image = await loadImageForDashboard(file);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const initialScale = Math.min(1, DASHBOARD_IMAGE_MAX_DIMENSION / longestSide);
    let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
    let height = Math.max(1, Math.round(image.naturalHeight * initialScale));

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('This browser could not prepare the image for generation.');
        }

        context.drawImage(image, 0, 0, width, height);

        for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            if (getBase64PayloadSize(dataUrl) <= DASHBOARD_IMAGE_MAX_BASE64_BYTES) {
                return dataUrl;
            }
        }

        width = Math.max(640, Math.round(width * 0.8));
        height = Math.max(640, Math.round(height * 0.8));
    }

    throw new Error('This image is too large to process. Please choose a smaller image.');
}

import { toast } from "sonner";
import {
    ArrowRight, Shield, Upload, Eye, EyeOff, Download, Check,
    CreditCard, Key, Copy, AlertTriangle, RefreshCw, Book, FileText,
    HelpCircle, Settings, LogOut, MessageCircle, Image as ImageIcon, Crown, X,
    LayoutDashboard, Menu, PanelLeftClose, Sparkles, Layers3, BarChart3,
    ChevronRight, CircleCheck, PlugZap
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [usageStats, setUsageStats] = useState<any>(null);
    const [testImage, setTestImage] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [subscriptionData, setSubscriptionData] = useState<any>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<any>(null);
    const [upgradeModalView, setUpgradeModalView] = useState<UpgradeModalView>("plans");
    const [upgradeBillingCycle, setUpgradeBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedAltText, setGeneratedAltText] = useState("");
    const [history, setHistory] = useState<UsageHistoryItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [apiKeyErrorCode, setApiKeyErrorCode] = useState<string | null>(null);
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const router = useRouter();
    const currentPlan = String(usageStats?.plan || 'free');
    const currentPlanLimit = PLAN_CREDIT_LIMITS[currentPlan] || PLAN_CREDIT_LIMITS.free;
    const billingCycle = String(usageStats?.billing_cycle || subscriptionData?.subscription?.billing_cycle || '');
    const currentSubscriptionStatus = usageStats?.subscription_status || subscriptionData?.subscription?.status;
    const isCreditPackEligible = getIsCreditPackEligible({
        subscription_plan: currentPlan,
        subscription_status: currentSubscriptionStatus,
    });
    const isSubscribed = hasLivePaidSubscription({
        subscription_plan: currentPlan,
        subscription_status: currentSubscriptionStatus,
    });
    const monthlyCreditAllowance = Number(usageStats?.monthly_credit_allowance || subscriptionData?.subscription?.monthly_credit_allowance || 0);
    const monthlyCreditLimit = Number(usageStats?.monthly_credit_limit || 0);
    const bonusCreditsRemaining = Number(usageStats?.bonus_credits_remaining || 0);
    const purchasedCreditsRemaining = Number(usageStats?.purchased_credits_remaining || 0);
    // A pinned allowance (legacy subscribers, annual drip) wins over the catalogue fallback.
    const planAllowance = monthlyCreditLimit || (monthlyCreditAllowance > 0 ? monthlyCreditAllowance : currentPlanLimit);
    const creditsUsed = Number(usageStats?.monthly_credits_used ?? usageStats?.total_processed ?? 0);
    const creditsRemaining = Number(usageStats?.monthly_credits_remaining ?? usageStats?.credits_remaining ?? 0);
    const creditUsageLimit = getUsageDisplayLimit(currentPlan, planAllowance, creditsRemaining, creditsUsed);
    const creditUsagePercent = creditUsageLimit > 0 ? Math.min((creditsUsed / creditUsageLimit) * 100, 100) : 0;
    // Legacy subscribers keep their original plan name and allowance.
    const basePlanLabel = getPlanDisplayName(currentPlan, monthlyCreditLimit || monthlyCreditAllowance);
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
    const isPluginConnected = usageStats?.plugin_connected === true;
    const showFirstRunOnboarding = !isPluginConnected || !hasGeneratedFirstAltText;
    const accountInitial = String(user?.email || 'A').charAt(0).toUpperCase();
    const firstName = String(user?.email || 'there').split('@')[0].split(/[._-]/)[0] || 'there';
    const renewalDateValue = subscriptionData?.subscription?.next_billing_date || null;
    const renewalDateLabel = renewalDateValue
        ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(renewalDateValue))
        : currentPlan === 'free'
        ? 'No renewal scheduled'
        : 'Billing date unavailable';
    const dashboardNavItems = [
        { label: 'Overview', href: '#overview', icon: LayoutDashboard },
        { label: 'Generate', href: '#generate', icon: Sparkles },
        { label: 'Activity', href: '#activity', icon: ImageIcon },
        { label: 'Usage', href: '#usage', icon: BarChart3 },
        { label: 'Settings', href: '#settings', icon: Settings },
    ];
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
        setUpgradeModalView("plans");
        setSelectedUpgradePlan({ id: planId, name: planName, price: planPrice });
        setShowUpgradeModal(true);
    };

    const openCreditPacks = () => {
        if (!isCreditPackEligible) return;

        setUpgradeModalView("credit-packs");
        setSelectedUpgradePlan(null);
        setShowUpgradeModal(true);
    };

    const openUpgradePlans = () => {
        setUpgradeModalView("plans");
        setUpgradeBillingCycle('monthly');
        setSelectedUpgradePlan(null);
        setShowUpgradeModal(true);
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (!error) {
                toast.success("Logged out successfully");
                router.push("/");
            }
        } catch (error) {
            console.error("Logout failed:", error);
            toast.error("Logout failed");
        }
    };

    // Redirect to Polar.sh checkout
    const redirectToCheckout = async (productId: string) => {
        if (!productId) {
            toast.error('Product not configured. Please contact support.');
            return;
        }

        if (selectedUpgradeIsPack && !isCreditPackEligible) {
            toast.error('This account cannot buy credit packs right now. Please contact support.');
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            toast.error('Please sign in again before starting checkout.');
            return;
        }

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

        if (data.code === SUBSCRIPTION_EXISTS_CODE) {
            toast.info(data.error);
            setShowUpgradeModal(false);
            setSelectedUpgradePlan(null);
            return;
        }

        if (!response.ok || !data.url) {
            toast.error(data.error || 'Could not start checkout. Please try again.');
            return;
        }

        // Recorded only once a checkout exists, so a refused request never
        // triggers checkout-recovery emails.
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
        if (!user?.id) return;

        setIsLoadingApiKey(true);
        setApiKeyError(null);
        setApiKeyErrorCode(null);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setApiKeyError('Your session expired. Please sign in again.');
                return;
            }
            const response = await fetch(`${getApiBase()}/get-api-key`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.api_key) {
                const error = new Error(data.error || 'Failed to load API key') as Error & { code?: string };
                error.code = data.code;
                throw error;
            }

            setApiKey(data.api_key);
            setApiKeyErrorCode(null);
        } catch (error) {
            const typedError = error as Error & { code?: string };
            setApiKey(null);
            setApiKeyError(typedError.message);
            setApiKeyErrorCode(typedError.code || null);
            if (typedError.code === 'api_key_encryption_not_configured') {
                console.warn('API key service is not configured:', typedError.message);
            } else {
                console.error('Error loading API key:', error);
                toast.error('Error loading API key');
            }
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
                            subscription_status: usageData.data.subscription_status || null,
                            billing_cycle: usageData.data.billing_cycle || null,
                            monthly_credit_allowance: usageData.data.monthly_credit_allowance || null,
                            plugin_connected: usageData.data.plugin_connected === true,
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
                        plan: 'free',
                        plugin_connected: false,
                    });
                } else {
                    setUsageStats({
                        credits_remaining: profile.credits_remaining || 0,
                        bonus_credits_remaining: profile.bonus_credits_remaining || 0,
                        purchased_credits_remaining: profile.purchased_credits_remaining || 0,
                        total_processed: profile.total_processed || 0,
                        plan: profile.subscription_plan || 'free',
                        subscription_status: profile.subscription_status || null,
                        billing_cycle: profile.billing_cycle || null,
                        monthly_credit_allowance: profile.monthly_credit_allowance || null,
                        plugin_connected: false,
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
        if (!user?.id) return;

        const timer = window.setTimeout(() => {
            void loadApiKey();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadApiKey, user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        const timer = window.setTimeout(() => {
            void loadHistory();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadHistory, user?.id]);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            try {
                const preparedImage = await prepareDashboardImage(file);
                setTestImage(preparedImage);
                setTestResult(null);
                setGeneratedAltText("");
            } catch (error) {
                console.error('Failed to prepare dashboard image:', error);
                toast.error(error instanceof Error ? error.message : 'This image could not be prepared for generation.');
            } finally {
                event.target.value = '';
            }
        }
    };

    // Reopen a plan or pack chosen on the homepage before sign-up or sign-in.
    const pendingCheckoutHandledRef = useRef(false);
    useEffect(() => {
        if (!usageStats || pendingCheckoutHandledRef.current) return;
        pendingCheckoutHandledRef.current = true;

        const pending = consumePendingCheckout();
        if (!pending) return;

        if (pending.kind === 'subscription' && isSubscribed) {
            toast.info(SUBSCRIPTION_EXISTS_MESSAGE);
            return;
        }
        if (pending.kind === 'pack' && !isCreditPackEligible) return;

        // Deferred like the other dashboard effects. Not cancelled on cleanup:
        // the saved choice is already consumed and must still open once.
        window.setTimeout(() => {
            setUpgradeModalView(pending.kind === 'pack' ? 'credit-packs' : 'plans');
            setSelectedUpgradePlan({ id: pending.checkoutId, name: pending.name, price: pending.price });
            setShowUpgradeModal(true);
        }, 0);
    }, [usageStats, isSubscribed, isCreditPackEligible]);

    const rotateApiKey = async () => {
        if (!user?.id) return;

        if (!confirm("Rotate your API key? Your old key will stop working immediately.")) {
            return;
        }

        setIsLoadingApiKey(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                toast.error("Your session expired. Please sign in again.");
                return;
            }
            const response = await fetch(`${getApiBase()}/get-api-key`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rotate: true }),
            });
            const data = await response.json();

            if (!response.ok || !data.success || !data.api_key) {
                throw new Error(data.error || 'Failed to rotate API key');
            }

            setApiKey(data.api_key);
            setApiKeyError(null);
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

        const accessToken = await getAccessToken();
        if (!accessToken) {
            toast.error("Session expired. Please sign in again.");
            router.push("/");
            return;
        }

        // Check if user has credits
        if (usageStats?.credits_remaining <= 0) {
            if (isSubscribed) {
                // Subscribers change plans in the customer portal; offer packs here.
                toast.error("No credits remaining. Top up with a credit pack or change your plan in Manage billing.");
                setUpgradeModalView("credit-packs");
            } else {
                toast.error("No credits remaining. Please upgrade your plan to continue.");
                setUpgradeModalView("plans");
            }
            setSelectedUpgradePlan(null);
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
                    'Authorization': `Bearer ${accessToken}`
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
        <div className="dashboard-shell min-h-screen bg-[#f7f7f5] text-notebook-slate font-lato selection:bg-notebook-yellow selection:text-black">
            <aside className="fixed inset-y-0 left-0 z-50 hidden w-[248px] flex-col bg-notebook-black px-4 py-5 text-white lg:flex">
                <Link href="/" className="flex items-center gap-3 px-2 py-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                        <NextImage
                            src="/logo-alt-text-pro.png"
                            alt="Alt Text Pro"
                            width={36}
                            height={36}
                            className="h-9 w-9 object-contain"
                        />
                    </span>
                    <span className="font-lato text-xl font-semibold tracking-tight">Alt Text Pro</span>
                </Link>

                <nav className="mt-10 space-y-2" aria-label="Dashboard navigation">
                    {dashboardNavItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <a
                                key={item.label}
                                href={item.href}
                                className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notebook-yellow ${index === 0 ? 'bg-notebook-yellow text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                            >
                                <Icon className="h-5 w-5" />
                                {item.label}
                            </a>
                        );
                    })}
                </nav>

                <div className="mt-6 border-t border-white/10 pt-6">
                    <Link
                        href="/docs"
                        className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notebook-yellow"
                    >
                        <HelpCircle className="h-5 w-5" />
                        Help & docs
                    </Link>
                </div>

                <div className="mt-auto space-y-4">
                    <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-white/60">Current plan</span>
                            <span className="rounded-full bg-notebook-yellow px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                                {basePlanLabel}
                            </span>
                        </div>
                        <p className="mt-3 text-xs font-medium text-white/80">{renewalDateLabel}</p>
                    </div>

                    <button
                        type="button"
                        onClick={signOut}
                        className="flex w-full items-center gap-3 rounded-xl border-t border-white/10 px-2 pt-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notebook-yellow"
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
                            {accountInitial}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">{user?.email}</span>
                            <span className="block text-xs text-white/50">Sign out</span>
                        </span>
                        <LogOut className="h-4 w-4 text-white/60" />
                    </button>
                </div>
            </aside>

            {isMobileNavOpen && (
                <div className="fixed inset-0 z-[70] lg:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        className="absolute inset-0 bg-black/45"
                        onClick={() => setIsMobileNavOpen(false)}
                    />
                    <aside id="mobile-dashboard-nav" className="relative flex h-full w-[min(86vw,320px)] flex-col bg-black p-5 text-white shadow-2xl">
                        <div className="flex items-center justify-between">
                            <Link href="/" className="flex items-center gap-3" onClick={() => setIsMobileNavOpen(false)}>
                                <NextImage src="/logo-alt-text-pro.png" alt="Alt Text Pro" width={40} height={40} className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
                                <span className="font-lato text-lg font-semibold">Alt Text Pro</span>
                            </Link>
                            <button type="button" onClick={() => setIsMobileNavOpen(false)} className="rounded-lg p-2 text-white/70 hover:bg-white/10" aria-label="Close navigation">
                                <PanelLeftClose className="h-5 w-5" />
                            </button>
                        </div>
                        <nav className="mt-8 space-y-2" aria-label="Mobile dashboard navigation">
                            {dashboardNavItems.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <a
                                        key={item.label}
                                        href={item.href}
                                        onClick={() => setIsMobileNavOpen(false)}
                                        className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${index === 0 ? 'bg-notebook-yellow text-black' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <Icon className="h-5 w-5" />
                                        {item.label}
                                    </a>
                                );
                            })}
                        </nav>
                        <button type="button" onClick={signOut} className="mt-auto flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/80">
                            <LogOut className="h-5 w-5" />
                            Sign out
                        </button>
                    </aside>
                </div>
            )}

            <main id="overview" className="min-h-screen scroll-mt-6 lg:ml-[248px]">
                <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/10 bg-white/95 px-4 backdrop-blur lg:hidden">
                    <button
                        type="button"
                        aria-label="Open dashboard navigation"
                        aria-controls="mobile-dashboard-nav"
                        aria-expanded={isMobileNavOpen}
                        onClick={() => setIsMobileNavOpen(true)}
                        className="rounded-xl border border-black/10 p-2.5 text-black"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <span className="font-lato text-lg font-semibold">Operations console</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-notebook-yellow text-xs font-bold text-black">{accountInitial}</span>
                </div>

                <div className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 lg:px-8 xl:px-10 xl:py-9">
                    <header className="mb-7 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <h1 className="font-lato text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                                Operations Console
                            </h1>
                            <p className="mt-2 text-sm text-slate-500 sm:text-base">
                                Welcome back, <span className="capitalize">{firstName}</span>. Monitor alt text generation and manage your workflow.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:flex-nowrap">
                            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 xl:min-w-[256px]">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-notebook-yellow/25">
                                    <NextImage src="/logos/wordpress.svg" alt="" aria-hidden width={24} height={24} className="h-6 w-6" />
                                </span>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-black">
                                        WordPress {isPluginConnected ? 'connected' : 'not connected'}
                                        <span className={`h-2 w-2 rounded-full ${isPluginConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
                                    </p>
                                    <p className="whitespace-nowrap text-xs text-slate-500">{isPluginConnected ? 'Plugin connection active' : 'Finish setup to start generating'}</p>
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 xl:min-w-[180px]">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-notebook-yellow">
                                    <CreditCard className="h-5 w-5 text-black" />
                                </span>
                                <div>
                                    <p className="whitespace-nowrap text-sm font-semibold text-black">{creditsRemaining.toLocaleString()} credits</p>
                                    <p className="whitespace-nowrap text-xs text-slate-500">{creditsUsed.toLocaleString()} used this cycle</p>
                                </div>
                            </div>

                            <Link
                                href="/docs#bulk-processing"
                                className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-notebook-yellow px-5 text-sm font-bold text-black shadow-notebook transition-transform hover:-translate-y-0.5 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 xl:min-w-[232px]"
                            >
                                <Layers3 className="h-5 w-5" />
                                Start bulk generation
                            </Link>
                        </div>
                    </header>

                    {showFirstRunOnboarding && (
                        <section
                            aria-labelledby="setup-heading"
                            className="mb-7 flex flex-col gap-4 rounded-2xl border border-notebook-yellow/80 bg-[#fffdf2] p-4 shadow-notebook sm:flex-row sm:items-center sm:justify-between sm:p-5"
                        >
                            <div className="flex items-start gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-notebook-yellow text-black">
                                    {isPluginConnected ? <Sparkles className="h-5 w-5" /> : <PlugZap className="h-5 w-5" />}
                                </span>
                                <div>
                                    <h2 id="setup-heading" className="font-lato text-lg font-semibold text-black">
                                        {isPluginConnected ? 'Generate your first alt text' : 'Connect your WordPress plugin'}
                                    </h2>
                                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                                        {isPluginConnected
                                            ? 'Your account is connected. Try one image before starting a larger media-library batch.'
                                            : hasApiKeyReady
                                            ? 'Your API key is ready. Open Alt Text Pro in WordPress and finish connecting the plugin.'
                                            : 'Install Alt Text Pro, connect your account, and your dashboard will begin tracking activity.'}
                                    </p>
                                </div>
                            </div>
                            <a
                                href={isPluginConnected ? '#generate' : '/docs#installation'}
                                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                                {isPluginConnected ? 'Generate an image' : 'Open setup guide'}
                                <ChevronRight className="h-4 w-4" />
                            </a>
                        </section>
                    )}

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <section id="activity" aria-labelledby="activity-heading" className="scroll-mt-24 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-notebook">
                            <div className="flex flex-col gap-3 border-b border-black/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div>
                                    <h2 id="activity-heading" className="font-lato text-xl font-semibold text-black">Recent activity</h2>
                                    <p className="mt-1 text-sm text-slate-500">Your latest generated alt text</p>
                                </div>
                                <span className="inline-flex w-fit items-center rounded-full bg-notebook-yellow/30 px-3 py-1.5 text-xs font-semibold text-black">
                                    {(usageStats?.total_processed || 0).toLocaleString()} images optimized
                                </span>
                            </div>

                            <div className="hidden grid-cols-[72px_minmax(0,1fr)_130px_130px_48px] items-center gap-4 border-b border-black/10 bg-[#fafafa] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 md:grid">
                                <span>Image</span>
                                <span>Generated alt text / source</span>
                                <span>Status</span>
                                <span>Date</span>
                                <span className="sr-only">Actions</span>
                            </div>

                            <div aria-live="polite">
                                {isLoadingHistory ? (
                                    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                                        <RefreshCw className="h-7 w-7 animate-spin text-black" />
                                        <p className="mt-4 text-sm font-semibold text-black">Loading activity</p>
                                        <p className="mt-1 text-sm text-slate-500">Fetching your latest generations.</p>
                                    </div>
                                ) : history.length > 0 ? (
                                    history.slice(0, 5).map((item, index) => (
                                        <article
                                            key={item.id || index}
                                            className="grid grid-cols-[56px_minmax(0,1fr)_40px] items-start gap-x-3 gap-y-2 border-b border-black/10 px-5 py-4 last:border-b-0 hover:bg-[#fffdf2] md:grid-cols-[72px_minmax(0,1fr)_130px_130px_48px] md:items-center md:gap-4 md:px-6"
                                        >
                                            <div className="col-start-1 row-start-1 flex h-14 w-14 items-center justify-center rounded-xl border border-black/10 bg-notebook-yellow/25 md:col-auto md:row-auto">
                                                <ImageIcon className="h-6 w-6 text-black" />
                                            </div>
                                            <div className="col-start-2 row-start-1 min-w-0 md:col-auto md:row-auto">
                                                <p className="line-clamp-2 text-sm font-semibold leading-6 text-black">{item.alt}</p>
                                                <p className="mt-1 truncate text-xs text-slate-500">{item.context || 'WordPress media'}</p>
                                            </div>
                                            <div className="col-start-2 row-start-2 md:col-auto md:row-auto">
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                                                    <CircleCheck className="h-3.5 w-3.5" />
                                                    Generated
                                                </span>
                                            </div>
                                            <time className="col-start-2 row-start-3 text-xs leading-5 text-slate-500 md:col-auto md:row-auto" dateTime={item.date}>
                                                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                <span className="ml-1 md:ml-0 md:block">{new Date(item.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                                            </time>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(item.alt);
                                                    toast.success("Copied to clipboard");
                                                }}
                                                className="col-start-3 row-start-1 flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 text-slate-500 transition-colors hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 md:col-auto md:row-auto"
                                                aria-label="Copy generated alt text"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        </article>
                                    ))
                                ) : (
                                    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-notebook-yellow/30">
                                            <ImageIcon className="h-6 w-6 text-black" />
                                        </span>
                                        <p className="mt-4 text-sm font-semibold text-black">No generations yet</p>
                                        <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Upload one image below to create your first reviewable alt text draft.</p>
                                        <a href="#generate" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black underline decoration-notebook-yellow decoration-4 underline-offset-4">
                                            Generate alt text <ArrowRight className="h-4 w-4" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </section>

                        <aside className="space-y-6" aria-label="Dashboard controls">
                            <section aria-labelledby="quick-actions-heading" className="rounded-2xl border border-black/10 bg-white p-5 shadow-notebook">
                                <h2 id="quick-actions-heading" className="font-lato text-lg font-semibold text-black">Quick actions</h2>
                                <div className="mt-4 divide-y divide-black/10">
                                    {[
                                        { label: 'Generate alt text', help: 'Upload and review one image', href: '#generate', icon: Sparkles },
                                        { label: 'Bulk generator', help: 'Process images inside WordPress', href: '/docs#bulk-processing', icon: Layers3 },
                                        { label: 'Usage & credits', help: 'Review your allowance', href: '#usage', icon: BarChart3 },
                                        { label: 'API settings', help: 'Manage your plugin key', href: '#settings', icon: Key },
                                    ].map((action) => {
                                        const Icon = action.icon;
                                        return (
                                            <a
                                                key={action.label}
                                                href={action.href}
                                                className="group flex min-h-[72px] items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                            >
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-[#fafafa] group-hover:bg-notebook-yellow">
                                                    <Icon className="h-5 w-5 text-black" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-black">{action.label}</span>
                                                    <span className="mt-0.5 block text-xs text-slate-500">{action.help}</span>
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-black" />
                                            </a>
                                        );
                                    })}
                                </div>
                            </section>

                            <section id="usage" aria-labelledby="usage-heading" className="scroll-mt-24 rounded-2xl border border-black/10 bg-white p-5 shadow-notebook">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 id="usage-heading" className="font-lato text-lg font-semibold text-black">Plan & usage</h2>
                                    <span className="rounded-full bg-notebook-yellow px-3 py-1 text-xs font-bold text-black">{displayPlanLabel}</span>
                                </div>
                                <div className="mt-6 flex items-end justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500">Credits used</p>
                                        <p className="mt-1 font-lato text-2xl font-semibold text-black">{creditsUsed.toLocaleString()}</p>
                                    </div>
                                    <p className="text-sm text-slate-500">of {creditUsageLimit.toLocaleString()}</p>
                                </div>
                                <progress
                                    className="operations-credit-progress mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                                    value={creditUsagePercent}
                                    max={100}
                                    aria-label={`${creditUsagePercent.toFixed(0)} percent of available credits used`}
                                />
                                <p className="mt-3 text-xs leading-5 text-slate-500">{creditCardDescription}</p>

                                <ul className="mt-5 space-y-3 border-t border-black/10 pt-5 text-sm text-slate-600">
                                    <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-emerald-600" /> WordPress plugin included</li>
                                    <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-emerald-600" /> One credit per successful image</li>
                                    <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-emerald-600" /> Bonus and purchased credits persist</li>
                                </ul>

                                <div className="mt-6 grid gap-3">
                                    {usageStats?.plan && usageStats.plan !== 'free' && subscriptionData?.subscription?.polar_customer_id ? (
                                        <button type="button" onClick={openCustomerPortal} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold text-black hover:bg-black hover:text-white">
                                            Manage billing <ArrowRight className="h-4 w-4" />
                                        </button>
                                    ) : usageStats?.plan && usageStats.plan !== 'free' ? (
                                        <button type="button" onClick={() => router.push('/#pricing')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold text-black hover:bg-black hover:text-white">
                                            View plan details <ArrowRight className="h-4 w-4" />
                                        </button>
                                    ) : (
                                        <button type="button" onClick={openUpgradePlans} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-notebook-yellow px-4 text-sm font-bold text-black hover:bg-yellow-300">
                                            Upgrade plan <ArrowRight className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={openCreditPacks}
                                        disabled={!isCreditPackEligible}
                                        title={!isCreditPackEligible ? 'Credit packs are unavailable for this account' : undefined}
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/15 px-4 text-sm font-semibold text-black hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        Top up credits
                                    </button>
                                </div>
                            </section>
                        </aside>
                    </div>

                    <section id="generate" aria-labelledby="generate-heading" className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-notebook">
                        <div className="border-b border-black/10 px-5 py-5 sm:px-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-notebook-yellow">
                                    <Sparkles className="h-5 w-5 text-black" />
                                </span>
                                <div>
                                    <h2 id="generate-heading" className="font-lato text-xl font-semibold text-black">Generate alt text</h2>
                                    <p className="mt-1 text-sm text-slate-500">Test one image before starting a WordPress bulk batch.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
                            <div>
                                <button
                                    type="button"
                                    className="flex min-h-[260px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-black/15 bg-[#fafafa] p-6 text-center transition-colors hover:border-black hover:bg-[#fffdf2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                    onClick={() => document.getElementById('operations-image-upload')?.click()}
                                >
                                    <input id="operations-image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                                    {testImage ? (
                                        <span className="relative block aspect-video w-full overflow-hidden rounded-xl">
                                            <NextImage src={testImage} alt="Selected image preview" fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                                        </span>
                                    ) : (
                                        <>
                                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-notebook-yellow text-black">
                                                <Upload className="h-6 w-6" />
                                            </span>
                                            <span className="mt-5 text-sm font-semibold text-black">Choose an image</span>
                                            <span className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP, or GIF</span>
                                        </>
                                    )}
                                </button>
                                <div className="mt-4 flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3">
                                    <div>
                                        <p className="text-xs font-semibold text-black">Generation mode</p>
                                        <p className="mt-0.5 text-xs text-slate-500">Reviewable AI draft</p>
                                    </div>
                                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden /> Ready
                                    </span>
                                </div>
                            </div>

                            <div className="flex min-h-[320px] flex-col">
                                <div className="flex flex-1 flex-col rounded-2xl border border-black/10 bg-[#fafafa] p-5 sm:p-6" aria-live="polite">
                                    {isGenerating ? (
                                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                                            <RefreshCw className="h-8 w-8 animate-spin text-black" />
                                            <p className="mt-4 text-sm font-semibold text-black">Analyzing image</p>
                                            <p className="mt-1 text-xs text-slate-500">Creating a concise, reviewable description.</p>
                                        </div>
                                    ) : generatedAltText ? (
                                        <>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                                                    <CircleCheck className="h-3.5 w-3.5" /> Ready to review
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedAltText);
                                                        toast.success("Copied to clipboard");
                                                    }}
                                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 text-slate-500 hover:bg-black hover:text-white"
                                                    aria-label="Copy generated alt text"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <p className="mt-5 flex-1 rounded-xl bg-white p-4 text-sm font-medium leading-7 text-black">{generatedAltText}</p>
                                        </>
                                    ) : (
                                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                                            <FileText className="h-8 w-8 text-slate-300" />
                                            <p className="mt-4 text-sm font-semibold text-black">Your generated alt text will appear here</p>
                                            <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Choose an image, then generate a draft you can review before using it.</p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={generateTestAltText}
                                    disabled={!testImage || isGenerating}
                                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    {isGenerating ? 'Generating alt text…' : 'Generate alt text'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section id="settings" aria-labelledby="settings-heading" className="mt-6 scroll-mt-24 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-notebook sm:p-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-notebook-yellow"><Key className="h-5 w-5 text-black" /></span>
                                <div>
                                    <h2 id="settings-heading" className="font-lato text-xl font-semibold text-black">API settings</h2>
                                    <p className="mt-1 text-sm text-slate-500">Manage the key used by your WordPress plugin.</p>
                                </div>
                            </div>
                            <p className="mt-6 text-xs font-semibold text-slate-600">Secret API key</p>
                            <div className="mt-2 flex overflow-hidden rounded-xl border border-black/15 bg-[#fafafa] focus-within:ring-2 focus-within:ring-black">
                                <div className="min-w-0 flex-1 px-4 py-3.5 font-mono text-xs text-black" aria-label="Secret API key">
                                    {isLoadingApiKey ? 'Loading…' : apiKeyError ? 'Unavailable' : showApiKey ? apiKey : '••••••••••••••••••••••••••••••'}
                                </div>
                                <button type="button" onClick={() => setShowApiKey(!showApiKey)} disabled={!apiKey} className="flex w-12 items-center justify-center border-l border-black/10 text-slate-500 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40" aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
                                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (apiKey) {
                                            navigator.clipboard.writeText(apiKey);
                                            toast.success("API key copied to clipboard");
                                        }
                                    }}
                                    disabled={!apiKey}
                                    className="flex w-12 items-center justify-center border-l border-black/10 text-slate-500 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Copy API key"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                            {apiKeyError && (
                                <p className="mt-3 text-xs leading-5 text-amber-800" role="status">
                                    {apiKeyError}
                                </p>
                            )}
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <button type="button" onClick={rotateApiKey} disabled={isLoadingApiKey || apiKeyErrorCode === 'api_key_encryption_not_configured'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/15 px-4 text-sm font-semibold text-black hover:bg-[#fafafa] disabled:opacity-50">
                                    <RefreshCw className={`h-4 w-4 ${isLoadingApiKey ? 'animate-spin' : ''}`} />
                                    Generate new key
                                </button>
                                <a
                                    href={`/wordpress-plugin/alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                                    download={`alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                                    onClick={() => trackMarketingEvent("plugin_downloaded", {
                                        source: "dashboard",
                                        userId: user?.id,
                                        userEmail: user?.email,
                                        properties: { plugin_version: PLUGIN_VERSION, location: "dashboard_settings" },
                                    })}
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-notebook-yellow px-4 text-sm font-bold text-black hover:bg-yellow-300"
                                >
                                    <Download className="h-4 w-4" /> Download plugin v{PLUGIN_VERSION}
                                </a>
                            </div>
                            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-amber-800">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                Rotating the key disconnects the old key immediately. Update WordPress after rotating it.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-black/10 bg-black p-5 text-white shadow-notebook sm:p-6">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-notebook-yellow text-black"><HelpCircle className="h-5 w-5" /></span>
                            <h2 className="mt-5 font-lato text-xl font-semibold">Help & support</h2>
                            <p className="mt-2 text-sm leading-6 text-white/65">Find installation guidance or contact us if your WordPress connection needs attention.</p>
                            <div className="mt-6 grid gap-3">
                                <Link href="/docs" className="inline-flex min-h-11 items-center justify-between rounded-xl border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/10">
                                    Documentation <Book className="h-4 w-4" />
                                </Link>
                                <Link href="/contact" className="inline-flex min-h-11 items-center justify-between rounded-xl border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/10">
                                    Contact support <MessageCircle className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </section>

                    <footer className="mt-8 flex flex-col gap-2 border-t border-black/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                        <p>Alt Text Pro v{PLUGIN_VERSION} · System status: active</p>
                        <p>© 2026 Alt Text Pro. Built for accessible publishing.</p>
                    </footer>

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
                                <h2 className="text-4xl font-semibold text-[#1A1C1E] mb-4 tracking-tight font-lato">
                                    {upgradeModalView === "credit-packs"
                                        ? <>Top up <span className="text-[#000000]">credits</span></>
                                        : <>Choose a <span className="text-[#000000]">Plan</span></>}
                                </h2>
                                <p className="text-[#5F6368] text-lg font-lato">
                                    {upgradeModalView === "credit-packs"
                                        ? "Choose a one-time pack to add credits to your account."
                                        : "Compare the available plans and credit allowances."}
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
                                        <h3 className="text-2xl font-semibold text-[#1A1C1E] mb-2 font-lato">
                                            {selectedUpgradePlan.name}{selectedUpgradeIsPack ? '' : ' Plan'}
                                        </h3>
                                        <div className="text-5xl font-semibold text-[#1A1C1E] mb-8 font-lato">
                                            {selectedUpgradePlan.price}<span className="text-xl text-[#5F6368] font-normal font-lato">{selectedUpgradeIsPack ? ' one time' : selectedUpgradePlan.id.endsWith('_annual') ? '/yr' : '/mo'}</span>
                                        </div>
                                        <div className="space-y-5 text-left mb-10 pt-8 border-t border-[#F1F3F4] font-lato">
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
                                            disabled={selectedUpgradeIsPack && !isCreditPackEligible}
                                            title={selectedUpgradeIsPack && !isCreditPackEligible ? "Credit packs are unavailable for this account" : undefined}
                                            className="w-full h-14 bg-[#000000] hover:bg-[#000000] text-white font-semibold text-lg rounded-xl transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                        >
                                            {selectedUpgradeIsPack ? 'Buy Credits' : 'Upgrade Now'}
                                            <ArrowRight className="h-5 w-5 ml-2" />
                                        </Button>

                                        <button
                                            onClick={() => setSelectedUpgradePlan(null)}
                                            className="w-full mt-6 text-[#5F6368] hover:text-[#1A1C1E] text-sm font-medium transition-colors p-2"
                                        >
                                            Back to {upgradeModalView === "credit-packs" ? "Credit Packs" : "Plans"}
                                        </button>
                                    </div>
                                    <div className="text-center text-xs text-[#9AA0A6] flex items-center justify-center gap-2">
                                        <Shield className="h-3.5 w-3.5" /> Encrypted Transaction via Polar.sh
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {upgradeModalView === "plans" && <div>
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                                            <h3 className="text-lg font-semibold text-[#1A1C1E] font-lato border-l-4 border-[#000000] pl-4">Subscription Plans</h3>
                                            <div className="inline-flex rounded-xl border border-[#F1F3F4] bg-[#FAF9F6] p-1" role="group" aria-label="Billing cycle">
                                                <button
                                                    type="button"
                                                    onClick={() => setUpgradeBillingCycle('monthly')}
                                                    aria-pressed={upgradeBillingCycle === 'monthly'}
                                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${upgradeBillingCycle === 'monthly' ? 'bg-[#000000] text-white' : 'text-[#5F6368] hover:text-[#1A1C1E]'}`}
                                                >
                                                    Monthly
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setUpgradeBillingCycle('annual')}
                                                    aria-pressed={upgradeBillingCycle === 'annual'}
                                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${upgradeBillingCycle === 'annual' ? 'bg-[#000000] text-white' : 'text-[#5F6368] hover:text-[#1A1C1E]'}`}
                                                >
                                                    Annual
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid md:grid-cols-3 gap-8">
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
                                                    <h4 className="text-lg font-semibold text-[#1A1C1E] font-lato">{plan.name}</h4>
                                                    <div className="mt-4 mb-8">
                                                        <span className="text-4xl font-semibold text-[#1A1C1E] font-lato">{upgradeBillingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice}</span>
                                                        <span className="text-[#5F6368] font-normal ml-1 font-lato">/{upgradeBillingCycle === 'annual' ? 'yr' : 'mo'}</span>
                                                        {upgradeBillingCycle === 'annual' && (
                                                            <p className="mt-2 text-xs text-[#5F6368]">Equivalent to {plan.annualMonthlyPrice}/mo</p>
                                                        )}
                                                    </div>
                                                    <ul className="space-y-4 mb-10 flex-1 font-lato">
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
                                                        onClick={() => handleUpgradePlan(
                                                            `${plan.id}_${upgradeBillingCycle}`,
                                                            plan.name,
                                                            upgradeBillingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice,
                                                        )}
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
                                    </div>}

                                    <div>
                                        <h3 className="text-lg font-semibold text-[#1A1C1E] mb-3 font-lato border-l-4 border-amber-400 pl-4">Credits (One-Time)</h3>
                                        <p className="text-sm text-[#5F6368] mb-8 ml-4">Available on every plan, including Free. Pack credits never expire and are used after your monthly allowance.</p>
                                        <div className="grid md:grid-cols-3 gap-8">
                                            {CREDIT_PACKS.map((pack) => (
                                                <article
                                                    key={pack.id}
                                                    className="flex flex-col rounded-[2rem] border border-[#F1F3F4] bg-[#FAF9F6] p-8 transition-all hover:shadow-lg"
                                                >
                                                    <h4 className="text-lg font-semibold text-[#1A1C1E] font-lato">{pack.name}</h4>
                                                    <div className="mt-4 mb-8">
                                                        <span className="text-4xl font-semibold text-[#1A1C1E] font-lato">{pack.price}</span>
                                                        <span className="text-[#5F6368] font-normal ml-2 font-lato text-sm">one-time purchase</span>
                                                    </div>
                                                    <ul className="space-y-4 mb-10 flex-1 font-lato">
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
                                                        disabled={!isCreditPackEligible}
                                                        title={!isCreditPackEligible ? "Credit packs are unavailable for this account" : undefined}
                                                        className="w-full bg-white text-[#1A1C1E] hover:bg-[#F1F3F4] border border-[#F1F3F4] rounded-xl font-medium disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100"
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
