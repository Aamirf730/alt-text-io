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
        expect(pageSource).toContain('setSignupRedirectUrl(redirectUrl.toString())');
        expect(pageSource).toContain('redirectUrl.searchParams.set("callback_url", validCallbackUrl)');
        expect(pageSource).toContain('emailRedirectTo: signupRedirectUrl || window.location.href');
    });

    it("uses the first-party Google Identity flow instead of a Supabase OAuth redirect", () => {
        expect(pageSource).toContain('import GoogleIdentityButton from "@/components/GoogleIdentityButton"');
        expect(pageSource).toContain("<GoogleIdentityButton");
        expect(pageSource).not.toContain("signInWithOAuth");
    });

    it("keeps the primary connection flow on the Alt Text Pro yellow and black palette", () => {
        expect(pageSource).toContain("background: #FEE11C;");
        expect(pageSource).toContain("margin: 0 auto 16px");
        expect(pageSource).not.toContain("#6366f1");
        expect(pageSource).not.toContain("#8b5cf6");
    });
});
