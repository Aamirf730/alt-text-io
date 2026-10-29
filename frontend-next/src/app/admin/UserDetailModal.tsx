"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    adminGet,
    adminPost,
    formatCurrency,
    formatDate,
    formatNumber,
    newIdempotencyKey,
    statusBadgeClass,
    statusLabel,
} from "./admin-api";

type Props = {
    userId: string;
    /** The row from the Users list (aggregates such as total_paid). */
    listRow?: any;
    onClose: () => void;
    /** Called after any change so the list can refresh. */
    onChanged: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-sm font-medium text-ink">{label}</div>
            <div className="text-ink break-words">{children}</div>
        </div>
    );
}

function PolarLink({ href, label }: { href?: string | null; label: string }) {
    if (!href) return null;
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-ink underline underline-offset-4"
        >
            {label}
            <ExternalLink className="h-3.5 w-3.5" />
        </a>
    );
}

export default function UserDetailModal({ userId, listRow, onClose, onChanged }: Props) {
    const [detail, setDetail] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [busyAction, setBusyAction] = useState("");
    const [reason, setReason] = useState("");
    const [credits, setCredits] = useState("");
    const [creditKey, setCreditKey] = useState(newIdempotencyKey);
    const [deleteConfirm, setDeleteConfirm] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await adminGet("admin-user-detail", { user_id: userId });
            setDetail(result.data);
        } catch (error: any) {
            toast.error(error?.message || "Failed to load user");
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        // Load after mount (a timer callback, not the effect body).
        const timer = setTimeout(() => void load(), 0);
        return () => clearTimeout(timer);
    }, [load]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !busyAction) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [busyAction, onClose]);

    const profile = detail?.profile;
    const email: string = profile?.email || listRow?.email || "";
    const trimmedReason = reason.trim();
    const reasonOk = trimmedReason.length >= 3;

    const runAction = async (action: string, extra: Record<string, unknown> = {}, confirmText?: string) => {
        if (!reasonOk) {
            toast.error("Enter a reason (at least 3 characters) first.");
            return;
        }
        if (confirmText && !window.confirm(confirmText)) return;

        setBusyAction(action);
        try {
            const result = await adminPost("admin-user-action", {
                user_id: userId,
                action,
                reason: trimmedReason,
                ...extra,
            });
            const outcome = result?.result || {};
            if (action === "grant_credits") {
                toast.success(outcome.already_processed ? "Already granted" : `Granted ${extra.credits} credits`);
            } else if (action === "remove_credits") {
                toast.success(outcome.already_processed
                    ? "Already removed"
                    : `Removed ${outcome.credits_removed ?? 0} of ${outcome.credits_requested ?? extra.credits} bonus credits`);
            } else if (action === "revoke_api_key") {
                toast.success(`Revoked ${outcome.revoked ?? 0} key(s)`);
            } else if (action === "rotate_api_key") {
                toast.success("API key rotated. The user must reconnect the plugin.");
            } else {
                toast.success(action === "block" ? "Account suspended" : "Account unsuspended");
            }
            if (action === "grant_credits" || action === "remove_credits") {
                setCredits("");
                setCreditKey(newIdempotencyKey());
            }
            setReason("");
            await load();
            onChanged();
        } catch (error: any) {
            toast.error(error?.message || "Action failed");
        } finally {
            setBusyAction("");
        }
    };

    const adjustCredits = (action: "grant_credits" | "remove_credits") => {
        const amount = Number(credits);
        if (!Number.isInteger(amount) || amount <= 0) {
            toast.error("Enter a whole number of credits.");
            return;
        }
        void runAction(action, { credits: amount, idempotency_key: creditKey });
    };

    const deleteUser = async () => {
        if (!reasonOk) {
            toast.error("Enter a reason (at least 3 characters) first.");
            return;
        }
        if (deleteConfirm.trim().toLowerCase() !== email.trim().toLowerCase()) {
            toast.error("Type the account email exactly to confirm.");
            return;
        }

        setBusyAction("delete");
        try {
            const result = await adminPost("delete-users", { user_ids: [userId], reason: trimmedReason });
            const outcome = result?.results?.[0];
            if (outcome?.status === "deleted") {
                toast.success(outcome.message || "Account deleted");
                onChanged();
                onClose();
                return;
            }
            toast.error(outcome?.message || result?.errors?.[0]?.error || "The account was not deleted");
        } catch (error: any) {
            const firstError = error?.body?.errors?.[0]?.error;
            toast.error(firstError || error?.message || "The account was not deleted");
        } finally {
            setBusyAction("");
        }
    };

    const links = detail?.polar_links || {};
    const activeKeys = (detail?.api_keys || []).filter((key: any) => key.is_active);

    return (
        <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="User details"
        >
            <Card className="max-w-3xl w-full max-h-[92vh] overflow-y-auto bg-white shadow-notebook-lg">
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                            <CardTitle className="break-all">{email || "User details"}</CardTitle>
                            <div className="text-xs text-ink-muted font-mono mt-1 break-all">{userId}</div>
                            {profile && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge>{profile.subscription_plan || "free"}</Badge>
                                    <Badge className={statusBadgeClass(profile.subscription_status)}>
                                        {statusLabel(profile.subscription_status)}
                                    </Badge>
                                    {profile.blocked_at && (
                                        <Badge className="border-red-200 bg-red-50 text-error">Suspended</Badge>
                                    )}
                                    {detail?.auth && !detail.auth.email_confirmed_at && (
                                        <Badge className="border-amber-200 bg-amber-50 text-warning">Email not confirmed</Badge>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button variant="secondary" size="icon-sm" aria-label="Close" onClick={onClose} disabled={Boolean(busyAction)}>
                            <X />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading && !detail ? (
                        <p className="text-ink-muted" aria-busy="true">Loading account...</p>
                    ) : !profile ? (
                        <p className="text-ink-muted">This account could not be loaded.</p>
                    ) : (
                        <>
                            {profile.blocked_at && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-error">
                                    Suspended {formatDate(profile.blocked_at)}{profile.blocked_reason ? `: ${profile.blocked_reason}` : ""}
                                </div>
                            )}

                            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Field label="Credits">{formatNumber(profile.credits_remaining)}</Field>
                                <Field label="Bonus">{formatNumber(profile.bonus_credits_remaining)}</Field>
                                <Field label="Purchased">{formatNumber(profile.purchased_credits_remaining)}</Field>
                                <Field label="Used (all time)">{formatNumber(detail.usage?.total_credits_used)}</Field>
                                <Field label="Total paid (net)">{formatCurrency(listRow?.total_paid)}</Field>
                                <Field label="Signed up">{formatDate(profile.created_at)}</Field>
                                <Field label="Last sign-in">{formatDate(detail.auth?.last_sign_in_at)}</Field>
                                <Field label="Lifecycle emails">{profile.marketing_unsubscribed_at ? "Unsubscribed" : "Subscribed"}</Field>
                            </section>

                            <section className="space-y-2">
                                <h3 className="font-semibold text-ink">Billing</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="Polar customer">
                                        <span className="font-mono text-sm">{profile.polar_customer_id || "None"}</span>
                                    </Field>
                                    <Field label="Subscription">
                                        <span className="font-mono text-sm">{profile.subscription_id || "None"}</span>
                                        {profile.billing_cycle ? ` (${profile.billing_cycle})` : ""}
                                    </Field>
                                    {profile.next_billing_date && <Field label="Next billing">{formatDate(profile.next_billing_date)}</Field>}
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <PolarLink href={links.customer} label="Customer in Polar" />
                                    <PolarLink href={links.subscription} label="Subscription in Polar" />
                                    <PolarLink href={links.latest_order} label="Latest order in Polar" />
                                </div>
                                <p className="text-xs text-ink-muted">
                                    Refunds are issued in Polar; the webhook records them here.
                                    {!links.customer && profile.polar_customer_id ? " Set POLAR_ORGANIZATION_SLUG to enable dashboard links." : ""}
                                </p>
                                {(detail.payments || []).length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-line bg-yellow-tint">
                                                    <th className="text-left py-2 px-3">Date</th>
                                                    <th className="text-left py-2 px-3">Product</th>
                                                    <th className="text-left py-2 px-3">Status</th>
                                                    <th className="text-right py-2 px-3">Gross</th>
                                                    <th className="text-right py-2 px-3">Net</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.payments.map((payment: any) => (
                                                    <tr key={payment.id} className="border-b border-line">
                                                        <td className="py-2 px-3">{formatDate(payment.created_at)}</td>
                                                        <td className="py-2 px-3">{payment.product_name || payment.plan_id || "--"}</td>
                                                        <td className="py-2 px-3">{payment.status}</td>
                                                        <td className="py-2 px-3 text-right">{formatCurrency(payment.amount, payment.currency || "USD")}</td>
                                                        <td className="py-2 px-3 text-right">{formatCurrency(payment.net_revenue, payment.currency || "USD")}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>

                            <section className="space-y-2">
                                <h3 className="font-semibold text-ink">Connected sites</h3>
                                {detail.plugin_sites_unavailable ? (
                                    <p className="text-sm text-ink-muted">Site tracking is not available yet.</p>
                                ) : (detail.plugin_sites || []).length === 0 ? (
                                    <p className="text-sm text-ink-muted">No sites recorded.</p>
                                ) : (
                                    <ul className="space-y-1 text-sm">
                                        {detail.plugin_sites.map((site: any) => (
                                            <li key={site.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-1">
                                                <span className="break-all">{site.site_url}</span>
                                                <span className="text-ink-muted">
                                                    {site.plugin_version ? `v${site.plugin_version}` : "version unknown"}
                                                    {site.wp_locale ? ` · ${site.wp_locale}` : ""}
                                                    {" · "}
                                                    {site.disconnected_at ? `disconnected ${formatDate(site.disconnected_at)}` : `seen ${formatDate(site.last_seen_at)}`}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section className="space-y-2">
                                <h3 className="font-semibold text-ink">API key</h3>
                                <p className="text-sm text-ink">
                                    {activeKeys.length === 0
                                        ? "No active key."
                                        : activeKeys.map((key: any) => `…${key.api_key_last4 || "????"} (created ${formatDate(key.created_at)}, last used ${formatDate(key.last_used_at)})`).join("; ")}
                                </p>
                            </section>

                            <section className="space-y-3 rounded-xl border border-line p-4">
                                <h3 className="font-semibold text-ink">Operator actions</h3>
                                <div>
                                    <label htmlFor="admin-action-reason" className="text-sm font-medium text-ink mb-1 block">
                                        Reason (required, saved in the audit log)
                                    </label>
                                    <Input
                                        id="admin-action-reason"
                                        value={reason}
                                        maxLength={500}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder="e.g. Goodwill after outage, support ticket #123"
                                    />
                                </div>

                                <div className="flex flex-wrap items-end gap-2">
                                    <div className="w-32">
                                        <label htmlFor="admin-credit-amount" className="text-sm font-medium text-ink mb-1 block">Credits</label>
                                        <Input
                                            id="admin-credit-amount"
                                            type="number"
                                            min={1}
                                            step={1}
                                            inputMode="numeric"
                                            value={credits}
                                            onChange={(event) => setCredits(event.target.value)}
                                        />
                                    </div>
                                    <Button size="sm" variant="secondary" disabled={Boolean(busyAction)} onClick={() => adjustCredits("grant_credits")}>
                                        {busyAction === "grant_credits" ? "Granting..." : "Grant bonus credits"}
                                    </Button>
                                    <Button size="sm" variant="secondary" disabled={Boolean(busyAction)} onClick={() => adjustCredits("remove_credits")}>
                                        {busyAction === "remove_credits" ? "Removing..." : "Remove bonus credits"}
                                    </Button>
                                </div>
                                <p className="text-xs text-ink-muted">Removal takes bonus credits only. Purchased credits are refunded in Polar.</p>

                                <div className="flex flex-wrap gap-2">
                                    {profile.blocked_at ? (
                                        <Button size="sm" variant="secondary" disabled={Boolean(busyAction)} onClick={() => runAction("unblock")}>
                                            {busyAction === "unblock" ? "Unsuspending..." : "Unsuspend account"}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={Boolean(busyAction)}
                                            onClick={() => runAction("block", {}, `Suspend ${email}? The plugin API will refuse their requests.`)}
                                        >
                                            {busyAction === "block" ? "Suspending..." : "Suspend account"}
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={Boolean(busyAction)}
                                        onClick={() => runAction("rotate_api_key", {}, `Rotate the API key for ${email}? Every connected site stops working until it reconnects.`)}
                                    >
                                        {busyAction === "rotate_api_key" ? "Rotating..." : "Rotate API key"}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={Boolean(busyAction) || activeKeys.length === 0}
                                        onClick={() => runAction("revoke_api_key", {}, `Revoke the API key for ${email}? Their sites disconnect. They can create a new key from the dashboard unless the account is suspended.`)}
                                    >
                                        {busyAction === "revoke_api_key" ? "Revoking..." : "Revoke API key"}
                                    </Button>
                                </div>
                            </section>

                            <section className="space-y-3 rounded-xl border border-red-200 p-4">
                                <h3 className="font-semibold text-error">Delete account</h3>
                                <p className="text-sm text-ink-muted">
                                    Deletes the account and its usage data, keeps payment records (with the email) for accounting,
                                    removes the email and IP from marketing data, and cancels any Polar subscription.
                                    This cannot be undone. Uses the reason above.
                                </p>
                                <label htmlFor="admin-delete-confirm" className="text-sm font-medium text-ink block">
                                    Type <span className="font-mono">{email}</span> to confirm
                                </label>
                                <Input
                                    id="admin-delete-confirm"
                                    value={deleteConfirm}
                                    autoComplete="off"
                                    onChange={(event) => setDeleteConfirm(event.target.value)}
                                />
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={
                                        Boolean(busyAction)
                                        || !reasonOk
                                        || deleteConfirm.trim().toLowerCase() !== email.trim().toLowerCase()
                                    }
                                    onClick={() => void deleteUser()}
                                >
                                    {busyAction === "delete" ? "Deleting..." : "Delete account permanently"}
                                </Button>
                            </section>

                            {(detail.audit || []).length > 0 && (
                                <section className="space-y-2">
                                    <h3 className="font-semibold text-ink">Recent admin activity</h3>
                                    <ul className="space-y-1 text-sm">
                                        {detail.audit.map((row: any) => (
                                            <li key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-1">
                                                <span>
                                                    <span className="font-medium">{row.action}</span>
                                                    {row.details?.reason ? ` · ${row.details.reason}` : ""}
                                                </span>
                                                <span className="text-ink-muted">{row.actor_email || "system"} · {formatDate(row.created_at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
