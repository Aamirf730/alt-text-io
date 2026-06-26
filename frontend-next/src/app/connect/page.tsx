"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/utils";
import { trackMarketingEvent } from "@/lib/analytics";
import { toast } from "sonner";
import {
    Key, Eye, EyeOff, CheckCircle, Loader2, ArrowRight,
    Shield, Zap, AlertTriangle
} from "lucide-react";

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
    const [error, setError] = useState("");
    const [statusMessage, setStatusMessage] = useState("Connecting your account...");
    const [hasCallbackTarget, setHasCallbackTarget] = useState(Boolean(queryCallbackUrl));

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        if (queryCallbackUrl) {
            setHasCallbackTarget(true);
            sessionStorage.setItem("alt_text_pro_callback", queryCallbackUrl);
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

    // Check if user is already logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setUser(session.user);
                    // Auto-fetch API key and redirect
                    await fetchKeyAndRedirect(session.access_token);
                }
            } catch (err) {
                console.error("Auth check error:", err);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    // Fetch API key from backend and redirect back to WordPress
    const fetchKeyAndRedirect = async (accessToken: string) => {
        setIsConnecting(true);
        setError("");
        setStatusMessage("Connecting your account...");

        try {
            const { callbackUrl, state, source, pluginVersion } = resolveConnectContext();
            setHasCallbackTarget(Boolean(callbackUrl));
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
                setConnected(true);
                setStatusMessage(
                    callbackUrl
                        ? "Sending your API key back to WordPress..."
                        : "Your API key is ready."
                );

                let postedToOpener = false;

                // 1. Try postMessage flow first (for popups)
                if (window.opener && !window.opener.closed) {
                    try {
                        window.opener.postMessage(
                            {
                                type: "ALT_TEXT_PRO_CONNECTED",
                                api_key: data.api_key,
                                state: state,
                            },
                            "*"
                        );
                        postedToOpener = true;
                    } catch (e) {
                        console.error("postMessage failed", e);
                    }
                }

                if (typeof window !== "undefined") {
                    sessionStorage.removeItem("alt_text_pro_callback");
                    sessionStorage.removeItem("alt_text_pro_state");
                    sessionStorage.removeItem("alt_text_pro_source");
                    sessionStorage.removeItem("alt_text_pro_plugin_version");
                }

                trackMarketingEvent("connect_completed", {
                    source: "wordpress_connect",
                    userId: data.user_id,
                    userEmail: user?.email,
                    properties: {
                        has_callback: Boolean(callbackUrl),
                        source: source || "direct",
                        plugin_version: pluginVersion || undefined,
                    },
                });

                const redirectToWordPress = () => {
                    try {
                        const url = new URL(callbackUrl);
                        if (url.protocol !== "http:" && url.protocol !== "https:") {
                            throw new Error("Invalid callback URL protocol");
                        }

                        url.searchParams.set("alt_text_pro_api_key", data.api_key);
                        if (state) {
                            url.searchParams.set("state", state);
                        }

                        window.location.href = url.toString();
                    } catch (urlError) {
                        setError("Invalid callback URL. Please copy the API key manually.");
                        setIsConnecting(false);
                    }
                };

                // 2. Keep redirect fallback even if postMessage was posted.
                if (callbackUrl) {
                    if (postedToOpener) {
                        setStatusMessage("Connected. Closing this window, or redirecting back to WordPress if needed...");
                        setTimeout(() => {
                            try {
                                window.close();
                            } catch (closeError) {
                                console.error("window.close failed", closeError);
                            }
                        }, 1500);
                        setTimeout(() => {
                            redirectToWordPress();
                        }, 2200);
                    } else {
                        setStatusMessage("Connected. Redirecting you back to WordPress...");
                        setTimeout(() => {
                            redirectToWordPress();
                        }, 1500);
                    }
                } else if (postedToOpener) {
                    setStatusMessage("Connected. Closing this window...");
                    setTimeout(() => {
                        try {
                            window.close();
                        } catch (closeError) {
                            console.error("window.close failed", closeError);
                            setIsConnecting(false);
                        }
                    }, 1500);
                } else {
                    // No callback, no opener - just stop loading
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
                        emailRedirectTo: window.location.href, // Redirect back to /connect after email confirmation
                        data: {
                            subscription_plan: "free",
                            credits_remaining: 30,
                        },
                    },
                });
            }

            if (result.error) {
                setError(result.error.message);
            } else if (result.data.user) {
                if (!isLogin && !result.data.session) {
                    trackMarketingEvent("signup_created", {
                        source: "wordpress_connect",
                        userId: result.data.user.id,
                        userEmail: result.data.user.email,
                        properties: {
                            signup_method: "email",
                            source: "wordpress_plugin_connect",
                        },
                    });

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

                    // Logged in — fetch API key
                    setUser(result.data.user);
                    const session = result.data.session;
                    if (session) {
                        await fetchKeyAndRedirect(session.access_token);
                    }
                }
            }
        } catch (err: any) {
            setError("Authentication failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Google sign-in
    const handleGoogleAuth = async () => {
        setIsLoading(true);
        setError("");

        try {
            const { callbackUrl, state, source, pluginVersion } = resolveConnectContext();

            // Store state in sessionStorage so we can retrieve it after OAuth redirect
            if (state) sessionStorage.setItem("alt_text_pro_state", state);
            if (callbackUrl) sessionStorage.setItem("alt_text_pro_callback", callbackUrl);
            if (source) sessionStorage.setItem("alt_text_pro_source", source);
            if (pluginVersion) sessionStorage.setItem("alt_text_pro_plugin_version", pluginVersion);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: window.location.origin + "/connect" +
                        (callbackUrl ? `?callback_url=${encodeURIComponent(callbackUrl)}` : "") +
                        (state ? `${callbackUrl ? '&' : '?'}state=${encodeURIComponent(state)}` : "") +
                        (source ? `${callbackUrl || state ? '&' : '?'}source=${encodeURIComponent(source)}` : "") +
                        (pluginVersion ? `${callbackUrl || state || source ? '&' : '?'}plugin_version=${encodeURIComponent(pluginVersion)}` : ""),
                    queryParams: {
                        access_type: "offline",
                        prompt: "consent",
                    },
                },
            });

            if (error) throw error;
            if (data.url) window.location.href = data.url;
        } catch (err: any) {
            setError("Google sign-in failed: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state while checking auth
    if (isCheckingAuth) {
        return (
            <div className="connect-page">
                <div className="connect-card">
                    <div className="connect-loading">
                        <Loader2 className="animate-spin" size={40} />
                        <p>Checking your account...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Connected successfully
    if (connected) {
        return (
            <div className="connect-page">
                <div className="connect-card">
                    <div className="connect-success">
                        <CheckCircle size={64} className="success-icon" />
                        <h2>Connected!</h2>
                        <p>
                            {hasCallbackTarget
                                ? statusMessage
                                : "Your API key has been sent to your plugin. You can close this window."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Connecting state (fetching API key)
    if (isConnecting) {
        return (
            <div className="connect-page">
                <div className="connect-card">
                    <div className="connect-loading">
                        <Loader2 className="animate-spin" size={40} />
                        <p>{statusMessage}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Main auth form
    return (
        <div className="connect-page">
            <div className="connect-card">
                {/* Header */}
                <div className="connect-header">
                    <img
                        src="/logo-alt-text-pro.png"
                        alt="Alt Text Pro"
                        className="connect-logo"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
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
                        <Zap size={14} /> 30 Free Credits
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
                <button
                    type="button"
                    className="connect-google-btn"
                    onClick={handleGoogleAuth}
                    disabled={isLoading}
                >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isLoading ? "Connecting..." : "Continue with Google"}</span>
                </button>

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
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
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
          width: 56px;
          height: 56px;
          margin-bottom: 16px;
          border-radius: 12px;
        }

        .connect-header h1 {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
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
          background: #f0fdf4;
          color: #16a34a;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid #bbf7d0;
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
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          color: #334155;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .connect-google-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .connect-google-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
          color: #334155;
          margin-bottom: 6px;
        }

        .connect-field input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          color: #0f172a;
          background: #f8fafc;
          transition: border-color 0.2s;
          outline: none;
          box-sizing: border-box;
        }

        .connect-field input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
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
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 4px;
        }

        .connect-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
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
          color: #6366f1;
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
          color: #16a34a;
          margin-bottom: 16px;
        }

        .connect-success h2 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px;
        }

        .connect-success p {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
        </div>
    );
}

export default function ConnectPage() {
    return (
        <Suspense
            fallback={
                <div style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                }}>
                    <div style={{
                        background: "#ffffff",
                        borderRadius: "20px",
                        padding: "60px 40px",
                        textAlign: "center",
                        color: "#64748b",
                    }}>
                        Loading...
                    </div>
                </div>
            }
        >
            <ConnectPageContent />
        </Suspense>
    );
}
