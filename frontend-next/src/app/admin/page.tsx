"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";
import { RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Admin Dashboard Component
export default function AdminDashboard() {
    const [user, setUser] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPlan, setFilterPlan] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndLoadData = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    toast.error("Please sign in to access the admin dashboard");
                    router.push("/");
                    return;
                }

                setUser({
                    email: session.user.email,
                    id: session.user.id,
                    token: session.access_token
                });

                await loadUsers(session.access_token);
            } catch (error) {
                console.error("Error checking auth:", error);
                toast.error("Authentication error");
                router.push("/");
            } finally {
                setIsLoading(false);
            }
        };

        checkAuthAndLoadData();
    }, [router]);

    const loadUsers = async (token: string) => {
        try {
            let apiBase;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Use localhost Netlify Dev functions (port 9999)
                apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
            } else {
                apiBase = '/.netlify/functions';
            }

            const response = await fetch(`${apiBase}/admin-get-users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 403) {
                toast.error("Access denied. Superuser privileges required.");
                router.push("/");
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
    };

    const handleRefresh = async () => {
        if (user?.token) {
            setIsLoading(true);
            await loadUsers(user.token);
            setIsLoading(false);
            toast.success("Users refreshed");
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                        style={{ borderColor: '#0D4F5E' }}></div>
                    <p className="text-gray-600">Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
                                <div className="text-3xl font-bold text-blue-600">{stats.active_users}</div>
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
                                    <option value="tier1">Tier 1</option>
                                    <option value="tier2">Tier 2</option>
                                    <option value="tier3">Tier 3</option>
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
                                            <td colSpan={8} className="text-center py-8 text-gray-500">
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
        </div>
    );
}
