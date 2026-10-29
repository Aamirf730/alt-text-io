"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminGet, formatDate } from "./admin-api";

const PAGE_SIZE = 50;

const ACTION_FILTERS = [
    { value: "", label: "All actions" },
    { value: "admin.", label: "Admin actions" },
    { value: "account.deleted", label: "Account deletions" },
    { value: "credit.", label: "Credit grants (system)" },
];

function summarizeDetails(details: any) {
    if (!details || typeof details !== "object") return "";
    const parts: string[] = [];
    if (details.email) parts.push(details.email);
    if (details.reason) parts.push(`reason: ${details.reason}`);
    if (details.credits) parts.push(`${details.credits} credits`);
    if (details.credits_removed !== undefined) parts.push(`${details.credits_removed} credits removed`);
    if (details.query) parts.push(`search: ${details.query}`);
    if (details.subscription_cancellation && details.subscription_cancellation !== "not_needed") {
        parts.push(`Polar: ${details.subscription_cancellation}`);
    }
    if (details.state) parts.push(details.state);
    return parts.join(" · ");
}

export default function AuditLogTab() {
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [action, setAction] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const load = useCallback(async (nextOffset: number, nextAction: string) => {
        setIsLoading(true);
        try {
            const result = await adminGet("admin-audit-log", { limit: PAGE_SIZE, offset: nextOffset, action: nextAction });
            setRows(result.data?.rows || []);
            setTotal(Number(result.data?.total || 0));
            setOffset(nextOffset);
        } catch (error: any) {
            toast.error(error?.message || "Failed to load the audit log");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => void load(0, ""), 0);
        return () => clearTimeout(timer);
    }, [load]);

    const pageEnd = Math.min(offset + rows.length, total);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-ink">Audit log</h2>
                    <p className="text-sm text-ink-muted">Every operator action, account deletion and system credit grant, newest first.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        aria-label="Filter by action"
                        value={action}
                        onChange={(event) => {
                            setAction(event.target.value);
                            void load(0, event.target.value);
                        }}
                        className="h-11 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:border-yellow-strong"
                    >
                        {ACTION_FILTERS.map(filter => (
                            <option key={filter.value} value={filter.value}>{filter.label}</option>
                        ))}
                    </select>
                    <Button onClick={() => void load(offset, action)} variant="secondary" disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {total === 0 ? "No entries" : `Entries ${offset + 1}–${pageEnd} of ${total}`}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-line bg-yellow-tint">
                                    <th className="text-left py-3 px-4 font-semibold text-ink">When</th>
                                    <th className="text-left py-3 px-4 font-semibold text-ink">Action</th>
                                    <th className="text-left py-3 px-4 font-semibold text-ink">Actor</th>
                                    <th className="text-left py-3 px-4 font-semibold text-ink">Target</th>
                                    <th className="text-left py-3 px-4 font-semibold text-ink">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(row => (
                                    <tr key={row.id} className="border-b border-line align-top">
                                        <td className="py-3 px-4 whitespace-nowrap text-ink-muted">{formatDate(row.created_at)}</td>
                                        <td className="py-3 px-4">
                                            <Badge className={row.severity === "warning" || row.severity === "critical" ? "border-amber-200 bg-amber-50 text-warning" : undefined}>
                                                {row.action}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4 break-all">{row.actor_email || "system"}</td>
                                        <td className="py-3 px-4 font-mono text-xs break-all">{row.resource_id || "--"}</td>
                                        <td className="py-3 px-4 text-ink-muted">{summarizeDetails(row.details)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={isLoading || offset === 0}
                            onClick={() => void load(Math.max(0, offset - PAGE_SIZE), action)}
                        >
                            Newer
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={isLoading || offset + PAGE_SIZE >= total}
                            onClick={() => void load(offset + PAGE_SIZE, action)}
                        >
                            Older
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
