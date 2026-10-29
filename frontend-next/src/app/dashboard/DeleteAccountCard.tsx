"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getAccessToken } from "@/lib/supabase";
import { getApiBase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailsMatch } from "./dashboard-helpers";

type DeleteAccountCardProps = {
    email: string;
    /** Called after the server deleted the account. */
    onDeleted: () => Promise<void> | void;
};

export default function DeleteAccountCard({ email, onDeleted }: DeleteAccountCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canDelete = emailsMatch(confirmEmail, email) && !isDeleting;

    const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!emailsMatch(confirmEmail, email)) {
            setError("Type your account email exactly to confirm.");
            return;
        }

        setIsDeleting(true);
        setError(null);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Your session expired. Sign in again, then delete the account.");
                return;
            }

            // Netlify function, reached through the same API base as get-usage.
            const response = await fetch(`${getApiBase()}/delete-account`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ confirm_email: confirmEmail.trim() }),
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 404 && !data?.message) {
                setError("Account deletion isn't available right now. Please contact support to delete your account.");
                return;
            }

            if (!response.ok || !data?.success) {
                // { error: code, message: human text }
                setError(data?.message || data?.error || "We couldn't delete your account. Please try again or contact support.");
                return;
            }

            await onDeleted();
        } catch {
            setError("We couldn't reach Alt Text Pro. Your account was not deleted.");
            toast.error("Account deletion failed.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <section id="danger-zone" aria-labelledby="danger-zone-heading" className="mt-6 scroll-mt-24 rounded-2xl border border-red-200 bg-white p-5 shadow-notebook sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-error">
                        <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 id="danger-zone-heading" className="font-lato text-xl font-semibold text-ink">Danger zone</h2>
                        <p className="mt-1 text-sm text-ink-muted">Permanently delete your Alt Text Pro account.</p>
                    </div>
                </div>
                {!isOpen && (
                    <Button type="button" variant="destructive" onClick={() => setIsOpen(true)} className="self-start">
                        <Trash2 /> Delete account
                    </Button>
                )}
            </div>

            {isOpen && (
                <form onSubmit={handleDelete} className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
                    <p className="text-sm font-semibold text-ink">Deleting your account:</p>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink">
                        <li>cancels any active subscription, so it won&apos;t renew;</li>
                        <li>removes all remaining credits, including purchased and bonus credits, with no refund;</li>
                        <li>stops your API key, so every connected WordPress site is disconnected;</li>
                        <li>removes your sign-in, so you can&apos;t log back in to this account.</li>
                    </ul>
                    <p className="mt-3 text-sm leading-6 text-ink-muted">
                        Payment records are kept for accounting and tax purposes. This can&apos;t be undone.
                    </p>

                    <label htmlFor="delete-confirm-email" className="mt-5 block text-sm font-semibold text-ink">
                        Type <span className="break-all font-bold">{email}</span> to confirm
                    </label>
                    <Input
                        id="delete-confirm-email"
                        type="email"
                        autoComplete="off"
                        value={confirmEmail}
                        onChange={(event) => setConfirmEmail(event.target.value)}
                        disabled={isDeleting}
                        className="mt-2"
                    />
                    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button type="submit" variant="destructive" disabled={!canDelete}>
                            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                            Permanently delete account
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={isDeleting}
                            onClick={() => {
                                setIsOpen(false);
                                setConfirmEmail("");
                                setError(null);
                            }}
                        >
                            Keep my account
                        </Button>
                    </div>
                </form>
            )}
        </section>
    );
}
