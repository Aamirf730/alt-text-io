import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/dashboard/page.tsx"),
  "utf8",
);

describe("dashboard operations console", () => {
  it("keeps the setup prompt conditional on plugin connection and first use", () => {
    expect(dashboardSource).toContain(
      "const showFirstRunOnboarding = !isPluginConnected || !hasGeneratedFirstAltText",
    );
    expect(dashboardSource).toContain("{showFirstRunOnboarding && usageStats && user?.id && (");
    expect(dashboardSource).toContain("<GettingStarted");
  });

  it("keeps the core operations sections and responsive navigation available", () => {
    expect(dashboardSource).toContain("Operations Console");
    expect(dashboardSource).toContain('id="activity"');
    expect(dashboardSource).toContain('id="generate"');
    expect(dashboardSource).toContain('id="usage"');
    expect(dashboardSource).toContain('id="settings"');
    expect(dashboardSource).toContain('aria-label="Open dashboard navigation"');
    expect(dashboardSource).toContain("history.slice(0, 5)");
  });

  it("contains no development-only dashboard authentication bypass", () => {
    expect(dashboardSource).not.toContain("dashboard-preview");
    expect(dashboardSource).not.toContain("TEMPORARY DESIGN QA");
  });

  it("fetches a current access token for each API call instead of reusing the load-time token", () => {
    expect(dashboardSource).not.toMatch(/Bearer \$\{user\.token\}/);
    expect(dashboardSource).toContain("await getAccessToken()");

    const adminSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/admin/page.tsx"), "utf8");
    expect(adminSource).not.toMatch(/user\??\.token/);
    expect(adminSource).toContain("await getAccessToken()");
  });

  it("reopens a plan chosen before sign-in and keeps subscribers out of a second checkout", () => {
    expect(dashboardSource).toContain("consumePendingCheckout()");
    expect(dashboardSource).toContain("pending.kind === 'subscription' && isSubscribed");
    expect(dashboardSource).toContain("data.code === SUBSCRIPTION_EXISTS_CODE");

    const homeSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/LandingPageClient.tsx"), "utf8");
    expect(homeSource).toContain("savePendingCheckout(planId, billingCycle)");
  });

  it("never shows a failed usage load as 0 credits on the Free plan", () => {
    expect(dashboardSource).toContain("fetchUsageStats(getApiBase(), accessToken)");
    expect(dashboardSource).toContain('result.status === "unauthorized"');
    expect(dashboardSource).toContain("We couldn&apos;t load your account");
    expect(dashboardSource).not.toContain(".from('profiles')");
  });

  it("follows sign-outs from other tabs and gates rendering on the session check", () => {
    expect(dashboardSource).toContain("supabase.auth.onAuthStateChange");
    expect(dashboardSource).toContain("event === 'SIGNED_OUT'");
    expect(dashboardSource).toContain('sessionStatus !== "ready"');
    expect(dashboardSource).toContain('router.replace("/?auth=signin")');
  });

  it("shows billing to every signed-in user and explains an empty billing history", () => {
    expect(dashboardSource).toContain("Billing &amp; receipts");
    expect(dashboardSource).toContain("No billing history yet");
    expect(dashboardSource).not.toContain("subscriptionData?.subscription?.polar_customer_id ?");
  });

  it("waits for the purchase to reach the account after checkout", () => {
    expect(dashboardSource).toContain("checkoutState !== 'success' && checkoutState !== 'pending'");
    expect(dashboardSource).toContain("Payment received — updating your account…");
    expect(dashboardSource).toContain("CHECKOUT_POLL_TIMEOUT_MS");
    expect(dashboardSource).toContain("saveCheckoutBaseline(snapshotFromUsage(usageStats))");
  });

  it("includes account settings, full history, connected sites and account deletion", () => {
    expect(dashboardSource).toContain("<GenerationHistory");
    expect(dashboardSource).toContain("<ConnectedSites");
    expect(dashboardSource).toContain("<AccountSettings");
    expect(dashboardSource).toContain("<DeleteAccountCard");
    expect(dashboardSource).toContain("images this billing cycle");
    expect(dashboardSource).not.toContain("images optimized");

    const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), "src/app/dashboard", file), "utf8");
    expect(read("GenerationHistory.tsx")).toContain('.range(from, to)');
    expect(read("ConnectedSites.tsx")).toContain("/get-connected-sites");
    expect(read("ConnectedSites.tsx")).toContain("response.status === 404");
    expect(read("AccountSettings.tsx")).toContain("supabase.auth.updateUser({ password: newPassword })");
    expect(read("AccountSettings.tsx")).toContain("{ email: nextEmail }");
    const deleteCard = read("DeleteAccountCard.tsx");
    expect(deleteCard).toContain("fetch(`${getApiBase()}/delete-account`");
    expect(deleteCard).toContain("confirm_email: confirmEmail.trim()");
    expect(deleteCard).toContain("Payment records are kept");
  });
});
