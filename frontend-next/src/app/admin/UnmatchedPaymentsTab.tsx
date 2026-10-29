"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminApiError, adminGet, formatCurrency, formatDate, nextApiPost } from "./admin-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REASON_LABELS: Record<string, string> = {
    ambiguous_email_match: "Several accounts share this email",
    subscription_not_bound: "Subscription not linked to an account",
};

type Props = {
    /** Called after a payment is assigned so counts elsewhere refresh. */
    onResolved?: () => void;
};

/**
 * Paid Polar events that could not be matched to an account. "Assign"
 * replays the event for a chosen account through the Next route
 * POST /api/admin/reconcile-payment.
 */
export default function UnmatchedPaymentsTab({ onResolved }: Props) {
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [targets, setTargets] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await adminGet("admin-payment-reconciliation", { status: "open", limit: 100 });
            setRows(result.data?.rows || []);
            setTotal(Number(result.data?.total || 0));
        } catch (error: any) {
            toast.error(error?.message || "Failed to load unmatched payments");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => void load(), 0);
        return () => clearTimeout(timer);
    }, [load]);

    /** Accept a user ID, or an email that matches exactly one account. */
    const resolveUserId = async (value: string): Promise<string | null> => {
        const input = value.trim();
        if (UUID_PATTERN.test(input)) return input.toLowerCase();
        if (!input.includes("@")) {
            toast.error("Enter the account's user ID or email.");
            return null;
        }

        const result = await adminGet("admin-get-users", { q: input, limit: 5, stats: 0 });
        const matches = (result.data?.users || []).filter(
            (user: any) => String(user.email || "").toLowerCase() === input.toLowerCase()
        );
        if (matches.length === 1) return matches[0].id;
        toast.error(matches.length === 0
            ? "No account has that email."
            : "Several accounts share that email. Use the user ID instead.");
        return null;
    };

    const assign = async (row: any, value: string) => {
        setBusyId(row.id);
        try {
            const userId = await resolveUserId(value);
            if (!userId) return;
            if (!window.confirm(`Assign this ${row.event_type} (${row.customer_email || "no email"}) to account ${userId}? Credits or plan changes are applied immediately.`)) {
                return;
            }
            const fromDeleted = Boolean(row.from_deleted_account_at);
            if (fromDeleted && !window.confirm(`This payment came from an account that was deleted on ${formatDate(row.from_deleted_account_at)}. Usually it should be left unassigned. Assign it anyway?`)) {
                return;
            }

            const result = await nextApiPost("/api/admin/reconcile-payment", {
                reconciliation_id: row.id,
                user_id: userId,
                ...(fromDeleted ? { confirm_deleted_account: true } : {}),
            });
            const outcome = result?.result?.outcome;
            toast.success(outcome ? `Assigned (${outcome})` : "Payment assigned");
            setTargets(current => {
                const next = { ...current };
                delete next[row.id];
                return next;
            });
            await load();
            onResolved?.();
        } catch (error: any) {
            if (error instanceof AdminApiError && error.status === 409) {
                toast.error(error.message || "This payment was already resolved.");
                await load();
            } else if (error instanceof AdminApiError && error.status === 422) {
                toast.error(error.message || "This payment cannot be replayed yet. It stays in the queue.");
            } else if (error instanceof AdminApiError && error.status === 404) {
                toast.error(error.message || "The payment row or the account no longer exists.");
                await load();
            } else {
                toast.error(error?.message || "Assignment failed");
            }
        } finally {
            setBusyId("");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-ink">Unmatched payments</h2>
                    <p className="text-sm text-ink-muted">
                        Polar charged these customers but no account could be matched. Assign each to the right account.
                    </p>
                </div>
                <Button onClick={() => void load()} variant="secondary" disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Open ({total})</CardTitle>
                </CardHeader>
                <CardContent>
                    {rows.length === 0 ? (
                        <p className="text-ink-muted py-6 text-center">{isLoading ? "Loading..." : "Nothing waiting. Every paid order is matched."}</p>
                    ) : (
                        <div className="space-y-4">
                            {rows.map(row => (
                                <div key={row.id} className="rounded-xl border border-line p-4 space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge>{row.event_type}</Badge>
                                                {row.from_deleted_account_at && (
                                                    <Badge className="border-red-200 bg-red-50 text-error">From a deleted account</Badge>
                                                )}
                                                <span className="font-semibold text-ink">
                                                    {row.amount !== null && row.amount !== undefined ? formatCurrency(row.amount, row.currency || "USD") : "Amount unknown"}
                                                </span>
                                                {row.product && <span className="text-sm text-ink-muted">{row.product}</span>}
                                            </div>
                                            <div className="text-sm text-ink break-all">
                                                {row.customer_email || "No email"}{row.customer_name ? ` (${row.customer_name})` : ""}
                                            </div>
                                            <div className="text-xs text-ink-muted">
                                                {formatDate(row.created_at)} · {REASON_LABELS[row.reason] || row.reason}
                                            </div>
                                            <div className="text-xs text-ink-muted font-mono break-all">
                                                {[
                                                    row.payment_id && `order ${row.payment_id}`,
                                                    row.subscription_id && `subscription ${row.subscription_id}`,
                                                    row.customer_id && `customer ${row.customer_id}`,
                                                    row.candidate_user_id && `candidate ${row.candidate_user_id}`,
                                                ].filter(Boolean).join(" · ")}
                                            </div>
                                        </div>
                                    </div>
                                    <details className="text-xs text-ink-muted">
                                        <summary className="cursor-pointer">Raw summary</summary>
                                        <pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(row.raw_summary, null, 2)}</pre>
                                    </details>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Input
                                            aria-label="User ID or email to assign"
                                            placeholder="User ID or account email"
                                            value={targets[row.id] ?? (row.candidate_user_id || "")}
                                            onChange={(event) => setTargets(current => ({ ...current, [row.id]: event.target.value }))}
                                        />
                                        <Button
                                            size="sm"
                                            disabled={Boolean(busyId) || !(targets[row.id] ?? row.candidate_user_id)}
                                            onClick={() => void assign(row, targets[row.id] ?? row.candidate_user_id ?? "")}
                                        >
                                            {busyId === row.id ? "Assigning..." : "Assign to user"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
