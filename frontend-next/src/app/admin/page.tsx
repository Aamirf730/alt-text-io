"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, supabase } from '@/lib/supabase';
import { getApiBase } from '@/lib/utils';
import { toast } from "sonner";
import { Activity, BarChart3, Mail, Plug, RefreshCw, Search, TrendingDown, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Admin Dashboard Component
export default function AdminDashboard() {
    const [user, setUser] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [funnelReport, setFunnelReport] = useState<any>(null);
    const [lifecycleReport, setLifecycleReport] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingFunnel, setIsLoadingFunnel] = useState(false);
    const [isLoadingLifecycle, setIsLoadingLifecycle] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPlan, setFilterPlan] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [funnelDays, setFunnelDays] = useState("7");
    const [lifecycleDays, setLifecycleDays] = useState("30");
    const [lifecycleFilter, setLifecycleFilter] = useState("all");
    const [lifecycleActionKey, setLifecycleActionKey] = useState("");
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const router = useRouter();

    const loadUsers = useCallback(async (token: string) => {
        try {
            const apiBase = getApiBase();

            const response = await fetch(`${apiBase}/admin-get-users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 403) {
                toast.error("Access denied. Superuser privileges required.");
                setUser(null);
                router.replace("/");
                return;
            }

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const result = await response.json();
            if (result.success && result.data) {
                setUsers(result.data.users || []);
                setStats(result.data.stats || null);
            } else {
                throw new Error('Invalid API response format');
            }
        } catch (error) {
            console.error("Error loading users:", error);
            toast.error("Failed to load users. Please try again.");
        }
    }, [router]);

    // Only the newest request may update a report, so switching the day range
    // quickly cannot let an older, slower response overwrite the current one.
    const funnelRequestRef = useRef(0);
    const lifecycleRequestRef = useRef(0);

    const loadFunnel = useCallback(async (token: string, days: string) => {
        const requestId = ++funnelRequestRef.current;
        try {
            setIsLoadingFunnel(true);
            const apiBase = getApiBase();

            const response = await fetch(`${apiBase}/admin-marketing-funnel?days=${encodeURIComponent(days)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 403) {
                toast.error("Access denied. Superuser privileges required.");
                setUser(null);
                router.replace("/");
                return;
            }

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const result = await response.json();
            if (requestId !== funnelRequestRef.current) return;
            if (result.success && result.data) {
                setFunnelReport(result.data);
            } else {
                throw new Error('Invalid funnel response format');
            }
        } catch (error) {
            console.error("Error loading funnel report:", error);
            toast.error("Failed to load funnel report.");
        } finally {
            if (requestId === funnelRequestRef.current) setIsLoadingFunnel(false);
        }
    }, [router]);

    const loadLifecycle = useCallback(async (token: string, days: string) => {
        const requestId = ++lifecycleRequestRef.current;
        try {
            setIsLoadingLifecycle(true);
            const apiBase = getApiBase();

            const response = await fetch(`${apiBase}/admin-lifecycle-status?days=${encodeURIComponent(days)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 403) {
                toast.error("Access denied. Superuser privileges required.");
                setUser(null);
                router.replace("/");
                return;
            }

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const result = await response.json();
            if (requestId !== lifecycleRequestRef.current) return;
            if (result.success && result.data) {
                setLifecycleReport(result.data);
            } else {
                throw new Error('Invalid lifecycle response format');
            }
        } catch (error) {
            console.error("Error loading lifecycle report:", error);
            toast.error("Failed to load lifecycle report.");
        } finally {
            if (requestId === lifecycleRequestRef.current) setIsLoadingLifecycle(false);
        }
    }, [router]);

    useEffect(() => {
        const checkAuthAndLoadData = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    toast.error("Please sign in to access the admin dashboard");
                    router.replace("/");
                    return;
                }

                setUser({
                    email: session.user.email,
                    id: session.user.id,
                    token: session.access_token
                });

                await Promise.all([
                    loadUsers(session.access_token),
                    loadFunnel(session.access_token, "7"),
                    loadLifecycle(session.access_token, "30"),
                ]);
            } catch (error) {
                console.error("Error checking auth:", error);
                toast.error("Authentication error");
                router.replace("/");
            } finally {
                setIsLoading(false);
            }
        };

        checkAuthAndLoadData();
    }, [router, loadUsers, loadFunnel, loadLifecycle]);

    // The token captured on load expires after an hour; fetch a current one
    // for every request so a long-open admin page keeps working.
    const requireAccessToken = async (): Promise<string | null> => {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            toast.error("Your session expired. Please sign in again.");
            router.replace("/");
        }
        return accessToken;
    };

    const handleRefresh = async () => {
        const accessToken = await requireAccessToken();
        if (!accessToken) return;

        setIsLoading(true);
        await Promise.all([
            loadUsers(accessToken),
            loadFunnel(accessToken, funnelDays),
            loadLifecycle(accessToken, lifecycleDays),
        ]);
        setIsLoading(false);
        toast.success("Admin data refreshed");
    };

    const handleFunnelDaysChange = async (days: string) => {
        setFunnelDays(days);
        const accessToken = await requireAccessToken();
        if (accessToken) {
            await loadFunnel(accessToken, days);
        }
    };

    const handleLifecycleDaysChange = async (days: string) => {
        setLifecycleDays(days);
        const accessToken = await requireAccessToken();
        if (accessToken) {
            await loadLifecycle(accessToken, days);
        }
    };

    const reloadFunnel = async () => {
        const accessToken = await requireAccessToken();
        if (accessToken) await loadFunnel(accessToken, funnelDays);
    };

    const reloadLifecycle = async () => {
        const accessToken = await requireAccessToken();
        if (accessToken) await loadLifecycle(accessToken, lifecycleDays);
    };

    const getLifecycleRuleForStatus = (status: string) => {
        if (status === "Needs plugin reminder") return "signup_no_connect";
        if (status === "Needs first generation reminder") return "connect_no_first_image";
        if (status === "Low credits") return "credits_low_no_purchase";
        if (status === "Checkout recovery") return "checkout_no_purchase";
        return null;
    };

    const runLifecycleTestSend = async (row: any, dryRun: boolean) => {
        const automationKey = getLifecycleRuleForStatus(row.follow_up_status);
        if (!automationKey) {
            toast.error("This row is not eligible for a lifecycle test email.");
            return;
        }

        if (!dryRun && !window.confirm(`Send a real "${row.follow_up_status}" email to ${row.email}? This uses their one-time send for this rule.`)) {
            return;
        }

        const accessToken = await requireAccessToken();
        if (!accessToken) return;

        const actionKey = `${row.user_id}:${automationKey}:${dryRun ? "dry" : "send"}`;
        setLifecycleActionKey(actionKey);

        try {
            const apiBase = getApiBase();
            const response = await fetch(`${apiBase}/admin-lifecycle-test-send`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: row.email,
                    automation_key: automationKey,
                    dry_run: dryRun,
                }),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(result.reason || result.error || `API returned status ${response.status}`);
            }

            if (dryRun) {
                toast.success(`Dry-run matched ${result.candidate?.automation_key || automationKey}`);
            } else {
                toast.success(`Test email sent to ${row.email}`);
                await loadLifecycle(accessToken, lifecycleDays);
            }
        } catch (error: any) {
            console.error("Lifecycle test send failed:", error);
            toast.error(error?.message || "Lifecycle test send failed.");
        } finally {
            setLifecycleActionKey("");
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.id?.toLowerCase().includes(searchTerm.toLowerCase());
        // Older accounts may store the plan under its pre-tier name.
        const planAliases: Record<string, string> = { lite: "tier1", standard: "tier2", pro: "tier3", agency: "tier4" };
        const normalizedPlan = planAliases[user.subscription_plan] || user.subscription_plan;
        const matchesPlan = filterPlan === "all" || normalizedPlan === filterPlan;
        const matchesStatus = filterStatus === "all" || user.subscription_status === filterStatus;
        return matchesSearch && matchesPlan && matchesStatus;
    });

    const filteredLifecycleUsers = (lifecycleReport?.users || []).filter((row: any) => {
        const matchesSearch =
            row.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.user_id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = lifecycleFilter === "all" || row.follow_up_status === lifecycleFilter;
        return matchesSearch && matchesStatus;
    });

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(amount || 0);
    };

    const formatNumber = (value: number | null | undefined) => {
        return new Intl.NumberFormat("en-US").format(value || 0);
    };

    const formatPercent = (value: number | null | undefined) => {
        if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
        return `${Math.round(value * 1000) / 10}%`;
    };

    const purchaseStage = funnelReport?.stages?.find((stage: any) => stage.key === "purchase_completed");
    const visitorStage = funnelReport?.stages?.find((stage: any) => stage.key === "page_viewed");

    if (isLoading || !user) {
        return (
            <main className="min-h-screen bg-yellow-tint flex items-center justify-center" aria-busy="true">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-line-strong mx-auto mb-4"></div>
                    <p className="text-ink-muted">Checking admin access...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-yellow-tint">
            {/* Header */}
            <div className="bg-white border-b border-line">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-ink">Admin Dashboard</h1>
                            <p className="text-ink-muted mt-1">Manage users, credits, and subscriptions</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleRefresh}
                                variant="secondary"
                            >
                                <RefreshCw />
                                Refresh
                            </Button>
                            <Button
                                onClick={async () => {
                                    await supabase.auth.signOut();
                                    router.push("/");
                                    toast.success("Signed out");
                                }}
                                variant="ghost"
                            >
                                Sign Out
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Tabs defaultValue="users" className="space-y-6">
                    <TabsList className="max-w-full overflow-x-auto">
                        <TabsTrigger value="users" className="gap-2 px-4">
                            <Users className="h-4 w-4" />
                            Users
                        </TabsTrigger>
                        <TabsTrigger value="funnel" className="gap-2 px-4">
                            <BarChart3 className="h-4 w-4" />
                            Funnel
                        </TabsTrigger>
                        <TabsTrigger value="lifecycle" className="gap-2 px-4">
                            <Mail className="h-4 w-4" />
                            Lifecycle
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="users" className="space-y-6">
                {/* Statistics Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Total Users</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{users.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Revenue (net of tax and refunds)</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{formatCurrency(stats.total_revenue)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Paying Subscribers</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{stats.active_users}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Total Credits Used</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{stats.total_credits_used.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Filters */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium text-ink mb-2 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink-muted" />
                                    <Input
                                        type="text"
                                        placeholder="Search by email or ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-ink mb-2 block">Plan</label>
                                <select
                                    value={filterPlan}
                                    onChange={(e) => setFilterPlan(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:border-yellow-strong"
                                >
                                    <option value="all">All Plans</option>
                                    <option value="free">Free</option>
                                    <option value="tier1">Tier 1 (Starter / legacy Lite)</option>
                                    <option value="tier2">Tier 2 (Growth / legacy Standard)</option>
                                    <option value="tier3">Tier 3 (legacy Pro)</option>
                                    <option value="tier4">Tier 4 (Agency)</option>
                                    <option value="pay_as_go">Pay as You Go</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-ink mb-2 block">Status</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:border-yellow-strong"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="expired">Expired</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Users Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Users ({filteredUsers.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-line bg-yellow-tint">
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Email</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Plan</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Status</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Plugin Ver.</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Credits</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Processed</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Total Paid</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Created</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-8 text-ink-muted">
                                                No users found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((userData) => (
                                            <tr key={userData.id} className="border-b border-line hover:bg-yellow-tint">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-ink">{userData.email}</div>
                                                    <div className="text-xs text-ink-muted font-mono">{userData.id.substring(0, 8)}...</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge>
                                                        {userData.subscription_plan || "free"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        className={
                                                            userData.subscription_status === "active"
                                                                ? "border-green-200 bg-green-50 text-success"
                                                                : userData.subscription_status === "cancelled"
                                                                    ? "border-red-200 bg-red-50 text-error"
                                                                    : "border-line bg-yellow-tint text-ink"
                                                        }
                                                    >
                                                        {userData.subscription_status || "active"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-ink">
                                                        {userData.latest_plugin_version ? `v${userData.latest_plugin_version}` : "--"}
                                                    </div>
                                                    <div className="text-xs text-ink-muted">
                                                        {userData.plugin_connected_at ? formatDate(userData.plugin_connected_at) : "Not tracked yet"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{userData.credits_remaining || 0}</div>
                                                    <div className="text-xs text-ink-muted">
                                                        Used: {userData.total_credits_used || 0}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{userData.total_processed || 0}</div>
                                                    <div className="text-xs text-ink-muted">
                                                        Logs: {userData.total_usage_count || 0}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-ink">
                                                        {formatCurrency(userData.total_paid || 0)}
                                                    </div>
                                                    <div className="text-xs text-ink-muted">
                                                        {userData.payment_count || 0} payment(s)
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-ink-muted">
                                                    {formatDate(userData.created_at)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => setSelectedUser(userData)}
                                                    >
                                                        View Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
                    </TabsContent>

                    <TabsContent value="funnel" className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-ink">Marketing Funnel</h2>
                                <p className="text-sm text-ink-muted">
                                    Tracks the path from visitor activity to purchase and plugin usage.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={funnelDays}
                                    onChange={(event) => handleFunnelDaysChange(event.target.value)}
                                    className="h-11 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:border-yellow-strong"
                                >
                                    <option value="1">Last 24 hours</option>
                                    <option value="7">Last 7 days</option>
                                    <option value="14">Last 14 days</option>
                                    <option value="30">Last 30 days</option>
                                    <option value="90">Last 90 days</option>
                                </select>
                                <Button
                                    onClick={() => void reloadFunnel()}
                                    variant="secondary"
                                    disabled={isLoadingFunnel}
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoadingFunnel ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Events</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-ink">
                                        {formatNumber(funnelReport?.totals?.events)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Unique Actors</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-ink">
                                        {formatNumber(funnelReport?.totals?.unique_actors)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Purchases</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-ink">
                                        {formatNumber(purchaseStage?.unique_actors)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Visitor to Purchase</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-ink">
                                        {visitorStage?.unique_actors ? formatPercent(purchaseStage?.unique_actors / visitorStage.unique_actors) : "N/A"}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-ink" />
                                    Funnel Stages
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-line bg-yellow-tint">
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Stage</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Actors</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Events</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">From Previous</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">From Start</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(funnelReport?.stages || []).map((stage: any) => (
                                                <tr key={stage.key} className="border-b border-line hover:bg-yellow-tint">
                                                    <td className="py-3 px-4 font-medium text-ink">{stage.label}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(stage.unique_actors)}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(stage.events)}</td>
                                                    <td className="py-3 px-4 text-right">{formatPercent(stage.conversion_from_previous)}</td>
                                                    <td className="py-3 px-4 text-right">{formatPercent(stage.conversion_from_start)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingDown className="h-5 w-5 text-error" />
                                        Dropoffs
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(funnelReport?.dropoffs || []).map((dropoff: any) => (
                                        <div key={dropoff.key} className="rounded-xl border border-line p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="font-medium text-ink">{dropoff.label}</div>
                                                <Badge className="border-red-200 bg-red-50 text-error">{formatNumber(dropoff.count)}</Badge>
                                            </div>
                                            {dropoff.sample?.length > 0 && (
                                                <div className="mt-3 space-y-1">
                                                    {dropoff.sample.slice(0, 3).map((actor: any, index: number) => (
                                                        <div key={`${dropoff.key}-${index}`} className="text-xs text-ink-muted">
                                                            {actor.email || actor.user_id || actor.anonymous_id || "Unknown actor"} · {formatDate(actor.last_seen_at)}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Top Sources</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <div className="text-sm font-semibold text-ink mb-2">Sources</div>
                                        <div className="space-y-2">
                                            {(funnelReport?.top_sources || []).map((source: any) => (
                                                <div key={source.label} className="flex justify-between text-sm">
                                                    <span className="text-ink-muted">{source.label}</span>
                                                    <span className="font-medium">{formatNumber(source.count)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-ink mb-2">Pages</div>
                                        <div className="space-y-2">
                                            {(funnelReport?.top_pages || []).map((page: any) => (
                                                <div key={page.label} className="flex justify-between gap-4 text-sm">
                                                    <span className="truncate text-ink-muted">{page.label}</span>
                                                    <span className="font-medium">{formatNumber(page.count)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Daily Event Counts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-line bg-yellow-tint">
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Date</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Events</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Actors</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Visitors</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Demos</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Signups</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Purchases</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(funnelReport?.daily_series || []).map((day: any) => (
                                                <tr key={day.date} className="border-b border-line hover:bg-yellow-tint">
                                                    <td className="py-3 px-4 font-medium text-ink">{day.date}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(day.total_events)}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(day.unique_actors)}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(day.events?.page_viewed)}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(day.events?.demo_used)}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(day.events?.signup_created)}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(day.events?.purchase_completed)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="lifecycle" className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-ink">Lifecycle Visibility</h2>
                                <p className="text-sm text-ink-muted">
                                    Per-user setup status, plugin connection, first generation, credits, and follow-up history.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={lifecycleDays}
                                    onChange={(event) => handleLifecycleDaysChange(event.target.value)}
                                    className="h-11 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:border-yellow-strong"
                                >
                                    <option value="7">Last 7 days</option>
                                    <option value="30">Last 30 days</option>
                                    <option value="60">Last 60 days</option>
                                    <option value="90">Last 90 days</option>
                                    <option value="180">Last 180 days</option>
                                </select>
                                <select
                                    value={lifecycleFilter}
                                    onChange={(event) => setLifecycleFilter(event.target.value)}
                                    className="h-11 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:border-yellow-strong"
                                >
                                    <option value="all">All follow-up statuses</option>
                                    <option value="Needs plugin reminder">Needs plugin reminder</option>
                                    <option value="Needs first generation reminder">Needs first generation reminder</option>
                                    <option value="Low credits">Low credits</option>
                                    <option value="Checkout recovery">Checkout recovery</option>
                                    <option value="Active">Active</option>
                                </select>
                                <Button
                                    onClick={() => void reloadLifecycle()}
                                    variant="secondary"
                                    disabled={isLoadingLifecycle}
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoadingLifecycle ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Users</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-ink">
                                        {formatNumber(lifecycleReport?.summary?.total_users)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Plugin Connected</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-ink">
                                        {formatNumber(lifecycleReport?.summary?.plugin_connected)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">First Generation</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-ink">
                                        {formatNumber(lifecycleReport?.summary?.first_generation)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Needs Follow-up</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-3xl font-bold text-warning">
                                        {formatNumber(
                                            (lifecycleReport?.summary?.needs_plugin_reminder || 0) +
                                            (lifecycleReport?.summary?.needs_first_generation_reminder || 0) +
                                            (lifecycleReport?.summary?.low_credits || 0) +
                                            (lifecycleReport?.summary?.checkout_recovery || 0)
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Need Plugin Reminder</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-2xl font-bold text-warning">
                                        {formatNumber(lifecycleReport?.summary?.needs_plugin_reminder)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Need First Generation</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-2xl font-bold text-warning">
                                        {formatNumber(lifecycleReport?.summary?.needs_first_generation_reminder)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Low Credits</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-2xl font-bold text-error">
                                        {formatNumber(lifecycleReport?.summary?.low_credits)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-ink-muted">Checkout Recovery</CardTitle>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="text-2xl font-bold text-warning">
                                        {formatNumber(lifecycleReport?.summary?.checkout_recovery)}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Plug className="h-5 w-5 text-ink" />
                                    User Lifecycle Status ({filteredLifecycleUsers.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-line bg-yellow-tint">
                                                <th className="text-left py-3 px-4 font-semibold text-ink">User</th>
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Plan</th>
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Plugin</th>
                                                <th className="text-left py-3 px-4 font-semibold text-ink">First Generation</th>
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Credits</th>
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Follow-up Status</th>
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Latest Email</th>
                                                <th className="text-left py-3 px-4 font-semibold text-ink">Test</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredLifecycleUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="text-center py-8 text-ink-muted">
                                                        No lifecycle users found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredLifecycleUsers.map((row: any) => (
                                                    <tr key={row.user_id} className="border-b border-line hover:bg-yellow-tint align-top">
                                                        <td className="py-3 px-4">
                                                            <div className="font-medium text-ink">{row.email}</div>
                                                            <div className="text-xs text-ink-muted font-mono">{row.user_id?.substring(0, 8)}...</div>
                                                            <div className="text-xs text-ink-muted">Signup: {formatDate(row.signup_at)}</div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <Badge>{row.plan}</Badge>
                                                            <div className="text-xs text-ink-muted mt-1">{row.status}</div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {row.plugin_connected_at ? (
                                                                <>
                                                                    <Badge className="border-green-200 bg-green-50 text-success">Connected</Badge>
                                                                    <div className="text-xs text-ink-muted mt-1">{formatDate(row.plugin_connected_at)}</div>
                                                                    <div className="text-xs text-ink-muted">{row.plugin_connection_source}</div>
                                                                    {row.plugin_version && (
                                                                        <div className="text-xs font-medium text-ink mt-1">v{row.plugin_version}</div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Badge className="border-amber-200 bg-amber-50 text-warning">Not connected</Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {row.first_generation_at ? (
                                                                <>
                                                                    <Badge className="border-green-200 bg-green-50 text-success">Generated</Badge>
                                                                    <div className="text-xs text-ink-muted mt-1">{formatDate(row.first_generation_at)}</div>
                                                                    <div className="text-xs text-ink-muted">Used: {formatNumber(row.total_credits_used)} credits</div>
                                                                </>
                                                            ) : (
                                                                <Badge variant="secondary">No generation</Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="font-semibold">{formatNumber(row.credits_remaining)}</div>
                                                            <div className="text-xs text-ink-muted">Processed: {formatNumber(row.total_processed)}</div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <Badge
                                                                className={
                                                                    row.follow_up_status === "Active"
                                                                        ? "border-green-200 bg-green-50 text-success"
                                                                        : row.follow_up_status === "Low credits"
                                                                            ? "border-red-200 bg-red-50 text-error"
                                                                            : "border-amber-200 bg-amber-50 text-warning"
                                                                }
                                                            >
                                                                {row.follow_up_status}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {row.latest_follow_up ? (
                                                                <div className="text-sm">
                                                                    <div className="font-medium text-ink">{row.latest_follow_up.automation_key}</div>
                                                                    <div className="text-xs text-ink-muted">
                                                                        {row.latest_follow_up.status} · {formatDate(row.latest_follow_up.sent_at || row.latest_follow_up.created_at)}
                                                                    </div>
                                                                    <div className="text-xs text-ink-muted">
                                                                        Sent: {formatNumber(row.follow_ups_sent)} · Failed: {formatNumber(row.follow_ups_failed)}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-ink-muted">No email sent</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {getLifecycleRuleForStatus(row.follow_up_status) ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        disabled={Boolean(lifecycleActionKey)}
                                                                        onClick={() => runLifecycleTestSend(row, true)}
                                                                    >
                                                                        {lifecycleActionKey === `${row.user_id}:${getLifecycleRuleForStatus(row.follow_up_status)}:dry`
                                                                            ? "Checking..."
                                                                            : "Dry Run"}
                                                                    </Button>
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        disabled={Boolean(lifecycleActionKey)}
                                                                        onClick={() => runLifecycleTestSend(row, false)}
                                                                    >
                                                                        {lifecycleActionKey === `${row.user_id}:${getLifecycleRuleForStatus(row.follow_up_status)}:send`
                                                                            ? "Sending..."
                                                                            : "Send Test"}
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-ink-muted">Not eligible</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="User details">
                    <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white shadow-notebook-lg">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>User Details</CardTitle>
                                <Button
                                    variant="secondary"
                                    size="icon-sm"
                                    aria-label="Close"
                                    onClick={() => setSelectedUser(null)}
                                >
                                    <X />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-ink">Email</label>
                                <p className="text-ink">{selectedUser.email}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-ink">User ID</label>
                                <p className="text-ink font-mono text-sm">{selectedUser.id}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-ink">Subscription Plan</label>
                                    <p className="text-ink">
                                        <Badge>
                                            {selectedUser.subscription_plan || "free"}
                                        </Badge>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-ink">Subscription Status</label>
                                    <p className="text-ink">
                                        <Badge
                                            className={
                                                selectedUser.subscription_status === "active"
                                                    ? "border-green-200 bg-green-50 text-success"
                                                    : "border-red-200 bg-red-50 text-error"
                                            }
                                        >
                                            {selectedUser.subscription_status || "active"}
                                        </Badge>
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-ink">Credits Remaining</label>
                                    <p className="text-2xl font-bold text-ink">{selectedUser.credits_remaining || 0}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-ink">Total Processed</label>
                                    <p className="text-2xl font-bold text-ink">{selectedUser.total_processed || 0}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-ink">Total Credits Used</label>
                                    <p className="text-ink">{selectedUser.total_credits_used || 0}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-ink">Total Usage Count</label>
                                    <p className="text-ink">{selectedUser.total_usage_count || 0}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-ink">Last Seen Plugin Version</label>
                                    <p className="text-ink">{selectedUser.latest_plugin_version ? `v${selectedUser.latest_plugin_version}` : "Not tracked yet"}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-ink">Plugin Connected</label>
                                    <p className="text-ink">
                                        {selectedUser.plugin_connected_at
                                            ? `${formatDate(selectedUser.plugin_connected_at)}${selectedUser.plugin_connection_source ? ` (${selectedUser.plugin_connection_source})` : ""}`
                                            : "Not tracked yet"}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-ink">Total Paid</label>
                                <p className="text-2xl font-bold text-ink">
                                    {formatCurrency(selectedUser.total_paid || 0)}
                                </p>
                                <p className="text-sm text-ink-muted">
                                    {selectedUser.payment_count || 0} payment(s)
                                </p>
                            </div>
                            {selectedUser.latest_payment && (
                                <div>
                                    <label className="text-sm font-medium text-ink">Latest Payment</label>
                                    <div className="bg-yellow-tint border border-line p-4 rounded-xl">
                                        <p className="text-sm">
                                            <span className="font-semibold">Amount:</span> {formatCurrency(selectedUser.latest_payment.amount)}
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-semibold">Status:</span> {selectedUser.latest_payment.status}
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-semibold">Plan:</span> {selectedUser.latest_payment.plan_id}
                                        </p>
                                        {selectedUser.latest_payment.product_name && (
                                            <p className="text-sm">
                                                <span className="font-semibold">Product:</span> {selectedUser.latest_payment.product_name}
                                            </p>
                                        )}
                                        {selectedUser.latest_payment.discount_code && (
                                            <p className="text-sm">
                                                <span className="font-semibold">Coupon:</span> {selectedUser.latest_payment.discount_code}
                                                {selectedUser.latest_payment.discount_name ? ` (${selectedUser.latest_payment.discount_name})` : ""}
                                                {selectedUser.latest_payment.discount_amount ? ` - ${formatCurrency(selectedUser.latest_payment.discount_amount)}` : ""}
                                            </p>
                                        )}
                                        <p className="text-sm">
                                            <span className="font-semibold">Date:</span> {formatDate(selectedUser.latest_payment.created_at)}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-ink">Created At</label>
                                    <p className="text-ink">{formatDate(selectedUser.created_at)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-ink">Updated At</label>
                                    <p className="text-ink">{formatDate(selectedUser.updated_at)}</p>
                                </div>
                            </div>
                            {selectedUser.next_billing_date && (
                                <div>
                                    <label className="text-sm font-medium text-ink">Next Billing Date</label>
                                    <p className="text-ink">{formatDate(selectedUser.next_billing_date)}</p>
                                </div>
                            )}
                            {selectedUser.expires_at && (
                                <div>
                                    <label className="text-sm font-medium text-ink">Expires At</label>
                                    <p className="text-ink">{formatDate(selectedUser.expires_at)}</p>
                                </div>
                            )}
                            {selectedUser.subscription_id && (
                                <div>
                                    <label className="text-sm font-medium text-ink">Subscription ID</label>
                                    <p className="text-ink font-mono text-sm">{selectedUser.subscription_id}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </main>
    );
}
