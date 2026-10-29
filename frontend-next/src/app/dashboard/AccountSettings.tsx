"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Loader2, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailsMatch } from "./dashboard-helpers";

type AccountSettingsProps = {
    email: string;
    /** False for accounts that only sign in with Google. */
    canUsePassword: boolean;
};

const MIN_PASSWORD_LENGTH = 6;

export default function AccountSettings({ email, canUsePassword }: AccountSettingsProps) {
    const [newEmail, setNewEmail] = useState("");
    const [isSavingEmail, setIsSavingEmail] = useState(false);
    const [emailNotice, setEmailNotice] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const handleEmailChange = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextEmail = newEmail.trim();
        setEmailError(null);
        setEmailNotice(null);

        if (!nextEmail) {
            setEmailError("Enter the new email address.");
            return;
        }
        if (emailsMatch(nextEmail, email)) {
            setEmailError("That is already your account email.");
            return;
        }

        setIsSavingEmail(true);
        try {
            const { error } = await supabase.auth.updateUser(
                { email: nextEmail },
                { emailRedirectTo: `${window.location.origin}/dashboard` },
            );
            if (error) {
                setEmailError(error.message);
                return;
            }
            setNewEmail("");
            setEmailNotice(
                `We sent a confirmation link to ${nextEmail}. If we also emailed ${email}, confirm from both addresses. Your sign-in email changes only after confirmation.`,
            );
        } catch {
            setEmailError("Could not start the email change. Please try again.");
        } finally {
            setIsSavingEmail(false);
        }
    };

    const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordError(null);

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setPasswordError(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("The new passwords do not match.");
            return;
        }

        setIsSavingPassword(true);
        try {
            // Check the current password first so an unattended signed-in
            // browser can't be used to take over the account.
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            });
            if (verifyError) {
                setPasswordError("Your current password is incorrect.");
                return;
            }

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                setPasswordError(error.message);
                return;
            }

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Your password has been changed.");
        } catch {
            setPasswordError("Could not change your password. Please try again.");
        } finally {
            setIsSavingPassword(false);
        }
    };

    return (
        <section id="account" aria-labelledby="account-heading" className="mt-6 scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-notebook sm:p-6">
            <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow">
                    <UserRound className="h-5 w-5 text-ink" />
                </span>
                <div>
                    <h2 id="account-heading" className="font-lato text-xl font-semibold text-ink">Account settings</h2>
                    <p className="mt-1 text-sm text-ink-muted">Signed in as <span className="font-semibold text-ink">{email}</span></p>
                </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <form onSubmit={handleEmailChange} className="rounded-xl border border-line p-5" aria-labelledby="change-email-heading">
                    <h3 id="change-email-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
                        <Mail className="h-4 w-4" /> Change email
                    </h3>
                    <label htmlFor="account-new-email" className="mt-4 block text-sm font-semibold text-ink">New email address</label>
                    <Input
                        id="account-new-email"
                        type="email"
                        autoComplete="email"
                        value={newEmail}
                        onChange={(event) => setNewEmail(event.target.value)}
                        disabled={isSavingEmail}
                        className="mt-2"
                        required
                    />
                    {emailError && <p role="alert" className="mt-3 text-sm text-error">{emailError}</p>}
                    {emailNotice && (
                        <p role="status" className="mt-3 rounded-xl border border-line-strong bg-yellow-tint p-3 text-sm leading-6 text-ink">
                            {emailNotice}
                        </p>
                    )}
                    <Button type="submit" variant="secondary" disabled={isSavingEmail} className="mt-4">
                        {isSavingEmail ? <Loader2 className="animate-spin" /> : <Mail />}
                        Send confirmation link
                    </Button>
                </form>

                {canUsePassword ? (
                    <form onSubmit={handlePasswordChange} className="rounded-xl border border-line p-5" aria-labelledby="change-password-heading">
                        <h3 id="change-password-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
                            <KeyRound className="h-4 w-4" /> Change password
                        </h3>
                        <label htmlFor="account-current-password" className="mt-4 block text-sm font-semibold text-ink">Current password</label>
                        <Input
                            id="account-current-password"
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            disabled={isSavingPassword}
                            className="mt-2"
                            required
                        />
                        <label htmlFor="account-new-password" className="mt-4 block text-sm font-semibold text-ink">New password</label>
                        <Input
                            id="account-new-password"
                            type="password"
                            autoComplete="new-password"
                            minLength={MIN_PASSWORD_LENGTH}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            disabled={isSavingPassword}
                            className="mt-2"
                            required
                        />
                        <label htmlFor="account-confirm-password" className="mt-4 block text-sm font-semibold text-ink">Confirm new password</label>
                        <Input
                            id="account-confirm-password"
                            type="password"
                            autoComplete="new-password"
                            minLength={MIN_PASSWORD_LENGTH}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            disabled={isSavingPassword}
                            className="mt-2"
                            required
                        />
                        {passwordError && <p role="alert" className="mt-3 text-sm text-error">{passwordError}</p>}
                        <Button type="submit" variant="secondary" disabled={isSavingPassword} className="mt-4">
                            {isSavingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
                            Change password
                        </Button>
                    </form>
                ) : (
                    <div className="rounded-xl border border-line p-5">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                            <KeyRound className="h-4 w-4" /> Password
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-ink-muted">
                            You sign in with Google, so this account has no password to change. Manage your
                            sign-in security in your Google account.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
