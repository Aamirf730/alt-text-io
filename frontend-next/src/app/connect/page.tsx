"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/utils";
import { trackMarketingEvent } from "@/lib/analytics";
import { toast } from "sonner";
import GoogleIdentityButton from "@/components/GoogleIdentityButton";
import "./connect-states.css";
import {
    Key, Eye, EyeOff, CheckCircle, Loader2, ArrowRight,
    Shield, Zap, AlertTriangle, Copy
} from "lucide-react";

type CallbackTarget = {
    origin: string;
    host: string;
};

const CONNECT_ACK_MINIMUM_VERSION = [1, 7, 11] as const;
const PENDING_SIGNUP_KEY = "alt_text_pro_pending_signup";
const PENDING_SIGNUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function rememberPendingSignup(emailAddress: string) {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
        email: emailAddress.trim().toLowerCase(),
        createdAt: Date.now(),
    }));
}

function consumePendingSignup(emailAddress: string) {
    if (typeof window === "undefined") return false;

    const raw = window.localStorage.getItem(PENDING_SIGNUP_KEY);
    window.localStorage.removeItem(PENDING_SIGNUP_KEY);
    if (!raw) return false;

    try {
        const pending = JSON.parse(raw);
        const isRecent = Number.isFinite(pending.createdAt)
            && Date.now() - pending.createdAt <= PENDING_SIGNUP_MAX_AGE_MS;
        const isSameAccount = typeof pending.email === "string"
            && pending.email === emailAddress.trim().toLowerCase();
        return isRecent && isSameAccount;
    } catch {
        return false;
    }
}

function hasWordPressConnectContext(queryCallbackUrl: string, querySource: string) {
    if (queryCallbackUrl || querySource === "wordpress_plugin") return true;
    if (typeof window === "undefined") return false;

    return Boolean(
        window.sessionStorage.getItem("alt_text_pro_callback")
        || window.sessionStorage.getItem("alt_text_pro_source") === "wordpress_plugin"
    );
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
    const [statusMessage, setStatusMessage] = useState("Connecting your account...");
    const [hasCallbackTarget, setHasCallbackTarget] = useState(Boolean(queryCallbackUrl));
    const [callbackTarget, setCallbackTarget] = useState<CallbackTarget | null>(null);
    const [pendingAccessToken, setPendingAccessToken] = useState("");
    const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
    const [manualApiKey, setManualApiKey] = useState("");
    const [isApiKeyCopied, setIsApiKeyCopied] = useState(false);
    const [isManualApiKeyVisible, setIsManualApiKeyVisible] = useState(false);
    const [signupRedirectUrl, setSignupRedirectUrl] = useState("");

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const validCallbackUrl = queryCallbackUrl && getCallbackTarget(queryCallbackUrl)
            ? queryCallbackUrl
            : "";
        const redirectUrl = new URL("/connect", window.location.origin);
        if (validCallbackUrl) redirectUrl.searchParams.set("callback_url", validCallbackUrl);
        if (queryState) redirectUrl.searchParams.set("state", queryState);
        if (querySource) redirectUrl.searchParams.set("source", querySource);
        if (queryPluginVersion) redirectUrl.searchParams.set("plugin_version", queryPluginVersion);
        setSignupRedirectUrl(redirectUrl.toString());

        if (validCallbackUrl) {
            setHasCallbackTarget(true);
            sessionStorage.setItem("alt_text_pro_callback", validCallbackUrl);
        } else if (queryCallbackUrl) {
            setHasCallbackTarget(false);
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

    const clearConnectContext = () => {
        if (typeof window === "undefined") {
            return;
        }

        sessionStorage.removeItem("alt_text_pro_callback");
        sessionStorage.removeItem("alt_text_pro_state");
        sessionStorage.removeItem("alt_text_pro_source");
        sessionStorage.removeItem("alt_text_pro_plugin_version");
    };

    const showManualRecovery = (apiKey: string, message: string) => {
        clearConnectContext();
        setManualApiKey(apiKey);
        setIsApiKeyCopied(false);
        setIsManualApiKeyVisible(false);
        setIsAwaitingConfirmation(false);
        setCallbackTarget(null);
        setHasCallbackTarget(false);
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

    const prepareAuthenticatedConnection = async (accessToken: string) => {
        const { callbackUrl } = resolveConnectContext();
        const target = getCallbackTarget(callbackUrl);

        if (callbackUrl && !target) {
            setError("Invalid callback destination. Please start the connection again from your WordPress plugin.");
            setIsConnecting(false);
            return;
        }

        if (target) {
            setCallbackTarget(target);
            setPendingAccessToken(accessToken);
            setHasCallbackTarget(true);
            setStatusMessage(`Your account is ready. Confirm that ${target.host} is your WordPress site.`);
            setIsAwaitingConfirmation(true);
            return;
        }

        await fetchKeyAndRedirect(accessToken);
    };

    const confirmConnection = async () => {
        if (!pendingAccessToken || !callbackTarget) {
            return;
        }

        setIsAwaitingConfirmation(false);
        await fetchKeyAndRedirect(pendingAccessToken);
    };

    const cancelConnection = () => {
        clearConnectContext();
        setPendingAccessToken("");
        setCallbackTarget(null);
        setIsAwaitingConfirmation(false);
        setHasCallbackTarget(false);
        setError("Connection cancelled. No API key was sent.");
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
                    setUser(session.user);
                    authenticatedEmailRef.current = session.user.email || null;
                    // Clear a pending signup marker left by the email-confirmation
                    // flow, but do not treat a routine authenticated visit as a
                    // new signup.
                    consumePendingSignup(session.user.email || "");
                    await prepareAuthenticatedConnection(session.access_token);
                }
            } catch (err) {
                console.error("Auth check error:", err);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
        // Auth bootstrap intentionally runs once for the initial connect context.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch the API key and deliver it only to the verified opener window.
    const fetchKeyAndRedirect = async (accessToken: string) => {
        setIsConnecting(true);
        setError("");
        setStatusMessage("Connecting your account...");

        try {
            const { callbackUrl, state, source, pluginVersion } = resolveConnectContext();
            const requiresConnectAcknowledgement = pluginSupportsConnectAcknowledgement(pluginVersion);
            const target = getCallbackTarget(callbackUrl);
            if (callbackUrl && !target) {
                throw new Error("Invalid callback destination. Please start the connection again from your WordPress plugin.");
            }
            setHasCallbackTarget(Boolean(target));
            const apiBase = getApiBase();
            const response = await fetch(`${apiBase}/get-api-key`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch API key");
            }

            const data = await response.json();

            if (data.success && data.api_key) {
                if (target && (!window.opener || window.opener.closed)) {
                    showManualRecovery(
                        data.api_key,
                        "The WordPress window closed before the connection could be confirmed.",
                    );
                    return;
                }

                setStatusMessage(
                    target
                        ? "Sending your API key back to WordPress..."
                        : "Your API key is ready."
                );

                if (target) {
                    const requestId = createConnectRequestId();
                    if (requiresConnectAcknowledgement) {
                        try {
                            // Newer plugins acknowledge only after saving the key.
                            await sendKeyAndWaitForAcknowledgement(target, data.api_key, state, requestId);
                        } catch (deliveryError) {
                            console.error("Connect acknowledgement failed", deliveryError);
                            showManualRecovery(
                                data.api_key,
                                "We could not confirm that WordPress saved your key. You can copy it below and finish manually.",
                            );
                            return;
                        }
                    } else if (!sendKeyToOpener(target, data.api_key, state, requestId)) {
                        // Older plugins do not send acknowledgements, so retain
                        // the legacy post-and-assume-success behavior for them.
                        showManualRecovery(
                            data.api_key,
                            "The WordPress window closed before the connection could be confirmed.",
                        );
                        return;
                    }
                }

                setConnected(true);

                clearConnectContext();

                trackMarketingEvent("connect_completed", {
                    source: "wordpress_connect",
                    userId: data.user_id,
                    userEmail: authenticatedEmailRef.current,
                    properties: {
                        has_callback: Boolean(callbackUrl),
                        source: source || "direct",
                        plugin_version: pluginVersion || undefined,
                    },
                });

                if (target) {
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
                } else {
                    // Direct visits do not deliver the key to an opener.
                    setIsConnecting(false);
                }
            } else {
                throw new Error("No API key returned");
            }
        } catch (err: any) {
            console.error("Connect error:", err);
            setError(err.message || "Failed to connect. Please try again.");
            setIsConnecting(false);
        }
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
                        emailRedirectTo: signupRedirectUrl || window.location.href,
                        data: {
                            subscription_plan: "free",
                            credits_remaining: 165,
                        },
                    },
                });
            }

            if (result.error) {
                setError(result.error.message);
            } else if (result.data.user) {
                if (!isLogin && !result.data.session) {
                    rememberPendingSignup(result.data.user.email || "");

                    // Sign up — needs email confirmation
                    setError("");
                    toast.success(
                        "Account created! Please check your email to confirm, then come back here."
                    );
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
                    setUser(result.data.user);
                    authenticatedEmailRef.current = result.data.user.email || null;
                    const session = result.data.session;
                    if (session) {
                        await prepareAuthenticatedConnection(session.access_token);
                    }
                }
            }
        } catch (err: any) {
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

        setUser(session.user);
        authenticatedEmailRef.current = session.user.email || null;
        if (hasWordPressConnectContext(queryCallbackUrl, querySource)) {
            trackMarketingEvent("signup_created", {
                source: "wordpress_connect",
                properties: {
                    signup_method: "google",
                    source: "wordpress_plugin_connect",
                },
            });
        }
        await prepareAuthenticatedConnection(session.access_token);
    };

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

    if (isAwaitingConfirmation && callbackTarget) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-confirmation">
                        <Shield size={52} className="confirmation-icon" />
                        <h2>Confirm WordPress connection</h2>
                        <p>Your account is signed in. Send your API key to this WordPress site?</p>
                        <div className="confirmation-target">{callbackTarget.host}</div>
                        <p className="confirmation-note">
                            Continue only if you recognize this site. The key will be sent only to this site and will not be placed in a URL.
                        </p>
                        {error && (
                            <div className="connect-error">
                                <AlertTriangle size={16} />
                                <span>{error}</span>
                            </div>
                        )}
                        <button type="button" className="connect-submit-btn" onClick={confirmConnection}>
                            Send API Key to {callbackTarget.host}
                        </button>
                        <button type="button" className="connect-cancel-btn" onClick={cancelConnection}>
                            Cancel
                        </button>
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
                            <Image src="/logo-alt-text-pro.png" alt="" width={40} height={40} className="recovery-brand-logo" />
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
                        {error && (
                            <div className="connect-error">
                                <AlertTriangle size={16} />
                                <span>{error}</span>
                            </div>
                        )}
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

    // Connected successfully
    if (connected) {
        return (
            <main className="connect-page">
                <div className="connect-card">
                    <div className="connect-success">
                        <CheckCircle size={64} className="success-icon" />
                        <h2>Connected!</h2>
                        <p>
                            {hasCallbackTarget
                                ? statusMessage
                                : "Your API key is ready. You can close this window."}
                        </p>
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
                    <div className="connect-error">
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
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

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
        .connect-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #000000 0%, #222222 50%, #000000 100%);
          padding: 20px;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .connect-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 40px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
        }

        .connect-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .connect-logo {
          display: block;
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          border-radius: 12px;
        }

        .connect-header h1 {
          font-size: 22px;
          font-weight: 700;
          color: #000000;
          margin: 0 0 6px 0;
        }

        .connect-subtitle {
          font-size: 14px;
          color: #64748b;
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
          display: flex;
          align-items: center;
          gap: 4px;
          background: #FFF9C4;
          color: #000000;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid #FEE11C;
        }

        .connect-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fef2f2;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 16px;
          border: 1px solid #fecaca;
        }

        .connect-google-btn {
          width: 100%;
          border-radius: 10px;
        }

        .connect-divider {
          display: flex;
          align-items: center;
          margin: 20px 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .connect-divider::before,
        .connect-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .connect-divider span {
          padding: 0 12px;
        }

        .connect-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .connect-field label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #000000;
          margin-bottom: 6px;
        }

        .connect-field input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          color: #000000;
          background: #FFFFFF;
          transition: border-color 0.2s;
          outline: none;
          box-sizing: border-box;
        }

        .connect-field input:focus {
          border-color: #FEE11C;
          box-shadow: 0 0 0 3px rgba(254, 225, 28, 0.28);
        }

        .connect-password-wrapper {
          position: relative;
        }

        .connect-password-wrapper input {
          padding-right: 44px;
        }

        .connect-password-toggle {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
        }

        .connect-password-toggle:hover {
          color: #64748b;
        }

        .connect-submit-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: #FEE11C;
          color: #000000;
          border: 1px solid #FEE11C;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 4px;
        }

        .connect-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #000000;
          color: #FFFFFF;
          border-color: #000000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
        }

        .connect-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .connect-toggle {
          text-align: center;
          margin-top: 20px;
          font-size: 13px;
          color: #64748b;
        }

        .connect-toggle button {
          background: none;
          border: none;
          color: #000000;
          font-weight: 600;
          cursor: pointer;
          margin-left: 4px;
          font-size: 13px;
        }

        .connect-toggle button:hover {
          text-decoration: underline;
        }

        .connect-loading {
          text-align: center;
          padding: 40px 0;
        }

        .connect-loading p {
          margin-top: 16px;
          color: #64748b;
          font-size: 14px;
        }

        .connect-success {
          text-align: center;
          padding: 40px 0;
        }

        .success-icon {
          color: #000000;
          margin-bottom: 16px;
        }

        .connect-success h2 {
          font-size: 24px;
          font-weight: 700;
          color: #000000;
          margin: 0 0 8px;
        }

        .connect-success p {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        .connect-confirmation {
          text-align: center;
          padding: 24px 0 8px;
        }

        .confirmation-icon {
          color: #000000;
          margin-bottom: 16px;
        }

        .connect-confirmation h2 {
          font-size: 22px;
          font-weight: 700;
          color: #000000;
          margin: 0 0 10px;
        }

        .connect-confirmation p {
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
          margin: 0 auto 16px;
        }

        .confirmation-target {
          overflow-wrap: anywhere;
          background: #FFF9C4;
          border: 1px solid #FEE11C;
          border-radius: 10px;
          color: #000000;
          font-size: 16px;
          font-weight: 700;
          padding: 12px 14px;
          margin: 0 0 14px;
        }

        .connect-confirmation .confirmation-note {
          font-size: 12px;
          margin-bottom: 20px;
        }

        .connect-cancel-btn {
          width: 100%;
          background: transparent;
          border: 0;
          color: #000000;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          margin-top: 14px;
          padding: 8px;
        }

        .connect-cancel-btn:hover {
          text-decoration: underline;
        }

        .connect-recovery {
          text-align: center;
          padding: 24px 0 8px;
        }

        .recovery-icon {
          color: #000000;
          margin-bottom: 16px;
        }

        .connect-recovery h2 {
          font-size: 22px;
          font-weight: 700;
          color: #000000;
          margin: 0 0 10px;
        }

        .connect-recovery p {
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
          margin: 0 auto 16px;
        }

        .connect-recovery .recovery-note {
          font-size: 13px;
          margin-bottom: 20px;
        }

        .recovery-key-label {
          display: block;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 7px;
          text-align: left;
        }

        .recovery-key-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }

        .recovery-key-row input {
          min-width: 0;
          flex: 1;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          color: #334155;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          padding: 11px 12px;
        }

        .recovery-copy-btn {
          flex: 0 0 auto;
          background: #000000;
          border: 0;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          padding: 0 15px;
        }

        .recovery-copy-btn:hover {
          background: #222222;
        }

        .connect-recovery .recovery-help {
          color: #64748b;
          font-size: 12px;
          margin-top: 16px;
          margin-bottom: 0;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
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
