import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const connectDirectory = path.resolve(process.cwd(), "src/app/connect");
const pageSource = fs.readFileSync(path.join(connectDirectory, "page.tsx"), "utf8");
const stateStyles = fs.readFileSync(path.join(connectDirectory, "connect-states.css"), "utf8");

describe("WordPress connect result screens", () => {
    it("loads shared styling before any early result-state return", () => {
        expect(pageSource).toContain('import "./connect-states.css";');

        for (const className of [
            "connect-loading",
            "connect-confirmation",
            "connect-recovery",
            "connect-success",
        ]) {
            expect(stateStyles).toContain(`.${className}`);
        }
    });

    it("keeps a recovered API key masked until the customer reveals it", () => {
        expect(pageSource).toContain('type={isManualApiKeyVisible ? "text" : "password"}');
        expect(pageSource).toContain('aria-label={isManualApiKeyVisible ? "Hide API key" : "Show API key"}');
        expect(pageSource).toContain("data-1p-ignore=\"true\"");
    });

    it("removes callback metadata from the address bar after saving it for the popup flow", () => {
        expect(pageSource).toContain('window.history.replaceState({}, document.title, "/connect")');
        expect(pageSource).not.toContain("alt_text_pro_api_key");
    });

    it("preserves validated callback context through email confirmation", () => {
        // Built from the stored context at send time, because the address bar
        // has already been cleared by then.
        expect(pageSource).toContain("const buildSignupRedirectUrl = () =>");
        expect(pageSource).toContain('redirectUrl.searchParams.set("callback_url", validCallbackUrl)');
        expect(pageSource).toContain("emailRedirectTo: buildSignupRedirectUrl()");
    });

    it("uses the first-party Google Identity flow instead of a Supabase OAuth redirect", () => {
        expect(pageSource).toContain('import GoogleIdentityButton from "@/components/GoogleIdentityButton"');
        expect(pageSource).toContain("<GoogleIdentityButton");
        expect(pageSource).not.toContain("signInWithOAuth");
    });

    it("keeps the primary connection flow on the Alt Text Pro yellow and white palette", () => {
        expect(pageSource).toContain("background: #FEE11C;");
        expect(pageSource).toContain("margin: 0 auto 16px");
        expect(pageSource).not.toContain("#6366f1");
        expect(pageSource).not.toContain("#8b5cf6");
    });

    it("lets the WordPress popup keep window.opener", () => {
        const config = fs.readFileSync(path.resolve(process.cwd(), "next.config.mjs"), "utf8");
        const globalRule = config.indexOf("source: '/(.*)'");
        const connectRule = config.indexOf("source: '/connect'");

        // Next.js applies the later matching rule, so /connect must follow the
        // global security headers and replace their opener policy.
        expect(globalRule).toBeGreaterThan(-1);
        expect(connectRule).toBeGreaterThan(globalRule);
        expect(config.slice(connectRule)).toMatch(
            /key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none'/,
        );
    });

    it("continues a popup sign-up automatically once the email is confirmed", () => {
        expect(pageSource).toContain("supabase.auth.onAuthStateChange");
        expect(pageSource).toContain("CONFIRMATION_POLL_INTERVAL_MS");
        expect(pageSource).toContain("Waiting for you to confirm your email");
        expect(pageSource).toContain("I&apos;ve confirmed — continue");
        expect(pageSource).toContain("Resend confirmation email");
    });

    it("tells the confirmation tab to return to the WordPress window", () => {
        expect(pageSource).toContain("Return to the WordPress connection window to finish");
        expect(pageSource).not.toContain("The WordPress window closed before the connection could be confirmed.");
    });

    it("never reports a connection without delivering a key to WordPress", () => {
        expect(pageSource).toContain("No WordPress site is waiting");
        expect(pageSource).not.toContain("Your API key is ready. You can close this window.");
        // connect_completed is recorded only after the opener received the key.
        const completed = pageSource.indexOf('trackMarketingEvent("connect_completed"');
        const delivered = pageSource.indexOf("sendKeyAndWaitForAcknowledgement(target, key.apiKey");
        expect(delivered).toBeGreaterThan(-1);
        expect(completed).toBeGreaterThan(delivered);
    });

    it("shows the signed-in account and lets the visitor switch without losing the request", () => {
        expect(pageSource).toContain("Signed in as");
        expect(pageSource).toContain("Use a different account");
        expect(pageSource).toContain('supabase.auth.signOut({ scope: "local" })');
    });

    it("offers key rotation with a warning when the stored key cannot be recovered", () => {
        expect(pageSource).toContain('data.code === "api_key_rotation_required"');
        expect(pageSource).toContain("disconnected until you reconnect it");
    });

    it("detects an already-registered email and drops unused sign-up metadata", () => {
        expect(pageSource).toContain("isExistingAccountSignUp(result.data.user");
        expect(pageSource).not.toContain("credits_remaining: 165");
        expect(pageSource).not.toContain("rememberPendingSignup");
        expect(pageSource).not.toContain("consumePendingSignup");
    });
});
