"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Loader2, LogOut, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

import { getAccessToken, supabase } from "@/lib/supabase";
import { getFriendlyAuthError } from "@/lib/auth-errors";
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
    const router = useRouter();
    const [newEmail, setNewEmail] = useState("");
    const [isSavingEmail, setIsSavingEmail] = useState(false);
    const [emailNotice, setEmailNotice] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Google-only accounts: a code sent to the account email proves it is
    // the owner before a password is added. It is an email sign-in code
    // checked with verifyOtp: Supabase ignores the re-authentication code for
    // sessions signed in within the last 24 hours, so any code would pass.
    const [setPasswordStep, setSetPasswordStep] = useState<"start" | "code" | "done">("start");
    const [reauthCode, setReauthCode] = useState("");
    const [isSendingCode, setIsSendingCode] = useState(false);

    const [isSigningOutEverywhere, setIsSigningOutEverywhere] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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
                `We sent a confirmation link to ${nextEmail}. If we also emailed ${email}, confirm from both addresses. Your sign-in email changes only after confirmation, and your receipts and billing emails follow the next time you open this dashboard.`,
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

    const sendPasswordCode = async () => {
        setPasswordError(null);
        setIsSendingCode(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: false },
            });
            if (error) {
                setPasswordError(getFriendlyAuthError(error.message));
                return;
            }
            setSetPasswordStep("code");
            toast.success(`We emailed a code to ${email}.`);
        } catch {
            setPasswordError("Could not send the code. Please try again.");
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleSetPassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordError(null);

        if (!reauthCode.trim()) {
            setPasswordError("Enter the code from the email.");
            return;
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setPasswordError(`Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("The passwords do not match.");
            return;
        }

        setIsSavingPassword(true);
        try {
            const { error: codeError } = await supabase.auth.verifyOtp({
                email,
                token: reauthCode.trim(),
                type: "email",
            });
            if (codeError) {
                setPasswordError("That code is wrong or has expired. Send a new one and try again.");
                return;
            }

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                setPasswordError(getFriendlyAuthError(error.message));
                return;
            }
            setReauthCode("");
            setNewPassword("");
            setConfirmPassword("");
            setSetPasswordStep("done");
            toast.success("Password set.");
        } catch {
            setPasswordError("Could not set your password. Please try again.");
        } finally {
            setIsSavingPassword(false);
        }
    };

    const downloadMyData = async () => {
        setIsExporting(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                toast.error("Please sign in again to download your data.");
                return;
            }
            const response = await fetch("/api/account/export", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                toast.error(data.error || "Could not prepare your data. Please try again later.");
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `alt-text-pro-data-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Could not prepare your data. Check your connection and try again.");
        } finally {
            setIsExporting(false);
        }
    };

    const signOutEverywhere = async () => {
        setIsSigningOutEverywhere(true);
        try {
            const { error } = await supabase.auth.signOut({ scope: "global" });
            if (error) {
                toast.error(`Sign out failed: ${error.message}`);
                setIsSigningOutEverywhere(false);
                return;
            }
            toast.success("Signed out on all devices.");
            router.push("/");
        } catch {
            toast.error("Sign out failed. Check your connection and try again.");
            setIsSigningOutEverywhere(false);
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
                    <form onSubmit={handleSetPassword} className="rounded-xl border border-line p-5" aria-labelledby="set-password-heading">
                        <h3 id="set-password-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
                            <KeyRound className="h-4 w-4" /> Set a password
                        </h3>
                        {setPasswordStep === "done" ? (
                            <p role="status" className="mt-3 rounded-xl border border-line-strong bg-yellow-tint p-3 text-sm leading-6 text-ink">
                                Password set. You can now sign in with {email} and this password, or with Google as before.
                            </p>
                        ) : (
                            <>
                                <p className="mt-3 text-sm leading-6 text-ink-muted">
                                    You sign in with Google. Add a password to also sign in with your email address,
                                    for example in the WordPress connect window. We email you a code first to check it&apos;s you.
                                </p>
                                {setPasswordStep === "start" ? (
                                    <Button type="button" variant="secondary" onClick={() => void sendPasswordCode()} disabled={isSendingCode} className="mt-4">
                                        {isSendingCode ? <Loader2 className="animate-spin" /> : <Mail />}
                                        Email me a code
                                    </Button>
                                ) : (
                                    <>
                                        <label htmlFor="account-reauth-code" className="mt-4 block text-sm font-semibold text-ink">Code from the email</label>
                                        <Input
                                            id="account-reauth-code"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={reauthCode}
                                            onChange={(event) => setReauthCode(event.target.value)}
                                            disabled={isSavingPassword}
                                            className="mt-2"
                                            required
                                        />
                                        <label htmlFor="account-set-password" className="mt-4 block text-sm font-semibold text-ink">New password</label>
                                        <Input
                                            id="account-set-password"
                                            type="password"
                                            autoComplete="new-password"
                                            minLength={MIN_PASSWORD_LENGTH}
                                            value={newPassword}
                                            onChange={(event) => setNewPassword(event.target.value)}
                                            disabled={isSavingPassword}
                                            className="mt-2"
                                            aria-describedby="account-set-password-hint"
                                            required
                                        />
                                        <p id="account-set-password-hint" className="mt-1 text-xs text-ink-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
                                        <label htmlFor="account-set-password-confirm" className="mt-4 block text-sm font-semibold text-ink">Confirm password</label>
                                        <Input
                                            id="account-set-password-confirm"
                                            type="password"
                                            autoComplete="new-password"
                                            minLength={MIN_PASSWORD_LENGTH}
                                            value={confirmPassword}
                                            onChange={(event) => setConfirmPassword(event.target.value)}
                                            disabled={isSavingPassword}
                                            className="mt-2"
                                            required
                                        />
                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                            <Button type="submit" variant="secondary" disabled={isSavingPassword}>
                                                {isSavingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
                                                Set password
                                            </Button>
                                            <button
                                                type="button"
                                                onClick={() => void sendPasswordCode()}
                                                disabled={isSendingCode}
                                                className="text-sm font-semibold text-ink underline-offset-4 hover:underline disabled:opacity-50"
                                            >
                                                Send a new code
                                            </button>
                                        </div>
                                    </>
                                )}
                                {passwordError && <p role="alert" className="mt-3 text-sm text-error">{passwordError}</p>}
                            </>
                        )}
                    </form>
                )}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                        <Download className="h-4 w-4" /> Download my data
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                        One file with your account, credits, generation history, payments and connected sites.
                        Receipts and invoices are in Billing &amp; receipts.
                    </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => void downloadMyData()} disabled={isExporting} className="shrink-0">
                    {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
                    Download (JSON)
                </Button>
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                        <LogOut className="h-4 w-4" /> Sign out of all devices
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                        Signs this account out of every browser, including this one. Connected WordPress sites keep working.
                    </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => void signOutEverywhere()} disabled={isSigningOutEverywhere} className="shrink-0">
                    {isSigningOutEverywhere ? <Loader2 className="animate-spin" /> : <LogOut />}
                    Sign out everywhere
                </Button>
            </div>
        </section>
    );
}
