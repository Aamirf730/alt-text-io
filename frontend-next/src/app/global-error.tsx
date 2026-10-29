"use client";

import { useEffect } from "react";

// Replaces the root layout, so global CSS, fonts and the Toaster are not
// available here. Colours are the design-system tokens, inlined.
const ink = "#3F3F46";
const inkMuted = "#6B6B73";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 16px",
          boxSizing: "border-box",
          background: "#FFFBEA",
          color: ink,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <title>Something went wrong | Alt Text Pro</title>
        <main
          style={{
            width: "100%",
            maxWidth: 440,
            padding: 32,
            boxSizing: "border-box",
            border: "1px solid #EFE3A3",
            borderRadius: 16,
            background: "#FFFFFF",
            boxShadow: "0 1px 2px rgba(63,63,70,0.06)",
            textAlign: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image needs the root layout */}
          <img src="/brand/logo-mark.svg" alt="Alt Text Pro" width={56} height={56} style={{ display: "block", margin: "0 auto" }} />
          <h1 style={{ margin: "24px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>
          <p role="alert" style={{ margin: "12px 0 0", color: inkMuted, fontSize: 16, lineHeight: 1.6 }}>
            Alt Text Pro couldn&apos;t load this page. Your account and credits are safe. Try again in a moment.
          </p>
          {error.digest && (
            <p style={{ margin: "8px 0 0", color: inkMuted, fontSize: 12 }}>Reference: {error.digest}</p>
          )}
          <div style={{ display: "grid", gap: 12, marginTop: 32 }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                height: 44,
                padding: "0 20px",
                border: 0,
                borderRadius: 12,
                background: "#FEE11C",
                color: ink,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A full page load: the root layout itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 44,
                padding: "0 20px",
                border: "1px solid #E2CE5A",
                borderRadius: 12,
                background: "#FFFFFF",
                color: ink,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go to homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
