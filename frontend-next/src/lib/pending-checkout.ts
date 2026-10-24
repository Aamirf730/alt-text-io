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
