import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PLUGIN_VERSION } from "./plugin-version"

export { PLUGIN_VERSION }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Catalogue fallbacks only. A pinned monthly_credit_allowance on the profile
// always wins, which keeps legacy subscribers on the allowance they bought.
// The lite/standard/pro/agency aliases are pre-2026-10 plan names.
export const PLAN_CREDIT_LIMITS: Record<string, number> = {
  free: 15,
  lite: 150,
  standard: 1000,
  pro: 2000,
  agency: 3500,
  tier1: 500,
  tier2: 1500,
  tier3: 2000,
  tier4: 5000,
};

/**
 * Returns the correct API base URL for Netlify functions.
 * Uses localhost dev server in development, relative path in production.
 *
 * PRODUCTION SAFETY: Even if NEXT_PUBLIC_API_BASE is accidentally set to
 * a localhost URL in production, we ignore it and use the relative path.
 */
export function getApiBase(): string {
  // Server-side rendering always uses the relative path
  if (typeof window === "undefined") return "/.netlify/functions";

  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocal) {
    return (
      process.env.NEXT_PUBLIC_API_BASE ||
      "http://localhost:9999/.netlify/functions"
    );
  }

  // PRODUCTION: Always use relative path, ignore any env var containing localhost
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envBase && envBase.includes("localhost")) {
    console.warn(
      "[getApiBase] NEXT_PUBLIC_API_BASE contains localhost in production — ignoring. " +
      "Set NEXT_PUBLIC_API_BASE=/.netlify/functions in Netlify environment variables."
    );
    return "/.netlify/functions";
  }

  return envBase || "/.netlify/functions";
}
