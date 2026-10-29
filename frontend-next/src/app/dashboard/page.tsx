"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { getAccessToken, supabase } from '@/lib/supabase';
import { getApiBase, PLAN_CREDIT_LIMITS, PLUGIN_VERSION } from '@/lib/utils';
import { trackMarketingEvent } from '@/lib/analytics';
import { getPolarProductId } from '@/lib/polar-products';
import { CREDIT_PACKS, getPlanDisplayName, getPurchaseOption, PRICE_TAX_NOTE, SUBSCRIPTION_PLANS } from '@/lib/pricing-catalog';
import { isCreditPackEligible as getIsCreditPackEligible } from '@/lib/credit-pack-eligibility';
import { getUsageDisplayLimit } from '@/lib/credit-display';
import {
    CHECKOUT_POLL_INTERVAL_MS,
    CHECKOUT_POLL_TIMEOUT_MS,
    consumeCheckoutBaseline,
    consumePendingCheckout,
    hasAccountChangedSinceCheckout,
    saveCheckoutBaseline,
    type AccountSnapshot,
} from '@/lib/pending-checkout';
import { consumePendingDemoImage } from '@/lib/pending-demo-image';
import { hasPasswordIdentity } from '@/lib/auth-redirect';
import { fetchUsageStats, getFreeRefillDate, snapshotFromUsage, type UsageStats } from './dashboard-helpers';
import GenerationHistory from './GenerationHistory';
import ConnectedSites from './ConnectedSites';
import GettingStarted from './GettingStarted';
import AccountSettings from './AccountSettings';
import DeleteAccountCard from './DeleteAccountCard';
import { hasLivePaidSubscription, SUBSCRIPTION_EXISTS_CODE, SUBSCRIPTION_EXISTS_MESSAGE } from '@/lib/subscription-status';
import { prepareImageForUpload } from '@/lib/prepare-image';

type UsageHistoryItem = {
    id: string;
    alt: string;
    context: string | null;
    date: string;
};

type UpgradeModalView = "plans" | "credit-packs";
type SessionStatus = "checking" | "ready" | "redirecting";
type CheckoutSyncState = "idle" | "waiting" | "timeout";

import { toast } from "sonner";
import {
    ArrowRight, Shield, Upload, Eye, EyeOff, Download, Check,
    CreditCard, Key, Copy, AlertTriangle, RefreshCw, Book, FileText,
    HelpCircle, Settings, LogOut, MessageCircle, Image as ImageIcon, Crown, X,
    LayoutDashboard, Menu, PanelLeftClose, Sparkles, Layers3, BarChart3,
    ChevronRight, CircleCheck, PlugZap, History, UserRound, Loader2
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [usageStats, setUsageStats] = useState<any>(null);
    const [testImage, setTestImage] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Nothing account-specific renders until the session check finishes.
    const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
    const [usageError, setUsageError] = useState<string | null>(null);
    const [isRetryingUsage, setIsRetryingUsage] = useState(false);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
    const [checkoutSync, setCheckoutSync] = useState<CheckoutSyncState>("idle");
    // Set while this tab signs out, so the auth listener doesn't treat it as
    // a sign-out from another tab.
    const signingOutRef = useRef(false);
    const userIdRef = useRef<string | null>(null);
    const checkoutReturnRef = useRef(false);
    const checkoutPollStartedRef = useRef(false);
    const checkoutPollTimerRef = useRef<number | null>(null);
    const isUnmountedRef = useRef(false);
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
    const creditUsageLimit = getUsageDisplayLimit(planAllowance, creditsRemaining, creditsUsed);
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
    const hasGeneratedFirstAltText = Number(usageStats?.total_generated ?? usageStats?.total_processed ?? 0) > 0 || history.length > 0;
    const isPluginConnected = usageStats?.plugin_connected === true;
    const showFirstRunOnboarding = !isPluginConnected || !hasGeneratedFirstAltText;
    const accountInitial = String(user?.email || 'A').charAt(0).toUpperCase();
    const canUsePassword = hasPasswordIdentity(user?.authUser);
    const firstName = String(user?.email || 'there').split('@')[0].split(/[._-]/)[0] || 'there';
    const renewalDateValue = subscriptionData?.subscription?.next_billing_date || null;
    const formatShortDate = (value: string | number | Date) =>
        new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
    const freeRefillDate = getFreeRefillDate(usageStats?.credits_last_renewed_at);
    const renewalDateLabel = renewalDateValue
        ? formatShortDate(renewalDateValue)
        : currentPlan === 'free'
        ? freeRefillDate
            ? `Free credits refill around ${formatShortDate(freeRefillDate)}`
            : 'Free credits refill every 30 days'
        : 'Billing date unavailable';
    const dashboardNavItems = [
        { label: 'Overview', href: '#overview', icon: LayoutDashboard },
        { label: 'Generate', href: '#generate', icon: Sparkles },
        { label: 'Activity', href: '#activity', icon: ImageIcon },
        { label: 'History', href: '#history', icon: History },
        { label: 'Usage', href: '#usage', icon: BarChart3 },
        { label: 'Settings', href: '#settings', icon: Settings },
        { label: 'Account', href: '#account', icon: UserRound },
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
                // Plan and credits come from get-usage; only the renewal date is lost.
                console.warn('Subscription API not available:', response.status);
                setSubscriptionData(null);
            }
        } catch (error: any) {
            console.warn('Subscription API not available:', error.message);
            setSubscriptionData(null);
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
        signingOutRef.current = true;
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                signingOutRef.current = false;
                toast.error(`Sign out failed: ${error.message}`);
                return;
            }
            toast.success("Logged out successfully");
            router.push("/");
        } catch (error) {
            signingOutRef.current = false;
            console.error("Logout failed:", error);
            toast.error("Sign out failed. Check your connection and try again.");
        }
    };

    // An expired or revoked session: sign out locally and go to sign-in.
    const handleSessionExpired = useCallback(async () => {
        signingOutRef.current = true;
        setSessionStatus("redirecting");
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch {
            // The session is already unusable; continue to sign-in.
        }
        toast.error("Your session expired. Please sign in again.");
        router.replace("/?auth=signin");
    }, [router]);

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

        // Lets the dashboard tell when the purchase reaches the account.
        if (usageStats) {
            saveCheckoutBaseline(snapshotFromUsage(usageStats));
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

            if (response.status === 404) {
                // No Polar customer yet: nothing has been bought on this account.
                toast.info('No billing history yet');
                return;
            }

            if (response.status === 401) {
                void handleSessionExpired();
                return;
            }

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

    // Returns the fresh usage, or null after handling a failure.
    const loadUsage = useCallback(async (accessToken: string): Promise<UsageStats | null> => {
        const result = await fetchUsageStats(getApiBase(), accessToken);
        if (result.status === "unauthorized") {
            await handleSessionExpired();
            return null;
        }
        if (result.status === "error") {
            console.error('Error loading usage data:', result.message);
            setUsageError(result.message);
            return null;
        }
        setUsageError(null);
        setUsageStats(result.stats);
        return result.stats;
    }, [handleSessionExpired]);

    const loadDashboard = useCallback(async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                setSessionStatus("redirecting");
                toast.error("Please sign in to access the dashboard");
                router.replace("/?auth=signin");
                return;
            }

            userIdRef.current = session.user.id;
            setUser({
                email: session.user.email,
                id: session.user.id,
                authUser: session.user,
            });
            setSessionStatus("ready");

            await loadUsage(session.access_token);

            // Load subscription data from API (non-blocking)
            loadSubscriptionData(session.access_token).catch(err => {
                console.warn('Could not load subscription data:', err.message);
            });

            setIsLoading(false);
        } catch (error) {
            console.error("Failed to load dashboard:", error);
            setUsageError("We couldn't load your dashboard. Check your connection and try again.");
            setIsLoading(false);
        }
    }, [loadSubscriptionData, loadUsage, router]);

    const retryUsage = async () => {
        setIsRetryingUsage(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                await handleSessionExpired();
                return;
            }
            const stats = await loadUsage(accessToken);
            if (stats) {
                loadSubscriptionData(accessToken).catch(() => undefined);
            }
        } finally {
            setIsRetryingUsage(false);
        }
    };

    const loadHistory = useCallback(async () => {
        if (!user?.id) return;

        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('usage_logs')
                .select('id, alt_text_generated, image_context, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

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

    // Follow sign-outs, account switches and email changes from other tabs.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                if (signingOutRef.current) return;
                setSessionStatus("redirecting");
                toast.info("You were signed out.");
                router.replace("/?auth=signin");
                return;
            }

            if (!session?.user) return;

            if (userIdRef.current && session.user.id !== userIdRef.current) {
                // Another account signed in elsewhere in this browser.
                window.location.reload();
                return;
            }

            if (event === 'USER_UPDATED') {
                setUser((previous: any) => previous
                    ? { ...previous, email: session.user.email, authUser: session.user }
                    : previous);
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    // Returning from checkout: /dashboard?checkout=success, or ?checkout=pending
    // when /payment-success stopped waiting before the account was updated.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const checkoutState = params.get('checkout');
        if (checkoutState !== 'success' && checkoutState !== 'pending') return;
        checkoutReturnRef.current = true;
        params.delete('checkout');
        params.delete('checkout_id');
        const query = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }, []);

    // Poll until Polar's webhook has updated the plan or credits.
    useEffect(() => {
        if (!checkoutReturnRef.current || !usageStats || checkoutPollStartedRef.current) return;
        checkoutPollStartedRef.current = true;

        const firstLoad = snapshotFromUsage(usageStats);
        const baseline: AccountSnapshot = consumeCheckoutBaseline() ?? firstLoad;
        if (hasAccountChangedSinceCheckout(baseline, firstLoad)) {
            toast.success("Payment received. Your account is up to date.");
            return;
        }

        const startedAt = Date.now();
        const poll = async () => {
            checkoutPollTimerRef.current = null;
            if (isUnmountedRef.current) return;
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setCheckoutSync("idle");
                void handleSessionExpired();
                return;
            }
            const stats = await loadUsage(accessToken);
            if (stats && hasAccountChangedSinceCheckout(baseline, snapshotFromUsage(stats))) {
                setCheckoutSync("idle");
                loadSubscriptionData(accessToken).catch(() => undefined);
                toast.success("Payment received. Your account is up to date.");
                return;
            }
            if (isUnmountedRef.current) return;
            if (Date.now() - startedAt >= CHECKOUT_POLL_TIMEOUT_MS) {
                setCheckoutSync("timeout");
                return;
            }
            checkoutPollTimerRef.current = window.setTimeout(() => void poll(), CHECKOUT_POLL_INTERVAL_MS);
        };

        // Deferred like the other dashboard effects.
        checkoutPollTimerRef.current = window.setTimeout(() => {
            setCheckoutSync("waiting");
            void poll();
        }, 0);
    }, [usageStats, loadUsage, loadSubscriptionData, handleSessionExpired]);

    useEffect(() => {
        isUnmountedRef.current = false;
        return () => {
            isUnmountedRef.current = true;
            if (checkoutPollTimerRef.current) window.clearTimeout(checkoutPollTimerRef.current);
        };
    }, []);

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
                const preparedImage = await prepareImageForUpload(file);
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

    // Load the image picked in the homepage demo before an email sign-up, so
    // it is waiting here after the confirmation link opens the dashboard.
    // Generating stays a click, since it uses a credit.
    const pendingDemoImageHandledRef = useRef(false);
    useEffect(() => {
        if (!user?.id || pendingDemoImageHandledRef.current) return;
        pendingDemoImageHandledRef.current = true;

        const image = consumePendingDemoImage();
        if (!image) return;

        window.setTimeout(() => {
            setTestImage(image);
            setTestResult(null);
            setGeneratedAltText("");
            document.getElementById('generate')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            toast.info('Your image from the homepage is ready. Click "Generate alt text" to describe it.');
        }, 0);
    }, [user?.id]);

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

    const handleAccountDeleted = async () => {
        signingOutRef.current = true;
        setSessionStatus("redirecting");
        try {
            // The server already removed the account; only local state is left.
            await supabase.auth.signOut({ scope: 'local' });
        } catch {
            // Nothing else to clean up.
        }
        toast.success("Your account has been deleted.");
        router.replace("/");
    };

    const rotateApiKey = async () => {
        if (!user?.id) return;

        if (!confirm("Generate a new API key? The old key stops working immediately, which disconnects every WordPress site that uses it until you reconnect it.")) {
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
            void handleSessionExpired();
            return;
        }

        // Check if user has credits
        if (usageStats?.credits_remaining <= 0) {
            if (isSubscribed) {
                // Subscribers change plans in the customer portal; offer packs here.
                toast.error("No credits remaining. Top up with a credit pack or change your plan in Billing & receipts.");
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
                // Lifetime, not per cycle: the first image happens once per account.
                const wasFirstProcessedImage = Number(usageStats?.total_generated ?? usageStats?.total_processed ?? 0) === 0 && history.length === 0;

                // Update with real data from API response
                const result = {
                    alt_text: data.alt_text || data.altText,
                    credits_used: 1,
                    credits_remaining: data.credits_remaining
                };

                setTestResult(result);

                // Update usage stats with real credits from API
                // The display reads the monthly fields first, so update them too.
                setUsageStats((prev: any) => {
                    const used = Number(data.total_processed ?? (Number(prev?.monthly_credits_used ?? prev?.total_processed ?? 0) + 1));
                    const remaining = Number(data.monthly_credits_remaining ?? data.credits_remaining ?? prev?.monthly_credits_remaining ?? 0);
                    return {
                        ...prev,
                        credits_remaining: data.credits_remaining,
                        monthly_credits_remaining: remaining,
                        monthly_credits_used: used,
                        monthly_credit_limit: data.monthly_credit_limit ?? prev?.monthly_credit_limit,
                        total_processed: used,
                        total_generated: Number(prev?.total_generated ?? 0) + 1,
                    };
                });

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
                setHistoryRefreshKey((key) => key + 1);

                toast.success("Alt-text generated successfully!");
            } else {
                console.error('API Error Response:', {
                    status: apiResponse.status,
                    statusText: apiResponse.statusText,
                    data: data
                });

                if (apiResponse.status === 401) {
                    void handleSessionExpired();
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

    // Loading gate: nothing account-specific renders before the session check.
    if (sessionStatus !== "ready" || (isLoading && !usageError)) {
        return (
            <main className="min-h-screen bg-yellow-tint flex items-center justify-center" aria-busy="true">
                <div className="text-center" role="status">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-line-strong mx-auto mb-4"></div>
                    <p className="text-ink-muted">
                        {sessionStatus === "redirecting" ? "Taking you to sign in…" : "Loading dashboard..."}
                    </p>
                </div>
            </main>
        );
    }

    // Never show "0 credits, Free plan" when the account could not be loaded.
    if (!usageStats) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-yellow-tint px-4 py-12 text-ink">
                <section className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-notebook sm:p-8">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-warning" aria-hidden="true">
                        <AlertTriangle className="h-8 w-8" />
                    </span>
                    <h1 className="mt-6 font-lato text-2xl font-semibold tracking-tight">We couldn&apos;t load your account</h1>
                    <p role="alert" className="mt-3 leading-7 text-ink-muted">
                        {usageError || "Your plan and credits are temporarily unavailable."} Nothing has changed on your account.
                    </p>
                    <div className="mt-8 grid gap-3">
                        <Button type="button" onClick={() => void retryUsage()} disabled={isRetryingUsage} className="w-full">
                            <RefreshCw className={isRetryingUsage ? 'animate-spin' : undefined} />
                            {isRetryingUsage ? 'Trying again…' : 'Try again'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => void signOut()} className="w-full">
                            <LogOut /> Sign out
                        </Button>
                        <Link href="/contact" className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}>
                            Contact support
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <div className="dashboard-shell min-h-screen bg-yellow-tint text-ink font-lato selection:bg-yellow-soft selection:text-ink">
            <aside className="fixed inset-y-0 left-0 z-50 hidden w-[248px] flex-col border-r border-line bg-white px-4 py-5 text-ink lg:flex">
                <Link href="/" className="flex items-center gap-3 px-2 py-2">
                    <NextImage
                        src="/brand/logo-mark.svg"
                        alt="Alt Text Pro"
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 shrink-0"
                    />
                    <span className="font-lato text-xl font-semibold tracking-tight">Alt Text Pro</span>
                </Link>

                <nav className="mt-10 space-y-2" aria-label="Dashboard navigation">
                    {dashboardNavItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <a
                                key={item.label}
                                href={item.href}
                                className={`flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${index === 0 ? 'bg-yellow-soft text-ink' : 'text-ink-muted hover:bg-yellow-tint hover:text-ink'}`}
                            >
                                <Icon className="h-5 w-5" />
                                {item.label}
                            </a>
                        );
                    })}
                </nav>

                <div className="mt-6 border-t border-line pt-6">
                    <Link
                        href="/docs"
                        className="flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-yellow-tint hover:text-ink"
                    >
                        <HelpCircle className="h-5 w-5" />
                        Help & docs
                    </Link>
                </div>

                <div className="mt-auto space-y-4">
                    <div className="rounded-2xl border border-line bg-yellow-tint p-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-ink-muted">Current plan</span>
                            <span className="inline-flex items-center rounded-full bg-brand-yellow px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink">
                                {basePlanLabel}
                            </span>
                        </div>
                        <p className="mt-3 text-xs font-medium text-ink">{renewalDateLabel}</p>
                    </div>

                    <div className="border-t border-line pt-4">
                        <button
                            type="button"
                            onClick={signOut}
                            className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-yellow-tint"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-sm font-bold text-ink">
                                {accountInitial}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-ink">{user?.email}</span>
                                <span className="block text-xs text-ink-muted">Sign out</span>
                            </span>
                            <LogOut className="h-4 w-4 shrink-0 text-ink-muted" />
                        </button>
                    </div>
                </div>
            </aside>

            {isMobileNavOpen && (
                <div className="fixed inset-0 z-[70] lg:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        className="absolute inset-0 bg-ink/45"
                        onClick={() => setIsMobileNavOpen(false)}
                    />
                    <aside id="mobile-dashboard-nav" className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-line bg-white p-5 text-ink shadow-notebook-lg">
                        <div className="flex items-center justify-between">
                            <Link href="/" className="flex items-center gap-3" onClick={() => setIsMobileNavOpen(false)}>
                                <NextImage src="/brand/logo-mark.svg" alt="Alt Text Pro" width={40} height={40} unoptimized className="h-10 w-10 shrink-0" />
                                <span className="font-lato text-lg font-semibold">Alt Text Pro</span>
                            </Link>
                            <button type="button" onClick={() => setIsMobileNavOpen(false)} className={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Close navigation">
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
                                        className={`flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${index === 0 ? 'bg-yellow-soft text-ink' : 'text-ink-muted hover:bg-yellow-tint hover:text-ink'}`}
                                    >
                                        <Icon className="h-5 w-5" />
                                        {item.label}
                                    </a>
                                );
                            })}
                        </nav>
                        <button type="button" onClick={signOut} className={cn(buttonVariants({ variant: 'secondary' }), 'mt-auto w-full')}>
                            <LogOut className="h-5 w-5" />
                            Sign out
                        </button>
                    </aside>
                </div>
            )}

            <main id="overview" className="min-h-screen scroll-mt-6 lg:ml-[248px]">
                <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
                    <button
                        type="button"
                        aria-label="Open dashboard navigation"
                        aria-controls="mobile-dashboard-nav"
                        aria-expanded={isMobileNavOpen}
                        onClick={() => setIsMobileNavOpen(true)}
                        className={buttonVariants({ variant: 'secondary', size: 'icon' })}
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <span className="font-lato text-lg font-semibold">Operations console</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-ink">{accountInitial}</span>
                </div>

                <div className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 lg:px-8 xl:px-10 xl:py-9">
                    <header className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <h1 className="font-lato text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                                Operations Console
                            </h1>
                            <p className="mt-2 text-sm text-ink-muted sm:text-base">
                                {isPluginConnected || hasGeneratedFirstAltText ? 'Welcome back' : 'Welcome'}, <span className="capitalize">{firstName}</span>. Monitor alt text generation and manage your workflow.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:flex-nowrap">
                            <div className="flex h-16 shrink-0 items-center gap-3 rounded-2xl border border-line bg-white px-4 xl:min-w-[256px]">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-soft">
                                    <NextImage src="/logos/wordpress.svg" alt="" aria-hidden width={24} height={24} className="h-6 w-6" />
                                </span>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-ink">
                                        WordPress {isPluginConnected ? 'connected' : 'not connected'}
                                        <span className={`h-2 w-2 rounded-full ${isPluginConnected ? 'bg-success' : 'bg-warning'}`} aria-hidden />
                                    </p>
                                    <p className="whitespace-nowrap text-xs text-ink-muted">{isPluginConnected ? 'Plugin connection active' : 'Finish setup to start generating'}</p>
                                </div>
                            </div>

                            <div className="flex h-16 shrink-0 items-center gap-3 rounded-2xl border border-line bg-white px-4 xl:min-w-[180px]">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-soft">
                                    <CreditCard className="h-5 w-5 text-ink" />
                                </span>
                                <div>
                                    <p className="whitespace-nowrap text-sm font-semibold text-ink">{creditsRemaining.toLocaleString()} credits</p>
                                    <p className="whitespace-nowrap text-xs text-ink-muted">{creditsUsed.toLocaleString()} used this cycle</p>
                                </div>
                            </div>

                            <Link
                                href="/docs#bulk-processing"
                                className={cn(buttonVariants(), 'xl:min-w-[232px]')}
                            >
                                <Layers3 className="h-5 w-5" />
                                Start bulk generation
                            </Link>
                        </div>
                    </header>

                    {checkoutSync === "waiting" && (
                        <div role="status" className="mb-6 flex items-center gap-3 rounded-2xl border border-line-strong bg-yellow-soft p-4 text-sm font-semibold text-ink">
                            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                            Payment received — updating your account…
                        </div>
                    )}
                    {checkoutSync === "timeout" && (
                        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-warning sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                                <span>
                                    Your payment went through, but your plan or credits haven&apos;t updated yet. This can take a few minutes.
                                    If they still look wrong, <Link href="/contact" className="font-semibold underline underline-offset-2">contact support</Link> and we&apos;ll sort it out.
                                </span>
                            </p>
                            <button type="button" onClick={() => { setCheckoutSync("idle"); void retryUsage(); }} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0')}>
                                <RefreshCw className="h-4 w-4" /> Refresh
                            </button>
                        </div>
                    )}
                    {usageError && (
                        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-warning sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                                <span>{usageError} The numbers below may be out of date.</span>
                            </p>
                            <button type="button" onClick={() => void retryUsage()} disabled={isRetryingUsage} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0')}>
                                <RefreshCw className={`h-4 w-4 ${isRetryingUsage ? 'animate-spin' : ''}`} /> Try again
                            </button>
                        </div>
                    )}

                    {showFirstRunOnboarding && usageStats && user?.id && (
                        <GettingStarted
                            userId={user.id}
                            isPluginConnected={isPluginConnected}
                            hasGeneratedFirstAltText={hasGeneratedFirstAltText}
                        />
                    )}

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <section id="activity" aria-labelledby="activity-heading" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-notebook">
                            <div className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div>
                                    <h2 id="activity-heading" className="font-lato text-xl font-semibold text-ink">Recent activity</h2>
                                    <p className="mt-1 text-sm text-ink-muted">
                                        Your latest generated alt text · <a href="#history" className="font-semibold text-ink underline underline-offset-2">View full history</a>
                                    </p>
                                </div>
                                <span className="inline-flex w-fit items-center rounded-full bg-yellow-soft px-3 py-1.5 text-xs font-semibold text-ink">
                                    {(usageStats?.total_processed || 0).toLocaleString()} images this billing cycle
                                </span>
                            </div>

                            <div className="hidden grid-cols-[72px_minmax(0,1fr)_130px_130px_48px] items-center gap-4 border-b border-line bg-yellow-tint px-6 py-3 label-caps md:grid">
                                <span>Image</span>
                                <span>Generated alt text / source</span>
                                <span>Status</span>
                                <span>Date</span>
                                <span className="sr-only">Actions</span>
                            </div>

                            <div aria-live="polite">
                                {isLoadingHistory ? (
                                    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                                        <RefreshCw className="h-7 w-7 animate-spin text-ink" />
                                        <p className="mt-4 text-sm font-semibold text-ink">Loading activity</p>
                                        <p className="mt-1 text-sm text-ink-muted">Fetching your latest generations.</p>
                                    </div>
                                ) : history.length > 0 ? (
                                    history.slice(0, 5).map((item, index) => (
                                        <article
                                            key={item.id || index}
                                            className="grid grid-cols-[56px_minmax(0,1fr)_40px] items-start gap-x-3 gap-y-2 border-b border-line px-5 py-4 last:border-b-0 hover:bg-yellow-tint md:grid-cols-[72px_minmax(0,1fr)_130px_130px_48px] md:items-center md:gap-4 md:px-6"
                                        >
                                            <div className="col-start-1 row-start-1 flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-yellow-soft md:col-auto md:row-auto">
                                                <ImageIcon className="h-6 w-6 text-ink" />
                                            </div>
                                            <div className="col-start-2 row-start-1 min-w-0 md:col-auto md:row-auto">
                                                <p className="line-clamp-2 text-sm font-semibold leading-6 text-ink">{item.alt}</p>
                                                <p className="mt-1 truncate text-xs text-ink-muted">{item.context || 'WordPress media'}</p>
                                            </div>
                                            <div className="col-start-2 row-start-2 md:col-auto md:row-auto">
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-success">
                                                    <CircleCheck className="h-3.5 w-3.5" />
                                                    Generated
                                                </span>
                                            </div>
                                            <time className="col-start-2 row-start-3 text-xs leading-5 text-ink-muted md:col-auto md:row-auto" dateTime={item.date}>
                                                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                <span className="ml-1 md:ml-0 md:block">{new Date(item.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                                            </time>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(item.alt);
                                                    toast.success("Copied to clipboard");
                                                }}
                                                className={cn(buttonVariants({ variant: 'secondary', size: 'icon-sm' }), 'col-start-3 row-start-1 md:col-auto md:row-auto')}
                                                aria-label="Copy generated alt text"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        </article>
                                    ))
                                ) : (
                                    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-soft">
                                            <ImageIcon className="h-6 w-6 text-ink" />
                                        </span>
                                        <p className="mt-4 text-sm font-semibold text-ink">No generations yet</p>
                                        <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">Upload one image below to create your first reviewable alt text draft.</p>
                                        <a href="#generate" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-5')}>
                                            Generate alt text <ArrowRight className="h-4 w-4" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </section>

                        <aside className="space-y-6" aria-label="Dashboard controls">
                            <section aria-labelledby="quick-actions-heading" className="rounded-2xl border border-line bg-white p-5 shadow-notebook">
                                <h2 id="quick-actions-heading" className="font-lato text-lg font-semibold text-ink">Quick actions</h2>
                                <div className="mt-4 divide-y divide-line">
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
                                                className="group -mx-2 flex min-h-[72px] items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-yellow-tint"
                                            >
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-yellow-tint group-hover:bg-yellow-soft">
                                                    <Icon className="h-5 w-5 text-ink" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-ink">{action.label}</span>
                                                    <span className="mt-0.5 block text-xs text-ink-muted">{action.help}</span>
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                                            </a>
                                        );
                                    })}
                                </div>
                            </section>

                            <section id="usage" aria-labelledby="usage-heading" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-notebook">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 id="usage-heading" className="font-lato text-lg font-semibold text-ink">Plan & usage</h2>
                                    <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-ink">{displayPlanLabel}</span>
                                </div>
                                <div className="mt-6 flex items-end justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-medium text-ink-muted">Credits used</p>
                                        <p className="mt-1 font-lato text-2xl font-semibold text-ink">{creditsUsed.toLocaleString()}</p>
                                    </div>
                                    <p className="text-sm text-ink-muted">of {creditUsageLimit.toLocaleString()}</p>
                                </div>
                                <progress
                                    className="operations-credit-progress mt-4 h-2 w-full overflow-hidden rounded-full bg-yellow-tint"
                                    value={creditUsagePercent}
                                    max={100}
                                    aria-label={`${creditUsagePercent.toFixed(0)} percent of available credits used`}
                                />
                                <p className="mt-3 text-xs leading-5 text-ink-muted">{creditCardDescription}</p>

                                <ul className="mt-5 space-y-3 border-t border-line pt-5 text-sm text-ink-muted">
                                    <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 shrink-0 text-ink" /> WordPress plugin included</li>
                                    <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 shrink-0 text-ink" /> One credit per successful image</li>
                                    <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 shrink-0 text-ink" /> Bonus and purchased credits persist</li>
                                </ul>

                                <div className="mt-6 grid gap-3">
                                    {currentPlan === 'free' && (
                                        <button type="button" onClick={openUpgradePlans} className={cn(buttonVariants(), 'w-full')}>
                                            Upgrade plan <ArrowRight className="h-4 w-4" />
                                        </button>
                                    )}
                                    {/* Shown to everyone: credit-pack buyers on Free need receipts too. */}
                                    <button type="button" onClick={openCustomerPortal} className={cn(buttonVariants({ variant: 'secondary' }), 'w-full')}>
                                        <CreditCard className="h-4 w-4" /> Billing &amp; receipts
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openCreditPacks}
                                        disabled={!isCreditPackEligible}
                                        title={!isCreditPackEligible ? 'Credit packs are unavailable for this account' : undefined}
                                        className={cn(buttonVariants({ variant: 'secondary' }), 'w-full disabled:cursor-not-allowed')}
                                    >
                                        Top up credits
                                    </button>
                                </div>
                            </section>
                        </aside>
                    </div>

                    <section id="generate" aria-labelledby="generate-heading" className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-notebook">
                        <div className="border-b border-line px-5 py-5 sm:px-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow">
                                    <Sparkles className="h-5 w-5 text-ink" />
                                </span>
                                <div>
                                    <h2 id="generate-heading" className="font-lato text-xl font-semibold text-ink">Generate alt text</h2>
                                    <p className="mt-1 text-sm text-ink-muted">Test one image before starting a WordPress bulk batch.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
                            <div>
                                <button
                                    type="button"
                                    className="flex min-h-[260px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-yellow-tint p-6 text-center transition-colors hover:border-yellow-strong hover:bg-yellow-soft/50"
                                    onClick={() => document.getElementById('operations-image-upload')?.click()}
                                >
                                    <input id="operations-image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                                    {testImage ? (
                                        <span className="relative block aspect-video w-full overflow-hidden rounded-xl">
                                            <NextImage src={testImage} alt="Selected image preview" fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                                        </span>
                                    ) : (
                                        <>
                                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow text-ink">
                                                <Upload className="h-6 w-6" />
                                            </span>
                                            <span className="mt-5 text-sm font-semibold text-ink">Choose an image</span>
                                            <span className="mt-1 text-xs text-ink-muted">PNG, JPG, WEBP, or GIF</span>
                                        </>
                                    )}
                                </button>
                                <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
                                    <div>
                                        <p className="text-xs font-semibold text-ink">Generation mode</p>
                                        <p className="mt-0.5 text-xs text-ink-muted">Reviewable AI draft</p>
                                    </div>
                                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-success">
                                        <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Ready
                                    </span>
                                </div>
                            </div>

                            <div className="flex min-h-[320px] flex-col">
                                <div className="flex flex-1 flex-col rounded-2xl border border-line bg-yellow-tint p-5 sm:p-6" aria-live="polite">
                                    {isGenerating ? (
                                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                                            <RefreshCw className="h-8 w-8 animate-spin text-ink" />
                                            <p className="mt-4 text-sm font-semibold text-ink">Analyzing image</p>
                                            <p className="mt-1 text-xs text-ink-muted">Creating a concise, reviewable description.</p>
                                        </div>
                                    ) : generatedAltText ? (
                                        <>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-success">
                                                    <CircleCheck className="h-3.5 w-3.5" /> Ready to review
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedAltText);
                                                        toast.success("Copied to clipboard");
                                                    }}
                                                    className={buttonVariants({ variant: 'secondary', size: 'icon-sm' })}
                                                    aria-label="Copy generated alt text"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <p className="mt-5 flex-1 rounded-xl bg-white p-4 text-sm font-medium leading-7 text-ink">{generatedAltText}</p>
                                        </>
                                    ) : (
                                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                                            <FileText className="h-8 w-8 text-ink-muted" />
                                            <p className="mt-4 text-sm font-semibold text-ink">Your generated alt text will appear here</p>
                                            <p className="mt-1 max-w-xs text-xs leading-5 text-ink-muted">Choose an image, then generate a draft you can review before using it.</p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={generateTestAltText}
                                    disabled={!testImage || isGenerating}
                                    className={cn(buttonVariants(), 'mt-4 w-full disabled:cursor-not-allowed')}
                                >
                                    <Sparkles className="h-4 w-4" />
                                    {isGenerating ? 'Generating alt text…' : 'Generate alt text'}
                                </button>
                            </div>
                        </div>
                    </section>

                    {user?.id && <GenerationHistory userId={user.id} refreshKey={historyRefreshKey} />}

                    <section id="settings" aria-labelledby="settings-heading" className="mt-6 scroll-mt-24 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                        <div className="rounded-2xl border border-line bg-white p-5 shadow-notebook sm:p-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow"><Key className="h-5 w-5 text-ink" /></span>
                                <div>
                                    <h2 id="settings-heading" className="font-lato text-xl font-semibold text-ink">API settings</h2>
                                    <p className="mt-1 text-sm text-ink-muted">Manage the key used by your WordPress plugin.</p>
                                </div>
                            </div>
                            <p className="mt-6 text-xs font-semibold text-ink-muted">Secret API key</p>
                            <div className="mt-2 flex overflow-hidden rounded-xl border border-line-strong bg-yellow-tint focus-within:border-yellow-strong">
                                <div className="min-w-0 flex-1 truncate px-4 py-3.5 font-mono text-xs text-ink" aria-label="Secret API key">
                                    {isLoadingApiKey ? 'Loading…' : apiKeyError ? 'Unavailable' : showApiKey ? apiKey : '••••••••••••••••••••••••••••••'}
                                </div>
                                <button type="button" onClick={() => setShowApiKey(!showApiKey)} disabled={!apiKey} className="flex w-12 items-center justify-center border-l border-line text-ink-muted hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40" aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
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
                                    className="flex w-12 items-center justify-center border-l border-line text-ink-muted hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Copy API key"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                            {apiKeyError && (
                                <p className="mt-3 text-xs leading-5 text-warning" role="status">
                                    {apiKeyError}
                                </p>
                            )}
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <button type="button" onClick={rotateApiKey} disabled={isLoadingApiKey || apiKeyErrorCode === 'api_key_encryption_not_configured'} className={buttonVariants({ variant: 'secondary' })}>
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
                                    className={buttonVariants()}
                                >
                                    <Download className="h-4 w-4" /> Download plugin v{PLUGIN_VERSION}
                                </a>
                            </div>
                            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-warning">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                Rotating the key disconnects the old key immediately. Update WordPress after rotating it.
                            </p>
                        </div>

                        <div className="flex flex-col rounded-2xl border border-line bg-yellow-soft p-5 text-ink shadow-notebook sm:p-6">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-ink"><HelpCircle className="h-5 w-5" /></span>
                            <h2 className="mt-5 font-lato text-xl font-semibold">Help & support</h2>
                            <p className="mt-2 text-sm leading-6 text-ink-muted">Find installation guidance or contact us if your WordPress connection needs attention.</p>
                            <div className="mt-auto grid gap-3 pt-6">
                                <Link href="/docs" className={cn(buttonVariants({ variant: 'secondary' }), 'justify-between')}>
                                    Documentation <Book className="h-4 w-4" />
                                </Link>
                                <Link href="/contact" className={cn(buttonVariants({ variant: 'secondary' }), 'justify-between')}>
                                    Contact support <MessageCircle className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </section>

                    <div className="mt-6">
                        <ConnectedSites />
                    </div>

                    {user?.email && (
                        <>
                            <AccountSettings email={user.email} canUsePassword={canUsePassword} />
                            <DeleteAccountCard email={user.email} onDeleted={handleAccountDeleted} />
                        </>
                    )}

                    <footer className="mt-8 flex flex-col gap-2 border-t border-line py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                        <p>Alt Text Pro v{PLUGIN_VERSION} · System status: active</p>
                        <p>© 2026 Alt Text Pro. Built for accessible publishing.</p>
                    </footer>

                </div>
            </main>
            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title" className="bg-white border border-line rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-notebook-lg flex flex-col">
                        {/* Modal Header */}
                        <div className="relative p-6 sm:p-8 border-b border-line shrink-0 bg-yellow-tint">
                            <button
                                type="button"
                                onClick={() => setShowUpgradeModal(false)}
                                aria-label="Close"
                                className={cn(buttonVariants({ variant: 'secondary', size: 'icon-sm' }), 'absolute top-4 right-4 sm:top-6 sm:right-6 z-10')}
                            >
                                <X className="h-5 w-5" />
                            </button>

                            <div className="relative max-w-2xl pr-12">
                                <div className="inline-flex items-center gap-2 bg-yellow-soft text-ink px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.06em] mb-4 border border-line">
                                    <Crown className="h-3.5 w-3.5" />
                                    <span>Plan Management</span>
                                </div>
                                <h2 id="upgrade-modal-title" className="text-3xl sm:text-4xl font-semibold text-ink mb-2 tracking-tight font-lato">
                                    {upgradeModalView === "credit-packs"
                                        ? <>Top up <span className="text-ink">credits</span></>
                                        : <>Choose a <span className="text-ink">Plan</span></>}
                                </h2>
                                <p className="text-ink-muted text-base sm:text-lg font-lato">
                                    {upgradeModalView === "credit-packs"
                                        ? "Choose a one-time pack to add credits to your account."
                                        : "Compare the available plans and credit allowances."}
                                </p>
                            </div>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="p-6 sm:p-8 overflow-y-auto bg-white">
                            {selectedUpgradePlan ? (
                                <div className="max-w-md mx-auto">
                                    <div className="bg-yellow-tint border border-line rounded-2xl p-6 sm:p-8 mb-6 text-center">
                                        <div className="w-16 h-16 bg-brand-yellow rounded-2xl flex items-center justify-center mx-auto mb-6">
                                            <Crown className="h-8 w-8 text-ink" />
                                        </div>
                                        <h3 className="text-2xl font-semibold text-ink mb-2 font-lato">
                                            {selectedUpgradePlan.name}{selectedUpgradeIsPack ? '' : ' Plan'}
                                        </h3>
                                        <div className="text-5xl font-semibold text-ink mb-8 font-lato">
                                            {selectedUpgradePlan.price}<span className="text-xl text-ink-muted font-normal font-lato">{selectedUpgradeIsPack ? ' one time' : selectedUpgradePlan.id.endsWith('_annual') ? '/yr' : '/mo'}</span>
                                        </div>
                                        <div className="space-y-4 text-left mb-8 pt-6 border-t border-line font-lato">
                                            {selectedUpgradeDetails?.features.map((feature) => (
                                                <div key={feature} className="flex items-center text-ink-muted">
                                                    <div className="w-5 h-5 rounded-full bg-yellow-soft flex items-center justify-center mr-3 shrink-0">
                                                        <Check className="h-3 w-3 text-ink" />
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
                                            className="w-full"
                                        >
                                            {selectedUpgradeIsPack ? 'Buy Credits' : 'Upgrade Now'}
                                            <ArrowRight />
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setSelectedUpgradePlan(null)}
                                            className="w-full mt-3"
                                        >
                                            Back to {upgradeModalView === "credit-packs" ? "Credit Packs" : "Plans"}
                                        </Button>
                                    </div>
                                    <div className="text-center text-xs text-ink-muted flex items-center justify-center gap-2">
                                        <Shield className="h-3.5 w-3.5" /> Encrypted Transaction via Polar.sh
                                    </div>
                                    <p className="text-center text-xs text-ink-muted">{PRICE_TAX_NOTE}</p>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    {upgradeModalView === "plans" && <div>
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                            <h3 className="text-lg font-semibold text-ink font-lato border-l-4 border-brand-yellow pl-4">Subscription Plans</h3>
                                            <div className="inline-flex rounded-xl border border-line bg-yellow-tint p-1" role="group" aria-label="Billing cycle">
                                                <button
                                                    type="button"
                                                    onClick={() => setUpgradeBillingCycle('monthly')}
                                                    aria-pressed={upgradeBillingCycle === 'monthly'}
                                                    className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition-colors ${upgradeBillingCycle === 'monthly' ? 'bg-brand-yellow text-ink' : 'text-ink-muted hover:bg-white hover:text-ink'}`}
                                                >
                                                    Monthly
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setUpgradeBillingCycle('annual')}
                                                    aria-pressed={upgradeBillingCycle === 'annual'}
                                                    className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition-colors ${upgradeBillingCycle === 'annual' ? 'bg-brand-yellow text-ink' : 'text-ink-muted hover:bg-white hover:text-ink'}`}
                                                >
                                                    Annual
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid md:grid-cols-3 gap-6">
                                            {SUBSCRIPTION_PLANS.filter((plan) => plan.id !== 'free').map((plan) => (
                                                <article
                                                    key={plan.id}
                                                    className={`relative flex h-full flex-col rounded-2xl p-6 transition-colors ${
                                                        plan.featured
                                                            ? 'border-2 border-brand-yellow bg-yellow-tint'
                                                            : 'border border-line bg-white hover:border-line-strong'
                                                    }`}
                                                >
                                                    {plan.featured && (
                                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold uppercase tracking-[0.06em] text-ink">
                                                            Most popular
                                                        </div>
                                                    )}
                                                    <h4 className="text-lg font-semibold text-ink font-lato">{plan.name}</h4>
                                                    <div className="mt-3 mb-6">
                                                        <span className="text-4xl font-semibold text-ink font-lato">{upgradeBillingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice}</span>
                                                        <span className="text-ink-muted font-normal ml-1 font-lato">/{upgradeBillingCycle === 'annual' ? 'yr' : 'mo'}</span>
                                                        {upgradeBillingCycle === 'annual' && (
                                                            <p className="mt-2 text-xs text-ink-muted">Equivalent to {plan.annualMonthlyPrice}/mo</p>
                                                        )}
                                                    </div>
                                                    <ul className="space-y-3 mb-8 flex-1 font-lato">
                                                        <li className="flex items-start text-sm text-ink-muted">
                                                            <div className="w-5 h-5 rounded-full bg-yellow-soft flex items-center justify-center mr-3 mt-0.5 shrink-0">
                                                                <Check className="h-3 w-3 text-ink" aria-hidden="true" />
                                                            </div>
                                                            <span>{plan.creditCount.toLocaleString()} credits every month</span>
                                                        </li>
                                                        {plan.features.map((feature) => (
                                                            <li key={feature} className="flex items-start text-sm text-ink-muted">
                                                                <div className="w-5 h-5 rounded-full bg-yellow-soft flex items-center justify-center mr-3 mt-0.5 shrink-0">
                                                                    <Check className="h-3 w-3 text-ink" aria-hidden="true" />
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
                                                        variant={plan.featured ? 'default' : 'secondary'}
                                                        className="w-full"
                                                    >
                                                        Select Plan
                                                    </Button>
                                                </article>
                                            ))}
                                        </div>
                                    </div>}

                                    <div>
                                        <h3 className="text-lg font-semibold text-ink mb-2 font-lato border-l-4 border-brand-yellow pl-4">Credits (One-Time)</h3>
                                        <p className="text-sm text-ink-muted mb-6 pl-5">Available on every plan, including Free. Pack credits never expire and are used after your monthly allowance.</p>
                                        <div className="grid md:grid-cols-3 gap-6">
                                            {CREDIT_PACKS.map((pack) => (
                                                <article
                                                    key={pack.id}
                                                    className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition-colors hover:border-line-strong"
                                                >
                                                    <h4 className="text-lg font-semibold text-ink font-lato">{pack.name}</h4>
                                                    <div className="mt-3 mb-6">
                                                        <span className="text-4xl font-semibold text-ink font-lato">{pack.price}</span>
                                                        <span className="text-ink-muted font-normal ml-2 font-lato text-sm">one-time purchase</span>
                                                    </div>
                                                    <ul className="space-y-3 mb-8 flex-1 font-lato">
                                                        {pack.features.map((feature) => (
                                                            <li key={feature} className="flex items-start text-sm text-ink-muted">
                                                                <div className="w-5 h-5 rounded-full bg-yellow-soft flex items-center justify-center mr-3 mt-0.5 shrink-0">
                                                                    <Check className="h-3 w-3 text-ink" aria-hidden="true" />
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
                                                        variant="secondary"
                                                        className="w-full disabled:cursor-not-allowed"
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
