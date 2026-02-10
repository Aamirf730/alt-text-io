import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Current WordPress plugin version — single source of truth */
export const PLUGIN_VERSION = "1.4.76";

/**
 * Returns the correct API base URL for Netlify functions.
 * Uses localhost dev server in development, relative path in production.
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "/.netlify/functions";
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return (
      process.env.NEXT_PUBLIC_API_BASE ||
      "http://localhost:9999/.netlify/functions"
    );
  }
  return "/.netlify/functions";
}
