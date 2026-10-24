"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase';
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

    const loadFunnel = useCallback(async (token: string, days: string) => {
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
            if (result.success && result.data) {
                setFunnelReport(result.data);
            } else {
                throw new Error('Invalid funnel response format');
            }
        } catch (error) {
            console.error("Error loading funnel report:", error);
            toast.error("Failed to load funnel report.");
        } finally {
            setIsLoadingFunnel(false);
        }
    }, [router]);

    const loadLifecycle = useCallback(async (token: string, days: string) => {
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
            if (result.success && result.data) {
                setLifecycleReport(result.data);
            } else {
                throw new Error('Invalid lifecycle response format');
            }
        } catch (error) {
            console.error("Error loading lifecycle report:", error);
            toast.error("Failed to load lifecycle report.");
        } finally {
            setIsLoadingLifecycle(false);
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

    const handleRefresh = async () => {
        if (user?.token) {
            setIsLoading(true);
            await Promise.all([
                loadUsers(user.token),
                loadFunnel(user.token, funnelDays),
                loadLifecycle(user.token, lifecycleDays),
            ]);
            setIsLoading(false);
            toast.success("Admin data refreshed");
        }
    };

    const handleFunnelDaysChange = async (days: string) => {
        setFunnelDays(days);
        if (user?.token) {
            await loadFunnel(user.token, days);
        }
    };

    const handleLifecycleDaysChange = async (days: string) => {
        setLifecycleDays(days);
        if (user?.token) {
            await loadLifecycle(user.token, days);
        }
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
        if (!user?.token || !automationKey) {
            toast.error("This row is not eligible for a lifecycle test email.");
            return;
        }

        const actionKey = `${row.user_id}:${automationKey}:${dryRun ? "dry" : "send"}`;
        setLifecycleActionKey(actionKey);

        try {
            const apiBase = getApiBase();
            const response = await fetch(`${apiBase}/admin-lifecycle-test-send`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${user.token}`,
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
                await loadLifecycle(user.token, lifecycleDays);
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
        const matchesPlan = filterPlan === "all" || user.subscription_plan === filterPlan;
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
            <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center" aria-busy="true">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Checking admin access...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                            <p className="text-gray-600 mt-1">Manage users, credits, and subscriptions</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Button
                                onClick={handleRefresh}
                                variant="outline"
                                className="flex items-center space-x-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span>Refresh</span>
                            </Button>
                            <Button
                                onClick={async () => {
                                    await supabase.auth.signOut();
                                    router.push("/");
                                    toast.success("Signed out");
                                }}
                                variant="outline"
                            >
                                Sign Out
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Tabs defaultValue="users" className="space-y-6">
                    <TabsList className="bg-white border border-gray-200">
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
                                <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">{users.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-600">{formatCurrency(stats.total_revenue)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-[#000000]">{stats.active_users}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">Total Credits Used</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-purple-600">{stats.total_credits_used.toLocaleString()}</div>
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
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Plan</label>
                                <select
                                    value={filterPlan}
                                    onChange={(e) => setFilterPlan(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Plugin Ver.</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Credits</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Processed</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Paid</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-8 text-gray-500">
                                                No users found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((userData) => (
                                            <tr key={userData.id} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-gray-900">{userData.email}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{userData.id.substring(0, 8)}...</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge className="bg-purple-100 text-purple-700">
                                                        {userData.subscription_plan || "free"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        className={
                                                            userData.subscription_status === "active"
                                                                ? "bg-green-100 text-green-700"
                                                                : userData.subscription_status === "cancelled"
                                                                    ? "bg-red-100 text-red-700"
                                                                    : "bg-teal-100 text-teal-700"
                                                        }
                                                    >
                                                        {userData.subscription_status || "active"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-gray-900">
                                                        {userData.latest_plugin_version ? `v${userData.latest_plugin_version}` : "--"}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {userData.plugin_connected_at ? formatDate(userData.plugin_connected_at) : "Not tracked yet"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{userData.credits_remaining || 0}</div>
                                                    <div className="text-xs text-gray-500">
                                                        Used: {userData.total_credits_used || 0}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{userData.total_processed || 0}</div>
                                                    <div className="text-xs text-gray-500">
                                                        Logs: {userData.total_usage_count || 0}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-green-600">
                                                        {formatCurrency(userData.total_paid || 0)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {userData.payment_count || 0} payment(s)
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {formatDate(userData.created_at)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Button
                                                        variant="outline"
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
                                <h2 className="text-2xl font-bold text-gray-900">Marketing Funnel</h2>
                                <p className="text-sm text-gray-600">
                                    Tracks the path from visitor activity to purchase and plugin usage.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={funnelDays}
                                    onChange={(event) => handleFunnelDaysChange(event.target.value)}
                                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="1">Last 24 hours</option>
                                    <option value="7">Last 7 days</option>
                                    <option value="14">Last 14 days</option>
                                    <option value="30">Last 30 days</option>
                                    <option value="90">Last 90 days</option>
                                </select>
                                <Button
                                    onClick={() => user?.token && loadFunnel(user.token, funnelDays)}
                                    variant="outline"
                                    disabled={isLoadingFunnel}
                                    className="gap-2"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoadingFunnel ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Events</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {formatNumber(funnelReport?.totals?.events)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Unique Actors</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-[#000000]">
                                        {formatNumber(funnelReport?.totals?.unique_actors)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Purchases</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-green-600">
                                        {formatNumber(purchaseStage?.unique_actors)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Visitor to Purchase</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {visitorStage?.unique_actors ? formatPercent(purchaseStage?.unique_actors / visitorStage.unique_actors) : "N/A"}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-[#000000]" />
                                    Funnel Stages
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Stage</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actors</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Events</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">From Previous</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">From Start</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(funnelReport?.stages || []).map((stage: any) => (
                                                <tr key={stage.key} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-medium text-gray-900">{stage.label}</td>
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
                                        <TrendingDown className="h-5 w-5 text-red-600" />
                                        Dropoffs
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(funnelReport?.dropoffs || []).map((dropoff: any) => (
                                        <div key={dropoff.key} className="rounded-md border border-gray-200 p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="font-medium text-gray-900">{dropoff.label}</div>
                                                <Badge className="bg-red-50 text-red-700">{formatNumber(dropoff.count)}</Badge>
                                            </div>
                                            {dropoff.sample?.length > 0 && (
                                                <div className="mt-3 space-y-1">
                                                    {dropoff.sample.slice(0, 3).map((actor: any, index: number) => (
                                                        <div key={`${dropoff.key}-${index}`} className="text-xs text-gray-500">
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
                                        <div className="text-sm font-semibold text-gray-700 mb-2">Sources</div>
                                        <div className="space-y-2">
                                            {(funnelReport?.top_sources || []).map((source: any) => (
                                                <div key={source.label} className="flex justify-between text-sm">
                                                    <span className="text-gray-600">{source.label}</span>
                                                    <span className="font-medium">{formatNumber(source.count)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-700 mb-2">Pages</div>
                                        <div className="space-y-2">
                                            {(funnelReport?.top_pages || []).map((page: any) => (
                                                <div key={page.label} className="flex justify-between gap-4 text-sm">
                                                    <span className="truncate text-gray-600">{page.label}</span>
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
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Events</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actors</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Visitors</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Demos</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Signups</th>
                                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Purchases</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(funnelReport?.daily_series || []).map((day: any) => (
                                                <tr key={day.date} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-medium text-gray-900">{day.date}</td>
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
                                <h2 className="text-2xl font-bold text-gray-900">Lifecycle Visibility</h2>
                                <p className="text-sm text-gray-600">
                                    Per-user setup status, plugin connection, first generation, credits, and follow-up history.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={lifecycleDays}
                                    onChange={(event) => handleLifecycleDaysChange(event.target.value)}
                                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="all">All follow-up statuses</option>
                                    <option value="Needs plugin reminder">Needs plugin reminder</option>
                                    <option value="Needs first generation reminder">Needs first generation reminder</option>
                                    <option value="Low credits">Low credits</option>
                                    <option value="Checkout recovery">Checkout recovery</option>
                                    <option value="Active">Active</option>
                                </select>
                                <Button
                                    onClick={() => user?.token && loadLifecycle(user.token, lifecycleDays)}
                                    variant="outline"
                                    disabled={isLoadingLifecycle}
                                    className="gap-2"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoadingLifecycle ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Users</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {formatNumber(lifecycleReport?.summary?.total_users)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Plugin Connected</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-[#000000]">
                                        {formatNumber(lifecycleReport?.summary?.plugin_connected)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">First Generation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-green-600">
                                        {formatNumber(lifecycleReport?.summary?.first_generation)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Needs Follow-up</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-amber-600">
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
                                    <CardTitle className="text-sm font-medium text-gray-600">Need Plugin Reminder</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-amber-700">
                                        {formatNumber(lifecycleReport?.summary?.needs_plugin_reminder)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Need First Generation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-amber-700">
                                        {formatNumber(lifecycleReport?.summary?.needs_first_generation_reminder)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Low Credits</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-red-600">
                                        {formatNumber(lifecycleReport?.summary?.low_credits)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600">Checkout Recovery</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {formatNumber(lifecycleReport?.summary?.checkout_recovery)}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Plug className="h-5 w-5 text-[#000000]" />
                                    User Lifecycle Status ({filteredLifecycleUsers.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Plugin</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">First Generation</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Credits</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Follow-up Status</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Latest Email</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Test</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredLifecycleUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="text-center py-8 text-gray-500">
                                                        No lifecycle users found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredLifecycleUsers.map((row: any) => (
                                                    <tr key={row.user_id} className="border-b hover:bg-gray-50 align-top">
                                                        <td className="py-3 px-4">
                                                            <div className="font-medium text-gray-900">{row.email}</div>
                                                            <div className="text-xs text-gray-500 font-mono">{row.user_id?.substring(0, 8)}...</div>
                                                            <div className="text-xs text-gray-500">Signup: {formatDate(row.signup_at)}</div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <Badge className="bg-purple-100 text-purple-700">{row.plan}</Badge>
                                                            <div className="text-xs text-gray-500 mt-1">{row.status}</div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {row.plugin_connected_at ? (
                                                                <>
                                                                    <Badge className="bg-green-100 text-green-700">Connected</Badge>
                                                                    <div className="text-xs text-gray-500 mt-1">{formatDate(row.plugin_connected_at)}</div>
                                                                    <div className="text-xs text-gray-400">{row.plugin_connection_source}</div>
                                                                    {row.plugin_version && (
                                                                        <div className="text-xs font-medium text-gray-700 mt-1">v{row.plugin_version}</div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Badge className="bg-amber-100 text-amber-700">Not connected</Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {row.first_generation_at ? (
                                                                <>
                                                                    <Badge className="bg-green-100 text-green-700">Generated</Badge>
                                                                    <div className="text-xs text-gray-500 mt-1">{formatDate(row.first_generation_at)}</div>
                                                                    <div className="text-xs text-gray-500">Used: {formatNumber(row.total_credits_used)} credits</div>
                                                                </>
                                                            ) : (
                                                                <Badge className="bg-gray-100 text-gray-700">No generation</Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="font-semibold">{formatNumber(row.credits_remaining)}</div>
                                                            <div className="text-xs text-gray-500">Processed: {formatNumber(row.total_processed)}</div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <Badge
                                                                className={
                                                                    row.follow_up_status === "Active"
                                                                        ? "bg-green-100 text-green-700"
                                                                        : row.follow_up_status === "Low credits"
                                                                            ? "bg-red-100 text-red-700"
                                                                            : "bg-amber-100 text-amber-700"
                                                                }
                                                            >
                                                                {row.follow_up_status}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {row.latest_follow_up ? (
                                                                <div className="text-sm">
                                                                    <div className="font-medium text-gray-900">{row.latest_follow_up.automation_key}</div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {row.latest_follow_up.status} · {formatDate(row.latest_follow_up.sent_at || row.latest_follow_up.created_at)}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        Sent: {formatNumber(row.follow_ups_sent)} · Failed: {formatNumber(row.follow_ups_failed)}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-gray-500">No email sent</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {getLifecycleRuleForStatus(row.follow_up_status) ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={Boolean(lifecycleActionKey)}
                                                                        onClick={() => runLifecycleTestSend(row, true)}
                                                                    >
                                                                        {lifecycleActionKey === `${row.user_id}:${getLifecycleRuleForStatus(row.follow_up_status)}:dry`
                                                                            ? "Checking..."
                                                                            : "Dry Run"}
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
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
                                                                <span className="text-sm text-gray-400">Not eligible</span>
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white shadow-xl">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>User Details</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedUser(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Email</label>
                                <p className="text-gray-900">{selectedUser.email}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">User ID</label>
                                <p className="text-gray-900 font-mono text-sm">{selectedUser.id}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Subscription Plan</label>
                                    <p className="text-gray-900">
                                        <Badge className="bg-purple-100 text-purple-700">
                                            {selectedUser.subscription_plan || "free"}
                                        </Badge>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Subscription Status</label>
                                    <p className="text-gray-900">
                                        <Badge
                                            className={
                                                selectedUser.subscription_status === "active"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                            }
                                        >
                                            {selectedUser.subscription_status || "active"}
                                        </Badge>
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Credits Remaining</label>
                                    <p className="text-2xl font-bold text-gray-900">{selectedUser.credits_remaining || 0}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Total Processed</label>
                                    <p className="text-2xl font-bold text-gray-900">{selectedUser.total_processed || 0}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Total Credits Used</label>
                                    <p className="text-gray-900">{selectedUser.total_credits_used || 0}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Total Usage Count</label>
                                    <p className="text-gray-900">{selectedUser.total_usage_count || 0}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Last Seen Plugin Version</label>
                                    <p className="text-gray-900">{selectedUser.latest_plugin_version ? `v${selectedUser.latest_plugin_version}` : "Not tracked yet"}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Plugin Connected</label>
                                    <p className="text-gray-900">
                                        {selectedUser.plugin_connected_at
                                            ? `${formatDate(selectedUser.plugin_connected_at)}${selectedUser.plugin_connection_source ? ` (${selectedUser.plugin_connection_source})` : ""}`
                                            : "Not tracked yet"}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">Total Paid</label>
                                <p className="text-2xl font-bold text-green-600">
                                    {formatCurrency(selectedUser.total_paid || 0)}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {selectedUser.payment_count || 0} payment(s)
                                </p>
                            </div>
                            {selectedUser.latest_payment && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Latest Payment</label>
                                    <div className="bg-gray-50 p-3 rounded-md">
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
                                    <label className="text-sm font-medium text-gray-700">Created At</label>
                                    <p className="text-gray-900">{formatDate(selectedUser.created_at)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Updated At</label>
                                    <p className="text-gray-900">{formatDate(selectedUser.updated_at)}</p>
                                </div>
                            </div>
                            {selectedUser.next_billing_date && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Next Billing Date</label>
                                    <p className="text-gray-900">{formatDate(selectedUser.next_billing_date)}</p>
                                </div>
                            )}
                            {selectedUser.expires_at && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Expires At</label>
                                    <p className="text-gray-900">{formatDate(selectedUser.expires_at)}</p>
                                </div>
                            )}
                            {selectedUser.subscription_id && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Subscription ID</label>
                                    <p className="text-gray-900 font-mono text-sm">{selectedUser.subscription_id}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </main>
    );
}
