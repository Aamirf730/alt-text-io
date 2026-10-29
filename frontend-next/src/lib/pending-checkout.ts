import { getCreditPack, getSubscriptionPlan } from "./pricing-catalog";

// A plan or pack chosen by a signed-out visitor has to survive sign-up, email
// confirmation (often in a new tab) and sign-in, so it is kept in
// localStorage for a limited time and consumed once by the dashboard.
const STORAGE_KEY = "altTextPro.pendingCheckout";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingCheckout = {
  planId: string;
  billingCycle: "monthly" | "annual";
  savedAt: number;
};

export type ResolvedPendingCheckout = {
  kind: "subscription" | "pack";
  checkoutId: string;
  name: string;
  price: string;
};

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function savePendingCheckout(planId: string, billingCycle: string, now = Date.now()): void {
  if (!resolvePendingCheckout({ planId, billingCycle: billingCycle === "annual" ? "annual" : "monthly", savedAt: now }, now)) {
    return;
  }

  const value: PendingCheckout = {
    planId,
    billingCycle: billingCycle === "annual" ? "annual" : "monthly",
    savedAt: now,
  };

  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}

export function clearPendingCheckout(): void {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

/** Reads and removes the pending choice so it is acted on at most once. */
export function consumePendingCheckout(now = Date.now()): ResolvedPendingCheckout | null {
  let raw: string | null = null;
  try {
    raw = getStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  clearPendingCheckout();
  if (!raw) return null;

  try {
    return resolvePendingCheckout(JSON.parse(raw) as PendingCheckout, now);
  } catch {
    return null;
  }
}

export function resolvePendingCheckout(
  pending: PendingCheckout | null | undefined,
  now = Date.now(),
): ResolvedPendingCheckout | null {
  if (!pending || typeof pending.planId !== "string" || typeof pending.savedAt !== "number") {
    return null;
  }
  if (pending.savedAt > now || now - pending.savedAt > MAX_AGE_MS) {
    return null;
  }

  const pack = getCreditPack(pending.planId);
  if (pack) {
    return { kind: "pack", checkoutId: pack.id, name: pack.name, price: pack.price };
  }

  const plan = getSubscriptionPlan(pending.planId);
  if (!plan || plan.id === "free") return null;

  const cycle = pending.billingCycle === "annual" ? "annual" : "monthly";
  return {
    kind: "subscription",
    checkoutId: `${plan.id}_${cycle}`,
    name: plan.name,
    price: cycle === "annual" ? plan.annualPrice : plan.monthlyPrice,
  };
}

// After checkout, Polar's webhook updates the account a few seconds after the
// customer returns. The dashboard polls until the account visibly changes;
// a snapshot taken just before leaving for checkout tells it what "changed"
// means even if the webhook landed before the dashboard loaded.
const BASELINE_STORAGE_KEY = "altTextPro.checkoutBaseline";

export const CHECKOUT_POLL_INTERVAL_MS = 3000;
export const CHECKOUT_POLL_TIMEOUT_MS = 60000;

export type AccountSnapshot = {
  plan: string;
  status: string | null;
  creditsRemaining: number;
  purchasedCredits: number;
  monthlyLimit: number;
};

type StoredBaseline = AccountSnapshot & { savedAt: number };

export function saveCheckoutBaseline(snapshot: AccountSnapshot, now = Date.now()): void {
  try {
    getStorage()?.setItem(BASELINE_STORAGE_KEY, JSON.stringify({ ...snapshot, savedAt: now }));
  } catch {
    // Without storage the dashboard falls back to its first load as baseline.
  }
}

/** Reads and removes the pre-checkout snapshot (valid for 24 hours). */
export function consumeCheckoutBaseline(now = Date.now()): AccountSnapshot | null {
  let raw: string | null = null;
  try {
    raw = getStorage()?.getItem(BASELINE_STORAGE_KEY) ?? null;
    getStorage()?.removeItem(BASELINE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as StoredBaseline;
    if (typeof stored.savedAt !== "number" || stored.savedAt > now || now - stored.savedAt > MAX_AGE_MS) {
      return null;
    }
    return {
      plan: String(stored.plan || "free"),
      status: stored.status ?? null,
      creditsRemaining: Number(stored.creditsRemaining) || 0,
      purchasedCredits: Number(stored.purchasedCredits) || 0,
      monthlyLimit: Number(stored.monthlyLimit) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * True once a purchase is visible: a new plan, status or allowance, more
 * purchased credits, or more credits overall. A drop in credits is ignored
 * because the plugin may be spending credits at the same time.
 */
export function hasAccountChangedSinceCheckout(before: AccountSnapshot, after: AccountSnapshot): boolean {
  return (
    before.plan !== after.plan ||
    (before.status ?? null) !== (after.status ?? null) ||
    before.monthlyLimit !== after.monthlyLimit ||
    after.purchasedCredits > before.purchasedCredits ||
    after.creditsRemaining > before.creditsRemaining
  );
}
