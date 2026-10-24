"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

type GoogleIdentityButtonProps = {
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
  className?: string;
};

function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes));
}

async function hashNonce(nonce: string) {
  const encoded = new TextEncoder().encode(nonce);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function GoogleIdentityButton({
  onSuccess,
  onError,
  onLoadingChange,
  text = "continue_with",
  disabled = false,
  className = "",
}: GoogleIdentityButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onError, onSuccess]);

  useEffect(() => {
    onLoadingChange?.(isSigningIn);
  }, [isSigningIn, onLoadingChange]);

  const renderGoogleButton = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const container = containerRef.current;
    const googleIdentity = window.google?.accounts.id;

    if (!scriptReady || !container || !googleIdentity) return;
    if (!clientId) {
      onErrorRef.current("Google sign-in is temporarily unavailable. Please use email instead.");
      return;
    }

    const nonce = generateNonce();
    const hashedNonce = await hashNonce(nonce);

    googleIdentity.initialize({
      client_id: clientId,
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      ux_mode: "popup",
      callback: async (response) => {
        if (!response.credential) {
          onErrorRef.current("Google did not return a sign-in credential. Please try again.");
          return;
        }

        setIsSigningIn(true);
        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
            nonce,
          });

          if (error) throw error;
          await onSuccessRef.current();
        } catch (error) {
          onErrorRef.current(
            error instanceof Error
              ? `Google sign-in failed: ${error.message}`
              : "Google sign-in failed. Please try again.",
          );
        } finally {
          setIsSigningIn(false);
        }
      },
    });

    container.replaceChildren();
    const width = Math.max(220, Math.min(400, Math.floor(container.getBoundingClientRect().width || 400)));
    googleIdentity.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text,
      shape: "rectangular",
      logo_alignment: "left",
      width,
    });
  }, [scriptReady, text]);

  useEffect(() => {
    void renderGoogleButton();
  }, [renderGoogleButton]);

  return (
    <div
      className={`relative min-h-11 w-full overflow-hidden rounded ${className}`.trim()}
      aria-busy={isSigningIn}
    >
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => onErrorRef.current("Google sign-in could not load. Please use email instead.")}
      />
      <div
        ref={containerRef}
        className={`flex min-h-11 w-full justify-center transition-opacity ${disabled || isSigningIn ? "pointer-events-none opacity-50" : ""}`}
      />
      {isSigningIn && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-sm font-medium text-ink">
          Signing in securely…
        </div>
      )}
    </div>
  );
}
