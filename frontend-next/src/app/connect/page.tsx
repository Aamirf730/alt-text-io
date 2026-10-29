"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getAccessToken, supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/utils";
import { trackMarketingEvent } from "@/lib/analytics";
import { EXISTING_ACCOUNT_MESSAGE, isExistingAccountSignUp, isNewlyCreatedUser } from "@/lib/auth-redirect";
import { getResendWaitSeconds, resendButtonLabel, useResendCooldown } from "@/lib/resend-cooldown";
import { getFriendlyAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";
import GoogleIdentityButton from "@/components/GoogleIdentityButton";
import "./connect-states.css";
import {
    Key, Eye, EyeOff, CheckCircle, Loader2, ArrowRight,
    Shield, Zap, AlertTriangle, Copy, Mail, RefreshCw, LayoutDashboard
} from "lucide-react";

type CallbackTarget = {
    origin: string;
    host: string;
};

// "send" delivers the key to the WordPress opener; "manual" shows it for copying.
type KeyDeliveryMode = "send" | "manual";

const CONNECT_ACK_MINIMUM_VERSION = [1, 7, 11] as const;
// While a new account waits for email confirmation, check for a session this
// often. The confirmation link usually opens in another tab, which shares
// localStorage with this popup.
const CONFIRMATION_POLL_INTERVAL_MS = 3000;

class KeyRotationRequiredError extends Error {}

function hasWordPressConnectContext(queryCallbackUrl: string, querySource: string) {
    if (queryCallbackUrl || querySource === "wordpress_plugin") return true;
    if (typeof window === "undefined") return false;

    return Boolean(
        window.sessionStorage.getItem("alt_text_pro_callback")
        || window.sessionStorage.getItem("alt_text_pro_source") === "wordpress_plugin"
    );
}

/** True when this window was opened by a WordPress page that is still open. */
function hasLiveOpener() {
    if (typeof window === "undefined") return false;
    try {
        return Boolean(window.opener && !window.opener.closed);
    } catch {
        return false;
    }
}

const pluginSupportsConnectAcknowledgement = (version: string) => {
    const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        return false;
    }

    const current = match.slice(1, 4).map(Number);
    for (let index = 0; index < CONNECT_ACK_MINIMUM_VERSION.length; index += 1) {
        if (current[index] > CONNECT_ACK_MINIMUM_VERSION[index]) {
            return true;
        }
        if (current[index] < CONNECT_ACK_MINIMUM_VERSION[index]) {
            return false;
        }
    }

    return true;
};

const getCallbackTarget = (callbackUrl: string): CallbackTarget | null => {
    if (!callbackUrl) {
        return null;
    }

    try {
        const url = new URL(callbackUrl);
        if (
            !["http:", "https:"].includes(url.protocol) ||
            !url.hostname ||
            url.username ||
            url.password
        ) {
            return null;
        }

        return {
            origin: url.origin,
            host: url.host,
        };
    } catch {
        return null;
    }
};

function ConnectPageContent() {
    const searchParams = useSearchParams();
    const queryCallbackUrl = searchParams.get("callback_url") || "";
    const queryState = searchParams.get("state") || "";
    const querySource = searchParams.get("source") || "";
    const queryPluginVersion = searchParams.get("plugin_version") || "";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connected, setConnected] = useState(false);
    const [user, setUser] = useState<any>(null);
    const authenticatedEmailRef = useRef<string | null>(null);
    const [error, setError] = useState("");
    // Shown after sign-up, or when sign-in fails because the email is unconfirmed.
    const [canResendConfirmation, setCanResendConfirmation] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Connecting your account...");
    const [callbackTarget, setCallbackTarget] = useState<CallbackTarget | null>(null);
    const [pendingAccessToken, setPendingAccessToken] = useState("");
    const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
    const [manualApiKey, setManualApiKey] = useState("");
    const [isApiKeyCopied, setIsApiKeyCopied] = useState(false);
    const [isManualApiKeyVisible, setIsManualApiKeyVisible] = useState(false);
    // Email address of a new account waiting for its confirmation link.
    const [pendingSignupEmail, setPendingSignupEmail] = useState("");
    const { secondsLeft: resendSecondsLeft, startCooldown: startResendCooldown } = useResendCooldown();
    // The account was confirmed in a tab with no WordPress opener.
    const [isDetachedFromWordPress, setIsDetachedFromWordPress] = useState(false);
    // Browsers only let a page close a tab that a script opened, so a tab
    // opened from the confirmation email usually stays open.
    const [closeTabBlocked, setCloseTabBlocked] = useState(false);
    // A signed-in visit without a WordPress callback (direct visit or after cancel).
    const [hasNoConnectRequest, setHasNoConnectRequest] = useState(false);
    const [connectionCancelled, setConnectionCancelled] = useState(false);
    // get-api-key answered 409 api_key_rotation_required.
    const [rotationMode, setRotationMode] = useState<KeyDeliveryMode | null>(null);
    const [rotationMessage, setRotationMessage] = useState("");
    const handoffStartedRef = useRef(false);
    const connectStartedTrackedRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const validCallbackUrl = queryCallbackUrl && getCallbackTarget(queryCallbackUrl)
            ? queryCallbackUrl
            : "";

        if (validCallbackUrl) {
            sessionStorage.setItem("alt_text_pro_callback", validCallbackUrl);
        } else if (queryCallbackUrl) {
            sessionStorage.removeItem("alt_text_pro_callback");
            setError("Invalid callback destination. Please start the connection again from your WordPress plugin.");
        }

        if (queryState) {
            sessionStorage.setItem("alt_text_pro_state", queryState);
        }

        if (querySource) {
            sessionStorage.setItem("alt_text_pro_source", querySource);
        }

        if (queryPluginVersion) {
            sessionStorage.setItem("alt_text_pro_plugin_version", queryPluginVersion);
        }

        if (queryCallbackUrl || queryState || querySource || queryPluginVersion) {
            window.history.replaceState({}, document.title, "/connect");
        }
    }, [queryCallbackUrl, queryState, querySource, queryPluginVersion]);

    useEffect(() => {
        // Clearing the address bar re-renders with empty params; count the visit once.
        if (connectStartedTrackedRef.current) return;
        connectStartedTrackedRef.current = true;
        trackMarketingEvent("connect_started", {
            source: "wordpress_connect",
            properties: {
                has_callback: Boolean(queryCallbackUrl),
                source: querySource || "direct",
                plugin_version: queryPluginVersion || undefined,
            },
        });
    }, [queryCallbackUrl, querySource, queryPluginVersion]);

    const resolveConnectContext = () => {
        let resolvedCallbackUrl = queryCallbackUrl;
        let resolvedState = queryState;
        let resolvedSource = querySource;
        let resolvedPluginVersion = queryPluginVersion;

        if (typeof window !== "undefined") {
            const storedCallbackUrl = sessionStorage.getItem("alt_text_pro_callback") || "";
            const storedState = sessionStorage.getItem("alt_text_pro_state") || "";
            const storedSource = sessionStorage.getItem("alt_text_pro_source") || "";
            const storedPluginVersion = sessionStorage.getItem("alt_text_pro_plugin_version") || "";

            if (!resolvedCallbackUrl && storedCallbackUrl) {
                resolvedCallbackUrl = storedCallbackUrl;
            }

            if (!resolvedState && storedState) {
                resolvedState = storedState;
            }

            if (!resolvedSource && storedSource) {
                resolvedSource = storedSource;
            }

            if (!resolvedPluginVersion && storedPluginVersion) {
                resolvedPluginVersion = storedPluginVersion;
            }
        }

        return {
            callbackUrl: resolvedCallbackUrl,
            state: resolvedState,
            source: resolvedSource,
            pluginVersion: resolvedPluginVersion,
        };
    };

    // The confirmation email links back to /connect with the same WordPress
    // context, so the confirmation tab knows which site it belongs to. Built
    // when needed because the address bar has already been cleared.
    const buildSignupRedirectUrl = () => {
        const { callbackUrl, state, source, pluginVersion } = resolveConnectContext();
        const redirectUrl = new URL("/connect", window.location.origin);
        const validCallbackUrl = callbackUrl && getCallbackTarget(callbackUrl) ? callbackUrl : "";
        if (validCallbackUrl) redirectUrl.searchParams.set("callback_url", validCallbackUrl);
        if (state) redirectUrl.searchParams.set("state", state);
        if (source) redirectUrl.searchParams.set("source", source);
        if (pluginVersion) redirectUrl.searchParams.set("plugin_version", pluginVersion);
        return redirectUrl.toString();
    };

    const clearConnectContext = () => {
        if (typeof window === "undefined") {
            return;
        }

        sessionStorage.removeItem("alt_text_pro_callback");
        sessionStorage.removeItem("alt_text_pro_state");
        sessionStorage.removeItem("alt_text_pro_source");
        sessionStorage.removeItem("alt_text_pro_plugin_version");
    };

    const resetResultStates = () => {
        setIsAwaitingConfirmation(false);
        setIsDetachedFromWordPress(false);
        setHasNoConnectRequest(false);
        setConnectionCancelled(false);
        setRotationMode(null);
        setRotationMessage("");
    };

    const showManualRecovery = (apiKey: string, message: string) => {
        clearConnectContext();
        resetResultStates();
        setManualApiKey(apiKey);
        setIsApiKeyCopied(false);
        setIsManualApiKeyVisible(false);
        setCallbackTarget(null);
        setConnected(false);
        setIsConnecting(false);
        setError("");
        setStatusMessage(message);
    };

    const createConnectRequestId = () => {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }

        return `atp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    };

    const sendKeyToOpener = (
        target: CallbackTarget,
        apiKey: string,
        state: string,
        requestId: string,
    ) => {
        const opener = window.opener;
        if (!opener || opener.closed) {
            return false;
        }

        try {
            opener.postMessage(
                {
                    type: "ALT_TEXT_PRO_CONNECTED",
                    api_key: apiKey,
                    state,
                    request_id: requestId,
                },
                target.origin,
            );
            return true;
        } catch (error) {
            console.error("Connect message failed", error);
            return false;
        }
    };

    const sendKeyAndWaitForAcknowledgement = (
        target: CallbackTarget,
        apiKey: string,
        state: string,
        requestId: string,
    ) => new Promise<void>((resolve, reject) => {
        const opener = window.opener;
        if (!opener || opener.closed) {
            reject(new Error("The WordPress window is no longer available."));
            return;
        }

        let settled = false;

        const cleanup = () => {
            window.removeEventListener("message", handleAcknowledgement);
            window.clearTimeout(timeoutId);
            window.clearTimeout(waitingMessageTimeoutId);
        };

        const finish = (callback: () => void) => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();
            callback();
        };

        const handleAcknowledgement = (event: MessageEvent) => {
            if (event.source !== opener || event.origin !== target.origin) {
                return;
            }

            const data = event.data;
            if (
                !data ||
                data.type !== "ALT_TEXT_PRO_CONNECT_ACK" ||
                data.request_id !== requestId ||
                data.state !== state
            ) {
                return;
            }

            if (data.success) {
                finish(resolve);
            } else {
                finish(() => reject(new Error(data.message || "WordPress could not save the API key.")));
            }
        };

        window.addEventListener("message", handleAcknowledgement);
        const timeoutId = window.setTimeout(() => {
            finish(() => reject(new Error("WordPress did not confirm that it received the API key.")));
        }, 25000);
        const waitingMessageTimeoutId = window.setTimeout(() => {
            setStatusMessage("Still waiting for WordPress to confirm the key...");
        }, 4000);

        try {
            if (!sendKeyToOpener(target, apiKey, state, requestId)) {
                finish(() => reject(new Error("The API key could not be sent to WordPress.")));
            }
        } catch (error) {
            finish(() => reject(error instanceof Error ? error : new Error("The API key could not be sent to WordPress.")));
        }
    });

    // Decide what a signed-in visitor sees. A key is only ever fetched after
    // the visitor confirms the WordPress site (or asks to copy it manually).
    const prepareAuthenticatedConnection = async (accessToken: string) => {
        setPendingSignupEmail("");
        resetResultStates();
        const { callbackUrl } = resolveConnectContext();
        const target = getCallbackTarget(callbackUrl);

        if (callbackUrl && !target) {
            setError("Invalid callback destination. Please start the connection again from your WordPress plugin.");
            setIsConnecting(false);
            return;
        }

        if (!target) {
            // Direct visit: no WordPress site is waiting, so nothing is sent
            // and no connection is recorded.
            setHasNoConnectRequest(true);
            return;
        }

        setCallbackTarget(target);
        setPendingAccessToken(accessToken);

        if (!hasLiveOpener()) {
            // Typically the tab opened from the confirmation email. The
            // WordPress popup picks up the new session and finishes there.
            setIsDetachedFromWordPress(true);
            return;
        }

        setStatusMessage(`Your account is ready. Confirm that ${target.host} is your WordPress site.`);
        setIsAwaitingConfirmation(true);
    };

    const continueWithSession = async (session: Session) => {
        if (handoffStartedRef.current) return;
        handoffStartedRef.current = true;
        setUser(session.user);
        authenticatedEmailRef.current = session.user.email || null;
        setError("");
        await prepareAuthenticatedConnection(session.access_token);
    };
    const continueWithSessionRef = useRef(continueWithSession);
    useEffect(() => {
        continueWithSessionRef.current = continueWithSession;
    });

    const closeThisTab = () => {
        window.close();
        window.setTimeout(() => {
            if (!window.closed) setCloseTabBlocked(true);
        }, 300);
    };

    const confirmConnection = async () => {
        if (!callbackTarget) {
            return;
        }

        setIsAwaitingConfirmation(false);
        await deliverApiKey("send");
    };

    const cancelConnection = () => {
        clearConnectContext();
        resetResultStates();
        setPendingAccessToken("");
        setCallbackTarget(null);
        setIsConnecting(false);
        setError("");
        setConnectionCancelled(true);
    };

    // Sign out here only; the WordPress context stays so the next account can connect.
    const switchAccount = async () => {
        setIsLoading(true);
        try {
            const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
            if (signOutError) {
                setError(signOutError.message);
                return;
            }
            resetResultStates();
            handoffStartedRef.current = false;
            setUser(null);
            authenticatedEmailRef.current = null;
            setPendingAccessToken("");
            setPassword("");
            setIsLogin(true);
            setError("");
        } catch {
            setError("Could not sign out. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const copyManualApiKey = async () => {
        try {
            await navigator.clipboard.writeText(manualApiKey);
            setIsApiKeyCopied(true);
        } catch {
            setError("Copy was blocked by your browser. Select the key and copy it manually.");
        }
    };

    // Check if user is already logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    await continueWithSessionRef.current(session);
                }
            } catch (err) {
                console.error("Auth check error:", err);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    // After an email sign-up, continue as soon as the account is confirmed.
    // The confirmation link normally opens in a new tab; Supabase shares the
    // new session through localStorage, announced by onAuthStateChange and
    // picked up by the poll if the broadcast is missed.
    useEffect(() => {
        if (!pendingSignupEmail) return;
        let active = true;

        const continueIfSignedIn = (session: Session | null) => {
            if (!active || !session?.user) return;
            void continueWithSessionRef.current(session);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
                // Supabase must not be awaited inside its own callback.
                window.setTimeout(() => continueIfSignedIn(session), 0);
            }
        });

        const pollTimer = window.setInterval(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                continueIfSignedIn(session);
            } catch {
                // Keep waiting; the next poll or the auth event will retry.
            }
        }, CONFIRMATION_POLL_INTERVAL_MS);

        return () => {
            active = false;
            subscription.unsubscribe();
            window.clearInterval(pollTimer);
        };
    }, [pendingSignupEmail]);

    const requestApiKey = async (rotate: boolean) => {
        const accessToken = (await getAccessToken()) || pendingAccessToken;
        if (!accessToken) {
            throw new Error("Your session expired. Sign in again to continue.");
        }

        const response = await fetch(`${getApiBase()}/get-api-key`, {
            method: rotate ? "POST" : "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            ...(rotate ? { body: JSON.stringify({ rotate: true }) } : {}),
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 409 && data.code === "api_key_rotation_required") {
            throw new KeyRotationRequiredError(
                data.error || "Your stored API key could not be recovered. Generate a new key to continue.",
            );
        }

        if (response.status === 401) {
            throw new Error("Your session expired. Sign in again to continue.");
        }

        if (!response.ok || !data.success || !data.api_key) {
            throw new Error(data.error || "Failed to fetch API key");
        }

        return { apiKey: String(data.api_key), userId: data.user_id as string | undefined };
    };

    // Fetch the API key and deliver it only to the verified opener window,
    // or show it for manual copying.
    const deliverApiKey = async (mode: KeyDeliveryMode, rotate = false) => {
        setIsConnecting(true);
        setError("");
        setRotationMode(null);
        setStatusMessage(rotate ? "Generating a new API key..." : "Connecting your account...");

        try {
            const { callbackUrl, state, source, pluginVersion } = resolveConnectContext();
            const requiresConnectAcknowledgement = pluginSupportsConnectAcknowledgement(pluginVersion);
            const target = getCallbackTarget(callbackUrl);
            if (mode === "send" && !target) {
                throw new Error("This connection request is no longer active. Start the connection again from your WordPress plugin.");
            }

            let key: { apiKey: string; userId?: string };
            try {
                key = await requestApiKey(rotate);
            } catch (keyError) {
                if (keyError instanceof KeyRotationRequiredError) {
                    setRotationMessage(keyError.message);
                    setRotationMode(mode);
                    setIsConnecting(false);
                    return;
                }
                throw keyError;
            }

            if (mode === "manual") {
                showManualRecovery(
                    key.apiKey,
                    "This tab can't hand the key to WordPress automatically. Copy it and paste it into the plugin settings.",
                );
                return;
            }

            if (!target || !hasLiveOpener()) {
                showManualRecovery(
                    key.apiKey,
                    "The WordPress window closed before the key could be sent. Copy the key below to finish.",
                );
                return;
            }

            setStatusMessage("Sending your API key back to WordPress...");

            const requestId = createConnectRequestId();
            if (requiresConnectAcknowledgement) {
                try {
                    // Newer plugins acknowledge only after saving the key.
                    await sendKeyAndWaitForAcknowledgement(target, key.apiKey, state, requestId);
                } catch (deliveryError) {
                    console.error("Connect acknowledgement failed", deliveryError);
                    showManualRecovery(
                        key.apiKey,
                        "We could not confirm that WordPress saved your key. You can copy it below and finish manually.",
                    );
                    return;
                }
            } else if (!sendKeyToOpener(target, key.apiKey, state, requestId)) {
                // Older plugins do not send acknowledgements, so retain
                // the legacy post-and-assume-success behavior for them.
                showManualRecovery(
                    key.apiKey,
                    "The WordPress window closed before the key could be sent. Copy the key below to finish.",
                );
                return;
            }

            setConnected(true);

            clearConnectContext();

            trackMarketingEvent("connect_completed", {
                source: "wordpress_connect",
                userId: key.userId,
                userEmail: authenticatedEmailRef.current,
                properties: {
                    has_callback: true,
                    source: source || "direct",
                    plugin_version: pluginVersion || undefined,
                },
            });

            setStatusMessage(
                requiresConnectAcknowledgement
                    ? "Connected. WordPress confirmed the key was saved. Closing this window..."
                    : "Key sent to WordPress. Closing this window..."
            );
            setTimeout(() => {
                try {
                    window.close();
                } catch (closeError) {
                    console.error("window.close failed", closeError);
                }
            }, 1500);
        } catch (err: any) {
            console.error("Connect error:", err);
            setError(err.message || "Failed to connect. Please try again.");
            setIsConnecting(false);
            if (mode === "send" && callbackTarget && hasLiveOpener()) {
                // Let the visitor retry from the confirm screen.
                setIsAwaitingConfirmation(true);
            }
        }
    };

    const handleForgotPassword = async () => {
        const normalizedEmail = email.trim();
        if (!normalizedEmail) {
            setError("Enter your email address first.");
            return;
        }

        setIsLoading(true);
        setError("");
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (resetError) {
                setError(getFriendlyAuthError(resetError.message));
                return;
            }
            toast.success("If an account exists for that email, a reset link is on its way. Come back here after you set a new password.");
        } catch {
            setError("Could not send the password reset email. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendConfirmation = async () => {
        const normalizedEmail = (pendingSignupEmail || email).trim();
        if (!normalizedEmail) {
            setError("Enter your email address first.");
            return;
        }

        setIsLoading(true);
        setError("");
        try {
            const { error: resendError } = await supabase.auth.resend({
                type: "signup",
                email: normalizedEmail,
                options: { emailRedirectTo: buildSignupRedirectUrl() },
            });
            if (resendError) {
                const waitSeconds = getResendWaitSeconds(resendError.message);
                if (waitSeconds) startResendCooldown(waitSeconds);
                setError(getFriendlyAuthError(resendError.message));
                return;
            }
            startResendCooldown();
            toast.success("We sent a new confirmation email. Open the link in it and this window will continue.");
        } catch {
            setError("Could not resend the confirmation email. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // "I've confirmed — continue": use a shared session if there is one,
    // otherwise sign in with the password just entered (confirmation may
    // have happened in another browser or on a phone).
    const handleConfirmedContinue = async () => {
        setIsLoading(true);
        setError("");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await continueWithSession(session);
                return;
            }

            if (!password) {
                setPendingSignupEmail("");
                setIsLogin(true);
                setError("Sign in with your new account to continue.");
                return;
            }

            const result = await supabase.auth.signInWithPassword({
                email: pendingSignupEmail || email,
                password,
            });
            if (result.error) {
                setError(
                    /email not confirmed/i.test(result.error.message)
                        ? `We haven't seen your confirmation yet. Open the link we sent to ${pendingSignupEmail || email}, then try again.`
                        : getFriendlyAuthError(result.error.message),
                );
                return;
            }
            if (result.data.session) {
                await continueWithSession(result.data.session);
            }
        } catch {
            setError("Could not check your confirmation. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const leaveConfirmationWait = () => {
        setPendingSignupEmail("");
        setIsLogin(true);
        setError("");
    };

    // Handle email/password authentication
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError("Please enter email and password");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            let result;

            if (isLogin) {
                result = await supabase.auth.signInWithPassword({ email, password });
            } else {
                result = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: buildSignupRedirectUrl(),
                    },
                });
            }

            if (result.error) {
                setError(getFriendlyAuthError(result.error.message));
                setCanResendConfirmation(isLogin && /email not confirmed/i.test(result.error.message));
            } else if (result.data.user) {
                if (!isLogin && isExistingAccountSignUp(result.data.user, Boolean(result.data.session))) {
                    // Supabase sends no email for an existing address.
                    setIsLogin(true);
                    setCanResendConfirmation(false);
                    setError(EXISTING_ACCOUNT_MESSAGE);
                } else if (!isLogin && !result.data.session) {
                    // Sign up — wait here for the email confirmation.
                    handoffStartedRef.current = false;
                    setCanResendConfirmation(true);
                    setError("");
                    setPendingSignupEmail(result.data.user.email || email.trim());
                    startResendCooldown();
                } else {
                    if (!isLogin) {
                        trackMarketingEvent("signup_created", {
                            source: "wordpress_connect",
                            userId: result.data.user.id,
                            userEmail: result.data.user.email,
                            properties: {
                                signup_method: "email",
                                source: "wordpress_plugin_connect",
                            },
                        });
                    }

                    // Logged in — require destination confirmation before fetching the API key.
                    const session = result.data.session;
                    if (session) {
                        handoffStartedRef.current = false;
                        await continueWithSession(session);
                    }
                }
            }
        } catch {
            setError("Authentication failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async () => {
        setError("");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            throw new Error("Google sign-in completed without a usable session.");
        }

        if (hasWordPressConnectContext(queryCallbackUrl, querySource) && isNewlyCreatedUser(session.user)) {
            trackMarketingEvent("signup_created", {
                source: "wordpress_connect",
                properties: {
                    signup_method: "google",
                    source: "wordpress_plugin_connect",
                },
            });
        }
        handoffStartedRef.current = false;
        await continueWithSession(session);
    };

    const accountEmail: string = user?.email || authenticatedEmailRef.current || "";

    const errorBanner = error ? (
        <div className="connect-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
        </div>
    ) : null;

    const signedInAccountRow = accountEmail ? (
        <div className="connect-account">
            <div className="connect-account-text">
                <p className="connect-account-label">Signed in as</p>
                <p className="connect-account-email">{accountEmail}</p>
            </div>
        </div>
    ) : null;

    // Loading state while checking auth
    if (isCheckingAuth) {
        return (
            <main className="connect-page" aria-busy="true">
                <div className="connect-card">
                    <div className="connect-loading">
                        <Loader2 className="animate-spin" size={40} />
                        <p>Checking your account...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (manualApiKey) {
        return (
            <main className="connect-page">
                <div className="connect-card connect-card-recovery">
                    <div className="connect-recovery">
                        <div className="recovery-brand">
                            <Image src="/brand/logo-mark.svg" alt="" width={32} height={32} className="recovery-brand-logo" unoptimized />
                            <span>Alt Text Pro</span>
                        </div>
                        <div className="recovery-icon-wrap" aria-hidden="true">
                            <Key size={24} />
                        </div>
                        <p className="recovery-eyebrow">Connection needs one final step</p>
                        <h2>Finish connecting manually</h2>
                        <div className="recovery-status" role="status">
                            <AlertTriangle size={18} aria-hidden="true" />
                            <span>{statusMessage}</span>
                        </div>
                        <p className="recovery-note">Your account is safe. If WordPress still shows as disconnected, use the key below to complete setup.</p>
                        <label className="recovery-key-label" htmlFor="manual-recovery-api-key">Your API key</label>
                        <div className="recovery-key-row">
                            <div className="recovery-key-field">
                                <input
                                    id="manual-recovery-api-key"
                                    type={isManualApiKeyVisible ? "text" : "password"}
                                    value={manualApiKey}
                                    readOnly
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-1p-ignore="true"
                                    onFocus={(event) => event.currentTarget.select()}
                                    aria-label="API key"
                                />
                                <button
                                    type="button"
                                    className="recovery-visibility-btn"
                                    onClick={() => setIsManualApiKeyVisible((visible) => !visible)}
                                    aria-label={isManualApiKeyVisible ? "Hide API key" : "Show API key"}
                                >
                                    {isManualApiKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <button type="button" className="recovery-copy-btn" onClick={copyManualApiKey}>
                                {isApiKeyCopied ? <CheckCircle size={17} /> : <Copy size={17} />}
                                <span>{isApiKeyCopied ? "Copied" : "Copy key"}</span>
                            </button>
                        </div>
                        {errorBanner}
                        <ol className="recovery-steps" aria-label="Manual connection steps">
                            <li><span>1</span><p>Return to your WordPress admin.</p></li>
                            <li><span>2</span><p>Open <strong>Alt Text Pro → Settings</strong>.</p></li>
                            <li><span>3</span><p>Paste the key and choose <strong>Save API Key</strong>.</p></li>
                        </ol>
                        <div className="recovery-security-note">
                            <Shield size={16} aria-hidden="true" />
                            <span>Keep this key private. It provides access to your Alt Text Pro credits.</span>
                        </div>
                        <button type="button" className="recovery-close-btn" onClick={() => window.close()}>
                            Close this window
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // Connected successfully (only reachable after a key was delivered to WordPress)
    if (connected) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-success">
                        <CheckCircle size={64} className="success-icon" />
                        <h2>Connected!</h2>
                        <p>{statusMessage}</p>
                    </div>
                </div>
            </main>
        );
    }

    // Connecting state (fetching API key)
    if (isConnecting) {
        return (
            <main className="connect-page" aria-busy="true">
                <div className="connect-card">
                    <div className="connect-loading">
                        <Loader2 className="animate-spin" size={40} />
                        <p>{statusMessage}</p>
                    </div>
                </div>
            </main>
        );
    }

    if (rotationMode) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-confirmation">
                        <RefreshCw size={52} className="confirmation-icon" />
                        <h2>Your API key needs to be replaced</h2>
                        <p>{rotationMessage}</p>
                        <div className="connect-warning" role="note">
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>
                                Generating a new key stops the old one immediately. Every other WordPress site that
                                uses the old key is disconnected until you reconnect it.
                            </span>
                        </div>
                        {errorBanner}
                        <button
                            type="button"
                            className="connect-submit-btn"
                            onClick={() => void deliverApiKey(rotationMode, true)}
                        >
                            {rotationMode === "send" && callbackTarget
                                ? `Generate new key and connect ${callbackTarget.host}`
                                : "Generate new key"}
                        </button>
                        <button type="button" className="connect-cancel-btn" onClick={cancelConnection}>
                            Cancel
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    if (pendingSignupEmail) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-confirmation" aria-live="polite">
                        <Mail size={52} className="confirmation-icon" />
                        <h2>Confirm your email</h2>
                        <p>We sent a confirmation link to</p>
                        <div className="connect-waiting-email">{pendingSignupEmail}</div>
                        <p className="connect-waiting-status" role="status">
                            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                            Waiting for you to confirm your email…
                        </p>
                        <p>
                            Open the link in the email. If you open it in this browser, this window
                            continues on its own, so keep it open. Opened it on your phone or another
                            device? Click &ldquo;I&apos;ve confirmed — continue&rdquo; below.
                        </p>
                        <p>Not there? Check your spam folder.</p>
                        <div className="connect-actions">
                            {errorBanner}
                            <button
                                type="button"
                                className="connect-submit-btn"
                                onClick={() => void handleConfirmedContinue()}
                                disabled={isLoading}
                            >
                                I&apos;ve confirmed — continue
                                <ArrowRight size={18} />
                            </button>
                            <button
                                type="button"
                                className="connect-secondary-btn"
                                onClick={() => void handleResendConfirmation()}
                                disabled={isLoading || resendSecondsLeft > 0}
                            >
                                {resendButtonLabel(resendSecondsLeft)}
                            </button>
                        </div>
                        <button type="button" className="connect-cancel-btn" onClick={leaveConfirmationWait}>
                            Use a different email
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    if (isAwaitingConfirmation && callbackTarget) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-confirmation">
                        <Shield size={52} className="confirmation-icon" />
                        <h2>Confirm WordPress connection</h2>
                        <p>Send your API key to this WordPress site?</p>
                        <div className="confirmation-target">{callbackTarget.host}</div>
                        <p className="confirmation-note">
                            Continue only if you recognize this site. The key will be sent only to this site and will not be placed in a URL.
                        </p>
                        {errorBanner}
                        <button type="button" className="connect-submit-btn" onClick={confirmConnection}>
                            Send API Key to {callbackTarget.host}
                        </button>
                        <button type="button" className="connect-cancel-btn" onClick={cancelConnection}>
                            Cancel
                        </button>
                        {signedInAccountRow}
                        <button
                            type="button"
                            className="connect-cancel-btn"
                            onClick={() => void switchAccount()}
                            disabled={isLoading}
                        >
                            Use a different account
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    if (isDetachedFromWordPress && callbackTarget) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-confirmation">
                        <CheckCircle size={52} className="confirmation-icon" />
                        <h2>Return to the WordPress connection window to finish</h2>
                        <p>
                            Your email is confirmed. Go back to the Alt Text Pro window you opened from
                            WordPress, where you&apos;ll confirm this site:
                        </p>
                        <div className="confirmation-target">{callbackTarget.host}</div>
                        <p className="confirmation-note">
                            If you confirmed in the same browser, that window continues on its own. If you
                            confirmed on your phone or another device, click &ldquo;I&apos;ve confirmed —
                            continue&rdquo; there.
                        </p>
                        {errorBanner}
                        {closeTabBlocked ? (
                            <p className="confirmation-note" role="status">You can close this tab now.</p>
                        ) : (
                            <button type="button" className="connect-submit-btn" onClick={closeThisTab}>
                                Close this tab
                            </button>
                        )}
                        <button
                            type="button"
                            className="connect-cancel-btn"
                            onClick={() => void deliverApiKey("manual")}
                        >
                            Closed that window? Show my API key to paste instead
                        </button>
                        {signedInAccountRow}
                    </div>
                </div>
            </main>
        );
    }

    if (connectionCancelled) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-confirmation">
                        <Shield size={52} className="confirmation-icon" />
                        <h2>Connection cancelled</h2>
                        <p>No API key was sent. To connect a site, start again from the Alt Text Pro plugin in WordPress.</p>
                        <div className="connect-actions">
                            <button type="button" className="connect-submit-btn" onClick={() => window.close()}>
                                Close this window
                            </button>
                            <Link href="/dashboard" className="connect-secondary-btn">
                                <LayoutDashboard size={18} aria-hidden="true" />
                                Open dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    if (hasNoConnectRequest && user) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-confirmation">
                        <Key size={52} className="confirmation-icon" />
                        <h2>No WordPress site is waiting</h2>
                        <p>
                            This page connects a site when you open it from the Alt Text Pro plugin. In WordPress,
                            go to <strong>Alt Text Pro</strong> and choose <strong>Connect</strong>. Your API key is
                            also in your dashboard if you prefer to paste it.
                        </p>
                        {signedInAccountRow}
                        {errorBanner}
                        <div className="connect-actions">
                            <Link href="/dashboard#settings" className="connect-submit-btn">
                                <LayoutDashboard size={18} aria-hidden="true" />
                                Open dashboard
                            </Link>
                            <button
                                type="button"
                                className="connect-secondary-btn"
                                onClick={() => void switchAccount()}
                                disabled={isLoading}
                            >
                                Use a different account
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // Main auth form
    return (
        <main className="connect-page">
            <div className="connect-card">
                {/* Header */}
                <div className="connect-header">
                    <Image
                        src="/logo-alt-text-pro.png"
                        alt="Alt Text Pro"
                        width={64}
                        height={64}
                        className="connect-logo"
                    />
                    <h1>Connect to Alt Text Pro</h1>
                    <p className="connect-subtitle">
                        {isLogin
                            ? "Sign in to connect your WordPress plugin"
                            : "Create a free account to get started"}
                    </p>
                </div>

                {/* Benefits pills */}
                <div className="connect-benefits">
                    <span className="benefit-pill">
                        <Zap size={14} /> 150 Free Credits
                    </span>
                    <span className="benefit-pill">
                        <Shield size={14} /> Secure Connection
                    </span>
                    <span className="benefit-pill">
                        <Key size={14} /> Auto-Setup
                    </span>
                </div>

                {/* Error message */}
                {error && (
                    <div className="connect-error" role="alert">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Google Auth Button */}
                <GoogleIdentityButton
                    text="continue_with"
                    disabled={isLoading}
                    onLoadingChange={setIsLoading}
                    onSuccess={handleGoogleSuccess}
                    onError={setError}
                    className="connect-google-btn"
                />

                {/* Divider */}
                <div className="connect-divider">
                    <span>or</span>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} className="connect-form">
                    <div className="connect-field">
                        <label htmlFor="connect-email">Email</label>
                        <input
                            id="connect-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="connect-field">
                        <label htmlFor="connect-password">Password</label>
                        <div className="connect-password-wrapper">
                            <input
                                id="connect-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isLogin ? "Your password" : "Create a password (min 6 chars)"}
                                required
                                minLength={6}
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="connect-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                aria-pressed={showPassword}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {(isLogin || canResendConfirmation) && (
                        <div className="connect-link-row">
                            {isLogin && (
                                <button type="button" className="connect-link-btn" onClick={() => void handleForgotPassword()} disabled={isLoading}>
                                    Forgot password?
                                </button>
                            )}
                            {canResendConfirmation && (
                                <button type="button" className="connect-link-btn" onClick={() => void handleResendConfirmation()} disabled={isLoading || resendSecondsLeft > 0}>
                                    {resendButtonLabel(resendSecondsLeft)}
                                </button>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="connect-submit-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>{isLogin ? "Signing in..." : "Creating account..."}</span>
                            </>
                        ) : (
                            <>
                                <span>{isLogin ? "Sign In & Connect" : "Create Account & Connect"}</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <p className="connect-terms">
                    By continuing you agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                </p>

                {/* Toggle login/signup */}
                <div className="connect-toggle">
                    <span>
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError("");
                        }}
                    >
                        {isLogin ? "Create one for free" : "Sign in"}
                    </button>
                </div>
            </div>

            <style jsx>{`
        /* Auth form only; shared states live in connect-states.css. */
        .connect-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 24px;
        }

        .connect-header :global(.connect-logo) {
          display: block;
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
        }

        .connect-header h1 {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.2;
          color: #3F3F46;
          margin: 0 0 8px 0;
        }

        .connect-subtitle {
          font-size: 14px;
          line-height: 1.5;
          color: #6B6B73;
          margin: 0;
        }

        .connect-benefits {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .benefit-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 28px;
          padding: 0 12px;
          background: #FFF3B0;
          color: #3F3F46;
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
          border-radius: 9999px;
        }

        .benefit-pill :global(svg) {
          flex: 0 0 14px;
        }

        .connect-page :global(.connect-google-btn) {
          width: 100%;
        }

        .connect-divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          color: #6B6B73;
          font-size: 13px;
        }

        .connect-divider::before,
        .connect-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #EFE3A3;
        }

        .connect-divider span {
          padding: 0 12px;
        }

        .connect-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .connect-field label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #3F3F46;
          margin-bottom: 8px;
        }

        .connect-field input {
          width: 100%;
          height: 44px;
          padding: 0 16px;
          border: 1px solid #E2CE5A;
          border-radius: 12px;
          font-size: 15px;
          color: #3F3F46;
          background: #FFFFFF;
          transition: border-color 0.15s;
          outline: none;
          box-sizing: border-box;
        }

        .connect-field input::placeholder {
          color: #6B6B73;
        }

        .connect-field input:focus {
          border-color: #F2CF00;
        }

        .connect-password-wrapper {
          position: relative;
        }

        .connect-password-wrapper input {
          padding-right: 48px;
        }

        .connect-password-toggle {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          background: none;
          border: none;
          border-radius: 8px;
          color: #6B6B73;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .connect-password-toggle:hover {
          background: #FFFBEA;
          color: #3F3F46;
        }

        .connect-submit-btn {
          background: #FEE11C;
          color: #3F3F46;
          margin-top: 4px;
        }

        .connect-toggle {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-top: 24px;
          font-size: 14px;
          color: #6B6B73;
        }

        .connect-terms {
          margin-top: 16px;
          text-align: center;
          font-size: 12px;
          line-height: 1.5;
          color: #6B6B73;
        }

        .connect-terms a {
          color: #3F3F46;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .connect-toggle button {
          background: none;
          border: none;
          padding: 0;
          color: #3F3F46;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
        </main>
    );
}

export default function ConnectPage() {
    return (
        <Suspense
            fallback={
                <main aria-busy="true" className="connect-page">
                    <div className="connect-card connect-card-fallback">
                        Loading...
                    </div>
                </main>
            }
        >
            <ConnectPageContent />
        </Suspense>
    );
}
