"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, supabase } from '@/lib/supabase';
import { getApiBase } from '@/lib/utils';
import { toast } from "sonner";
import { Activity, BarChart3, ClipboardList, CreditCard, Mail, Plug, RefreshCw, Search, TrendingDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserDetailModal from "./UserDetailModal";
import UnmatchedPaymentsTab from "./UnmatchedPaymentsTab";
import AuditLogTab from "./AuditLogTab";
import { statusBadgeClass, statusLabel } from "./admin-api";

const USERS_PAGE_SIZE = 50;

type UserQuery = { q: string; plan: string; status: string; offset: number };

// Admin Dashboard Component
export default function AdminDashboard() {
    const [user, setUser] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [usersTotal, setUsersTotal] = useState(0);
    const [usersOffset, setUsersOffset] = useState(0);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [funnelReport, setFunnelReport] = useState<any>(null);
    const [lifecycleReport, setLifecycleReport] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingFunnel, setIsLoadingFunnel] = useState(false);
    const [isLoadingLifecycle, setIsLoadingLifecycle] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [lifecycleSearch, setLifecycleSearch] = useState("");
    const [filterPlan, setFilterPlan] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [funnelDays, setFunnelDays] = useState("7");
    const [lifecycleDays, setLifecycleDays] = useState("30");
    const [lifecycleFilter, setLifecycleFilter] = useState("all");
    const [lifecycleActionKey, setLifecycleActionKey] = useState("");
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const router = useRouter();

    // Search, filters and paging run server-side (admin_list_users); only
    // the newest request may update the table.
    const usersRequestRef = useRef(0);
    const loadUsers = useCallback(async (token: string, query: UserQuery) => {
        const requestId = ++usersRequestRef.current;
        try {
            setIsLoadingUsers(true);
            const apiBase = getApiBase();
            const params = new URLSearchParams({
                limit: String(USERS_PAGE_SIZE),
                offset: String(query.offset),
                plan: query.plan,
                status: query.status,
                // Aggregate stats only with the first page.
                stats: query.offset === 0 ? "1" : "0",
            });
            if (query.q.trim()) params.set("q", query.q.trim());

            const response = await fetch(`${apiBase}/admin-get-users?${params.toString()}`, {
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
            if (requestId !== usersRequestRef.current) return;
            if (result.success && result.data) {
                setUsers(result.data.users || []);
                setUsersTotal(Number(result.data.total || 0));
                setUsersOffset(query.offset);
                if (result.data.stats) setStats(result.data.stats);
            } else {
                throw new Error('Invalid API response format');
            }
        } catch (error) {
            console.error("Error loading users:", error);
            toast.error("Failed to load users. Please try again.");
        } finally {
            if (requestId === usersRequestRef.current) setIsLoadingUsers(false);
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
                    loadUsers(session.access_token, { q: "", plan: "all", status: "all", offset: 0 }),
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
            loadUsers(accessToken, { q: searchTerm, plan: filterPlan, status: filterStatus, offset: usersOffset }),
            loadFunnel(accessToken, funnelDays),
            loadLifecycle(accessToken, lifecycleDays),
        ]);
        setIsLoading(false);
        toast.success("Admin data refreshed");
    };

    const reloadUsers = async (overrides: Partial<UserQuery> = {}) => {
        const accessToken = await requireAccessToken();
        if (!accessToken) return;
        await loadUsers(accessToken, {
            q: searchTerm,
            plan: filterPlan,
            status: filterStatus,
            offset: 0,
            ...overrides,
        });
    };

    // Debounce typing in the search box; plan and status apply at once.
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            void reloadUsers({ q: value, offset: 0 });
        }, 400);
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

    const filteredLifecycleUsers = (lifecycleReport?.users || []).filter((row: any) => {
        const matchesSearch =
            row.email?.toLowerCase().includes(lifecycleSearch.toLowerCase()) ||
            row.user_id?.toLowerCase().includes(lifecycleSearch.toLowerCase());
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

    const formatSigned = (value: number | null | undefined) => {
        const number = Number(value || 0);
        return number > 0 ? `+${formatNumber(number)}` : formatNumber(number);
    };

    // Change in unique actors against the previous period of equal length.
    const formatStageChange = (key: string) => {
        const change = funnelReport?.comparison?.stages?.find((stage: any) => stage.key === key);
        if (!change) return "N/A";
        const delta = formatSigned(change.unique_actors_delta);
        return change.unique_actors_change === null || change.unique_actors_change === undefined
            ? `${delta} (new)`
            : `${delta} (${change.unique_actors_change > 0 ? "+" : ""}${formatPercent(change.unique_actors_change)})`;
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
                        <TabsTrigger value="payments" className="gap-2 px-4">
                            <CreditCard className="h-4 w-4" />
                            Unmatched payments
                            {Number(stats?.unresolved_reconciliations || 0) > 0 && (
                                <Badge className="border-red-200 bg-red-50 text-error">{stats.unresolved_reconciliations}</Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="audit" className="gap-2 px-4">
                            <ClipboardList className="h-4 w-4" />
                            Audit log
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="users" className="space-y-6">
                {/* Statistics Cards */}
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Total Users</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{formatNumber(stats.total_users)}</div>
                                {Number(stats.blocked_users || 0) > 0 && (
                                    <div className="text-xs text-error mt-1">{formatNumber(stats.blocked_users)} suspended</div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Revenue (net of tax and refunds)</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{formatCurrency(stats.total_revenue)}</div>
                                <div className="text-xs text-ink-muted mt-1">All time, deleted accounts included</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">MRR / ARR</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{formatCurrency(stats.mrr)}</div>
                                <div className="text-xs text-ink-muted mt-1">
                                    ARR {formatCurrency(stats.arr)}
                                    {Number(stats.past_due_mrr || 0) > 0 ? ` · ${formatCurrency(stats.past_due_mrr)} past due` : ""}
                                    {Number(stats.cancelling_mrr || 0) > 0 ? ` · ${formatCurrency(stats.cancelling_mrr)} cancelling` : ""}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Paying Subscribers</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{formatNumber(stats.active_subscriptions)}</div>
                                <div className="text-xs text-ink-muted mt-1">
                                    {Number(stats.past_due_subscriptions || 0) > 0 ? `${formatNumber(stats.past_due_subscriptions)} past due · ` : ""}
                                    {formatNumber(stats.active_users)} incl. cancelling
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Total Credits Used</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{formatNumber(stats.total_credits_used)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Connected Sites</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className="text-3xl font-bold text-ink">{formatNumber(stats.connected_sites)}</div>
                                <div className="text-xs text-ink-muted mt-1">{formatNumber(stats.users_with_sites)} accounts</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Unmatched Payments</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <div className={`text-3xl font-bold ${Number(stats.unresolved_reconciliations || 0) > 0 ? "text-error" : "text-ink"}`}>
                                    {formatNumber(stats.unresolved_reconciliations)}
                                </div>
                                {Number(stats.pending_subscription_cancellations || 0) > 0 && (
                                    <div className="text-xs text-error mt-1">
                                        {formatNumber(stats.pending_subscription_cancellations)} Polar cancellation(s) pending after deletion
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-ink-muted">Plugin Versions (active sites)</CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto space-y-1">
                                {(stats.plugin_versions || []).length === 0 ? (
                                    <div className="text-sm text-ink-muted">No sites recorded yet</div>
                                ) : (
                                    (stats.plugin_versions || []).slice(0, 5).map((row: any) => (
                                        <div key={row.version} className="flex justify-between text-sm">
                                            <span className="text-ink">{row.version === "unknown" ? "Unknown" : `v${row.version}`}</span>
                                            <span className="font-medium">{formatNumber(row.sites)}</span>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle>Find users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="admin-user-search" className="text-sm font-medium text-ink mb-2 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink-muted" />
                                    <Input
                                        id="admin-user-search"
                                        type="text"
                                        placeholder="Email, user ID, site URL, Polar customer or subscription ID"
                                        value={searchTerm}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="admin-plan-filter" className="text-sm font-medium text-ink mb-2 block">Plan</label>
                                <select
                                    id="admin-plan-filter"
                                    value={filterPlan}
                                    onChange={(e) => {
                                        setFilterPlan(e.target.value);
                                        void reloadUsers({ plan: e.target.value });
                                    }}
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
                                <label htmlFor="admin-status-filter" className="text-sm font-medium text-ink mb-2 block">Status</label>
                                <select
                                    id="admin-status-filter"
                                    value={filterStatus}
                                    onChange={(e) => {
                                        setFilterStatus(e.target.value);
                                        void reloadUsers({ status: e.target.value });
                                    }}
                                    className="h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:border-yellow-strong"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="past_due">Past due</option>
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
                        <CardTitle>
                            Users ({formatNumber(usersTotal)}){isLoadingUsers ? " · loading..." : ""}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-line bg-yellow-tint">
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Email</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Plan</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Status</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Plugin</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Credits</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Processed</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Total Paid</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Created</th>
                                        <th className="text-left py-3 px-4 font-semibold text-ink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-8 text-ink-muted">
                                                {isLoadingUsers ? "Loading..." : "No users found"}
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((userData) => (
                                            <tr key={userData.id} className="border-b border-line hover:bg-yellow-tint">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-ink">{userData.email}</div>
                                                    <div className="text-xs text-ink-muted font-mono">{userData.id.substring(0, 8)}...</div>
                                                    {userData.blocked_at && (
                                                        <Badge className="mt-1 border-red-200 bg-red-50 text-error">Suspended</Badge>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge>
                                                        {userData.subscription_plan || "free"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge className={statusBadgeClass(userData.subscription_status)}>
                                                        {statusLabel(userData.subscription_status)}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-ink">
                                                        {userData.latest_plugin_version ? `v${userData.latest_plugin_version}` : "--"}
                                                    </div>
                                                    <div className="text-xs text-ink-muted">
                                                        {Number(userData.connected_sites || 0) > 0
                                                            ? `${userData.connected_sites} site(s) · ${formatDate(userData.plugin_last_seen_at)}`
                                                            : "No sites"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{formatNumber(userData.credits_remaining)}</div>
                                                    <div className="text-xs text-ink-muted">
                                                        Used: {formatNumber(userData.total_credits_used)}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{formatNumber(userData.total_processed)}</div>
                                                    <div className="text-xs text-ink-muted">
                                                        Logs: {formatNumber(userData.total_usage_count)}
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
                                                        Manage
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap justify-between items-center gap-3 mt-4">
                            <span className="text-sm text-ink-muted">
                                {usersTotal === 0
                                    ? "0 users"
                                    : `${usersOffset + 1}–${Math.min(usersOffset + users.length, usersTotal)} of ${formatNumber(usersTotal)}`}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={isLoadingUsers || usersOffset === 0}
                                    onClick={() => void reloadUsers({ offset: Math.max(0, usersOffset - USERS_PAGE_SIZE) })}
                                >
                                    Previous
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={isLoadingUsers || usersOffset + USERS_PAGE_SIZE >= usersTotal}
                                    onClick={() => void reloadUsers({ offset: usersOffset + USERS_PAGE_SIZE })}
                                >
                                    Next
                                </Button>
                            </div>
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
                                    {funnelReport?.comparison && (
                                        <div className="text-xs text-ink-muted mt-1">{formatSigned(funnelReport.comparison.totals?.events_delta)} vs previous period</div>
                                    )}
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
                                    {funnelReport?.comparison && (
                                        <div className="text-xs text-ink-muted mt-1">{formatSigned(funnelReport.comparison.totals?.unique_actors_delta)} vs previous period</div>
                                    )}
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
                                                <th className="text-right py-3 px-4 font-semibold text-ink">vs Previous Period</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">Events</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">From Previous Stage</th>
                                                <th className="text-right py-3 px-4 font-semibold text-ink">From Start</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(funnelReport?.stages || []).map((stage: any) => (
                                                <tr key={stage.key} className="border-b border-line hover:bg-yellow-tint">
                                                    <td className="py-3 px-4 font-medium text-ink">{stage.label}</td>
                                                    <td className="py-3 px-4 text-right">{formatNumber(stage.unique_actors)}</td>
                                                    <td className="py-3 px-4 text-right">{formatStageChange(stage.key)}</td>
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
                                <Input
                                    type="text"
                                    aria-label="Filter lifecycle users by email or ID"
                                    placeholder="Filter by email or ID"
                                    value={lifecycleSearch}
                                    onChange={(event) => setLifecycleSearch(event.target.value)}
                                    className="w-56"
                                />
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
                                                            <div className="text-xs text-ink-muted mt-1">{statusLabel(row.status)}</div>
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

                    <TabsContent value="payments" className="space-y-6">
                        <UnmatchedPaymentsTab onResolved={() => void reloadUsers({ offset: usersOffset })} />
                    </TabsContent>

                    <TabsContent value="audit" className="space-y-6">
                        <AuditLogTab />
                    </TabsContent>
                </Tabs>
            </div>

            {selectedUser && (
                <UserDetailModal
                    userId={selectedUser.id}
                    listRow={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onChanged={() => void reloadUsers({ offset: usersOffset })}
                />
            )}
        </main>
    );
}
