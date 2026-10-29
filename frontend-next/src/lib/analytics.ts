import { getApiBase } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export type MarketingEventName =
  | "page_viewed"
  | "signup_created"
  | "demo_used"
  | "plugin_downloaded"
  | "connect_started"
  | "connect_completed"
  | "first_image_processed"
  | "credits_low"
  | "checkout_started"
  | "purchase_completed"
  | "subscription_canceled";

type MarketingEventProperties = Record<string, string | number | boolean | null | undefined>;

type TrackMarketingEventOptions = {
  source?: "web_app" | "landing_page" | "dashboard" | "wordpress_plugin" | "wordpress_connect";
  userId?: string | null;
  userEmail?: string | null;
  properties?: MarketingEventProperties;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    plausible?: (eventName: string, options?: { props?: MarketingEventProperties }) => void;
  }
}

const ANONYMOUS_ID_KEY = "alt_text_pro_anonymous_id";
let cachedAccessToken: string | null = null;
let authTokenCacheInitialized = false;

function ensureAuthTokenCache() {
  if (typeof window === "undefined" || authTokenCacheInitialized) return;

  authTokenCacheInitialized = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token || null;
  });
}

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;

  const { data: { session } } = await supabase.auth.getSession();
  cachedAccessToken = session?.access_token || null;
  return cachedAccessToken;
}

function getAnonymousId(): string {
  const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(ANONYMOUS_ID_KEY, generated);
  return generated;
}

// Auth, password reset, plugin connect and email confirmation URLs carry
// one-time tokens, codes and plugin callback details. Their query string and
// hash are never recorded.
const PRIVATE_QUERY_PATH_PREFIXES = ["/auth", "/reset-password", "/connect", "/email-confirmed"];

// Query parameters that look like credentials are dropped on every page.
const SENSITIVE_PARAM_PATTERN = /(token|secret|password|passwd|api[_-]?key|session|code|otp|nonce|signature|^sig$|^key$|^state$|hash|callback|email)/i;

function isPrivateQueryPath(pathname: string): boolean {
  return PRIVATE_QUERY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Returns a query string that is safe to send to analytics, or undefined. */
export function sanitizeAnalyticsSearch(pathname: string, search: string): string | undefined {
  if (!search || isPrivateQueryPath(pathname)) return undefined;

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const name of Array.from(params.keys())) {
    if (SENSITIVE_PARAM_PATTERN.test(name)) {
      params.delete(name);
    }
  }

  const cleaned = params.toString();
  return cleaned ? `?${cleaned}` : undefined;
}

/** Keeps only the origin and path of the referrer, never its query or hash. */
export function sanitizeAnalyticsReferrer(referrer: string): string | undefined {
  if (!referrer) return undefined;

  try {
    const url = new URL(referrer);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function cleanProperties(properties: MarketingEventProperties = {}): MarketingEventProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );
}

function parseCurrencyValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function trackMetaEvent(
  eventName: MarketingEventName,
  properties: MarketingEventProperties
) {
  if (typeof window.fbq !== "function") return;

  if (eventName === "signup_created") {
    window.fbq("track", "CompleteRegistration", {
      content_name: "Alt Text Pro signup",
      status: "free_account",
    });
    return;
  }

  if (eventName === "checkout_started") {
    window.fbq("track", "InitiateCheckout", {
      content_name: properties.plan_id || "Alt Text Pro checkout",
      currency: "USD",
    });
    return;
  }

  if (eventName === "purchase_completed") {
    if (properties.has_customer_session_token !== true) return;

    window.fbq("track", "Purchase", {
      content_name: "Alt Text Pro purchase",
      currency: "USD",
      value: parseCurrencyValue(properties.value || properties.amount || properties.plan_price),
    });
    return;
  }

  const customEventNames: Partial<Record<MarketingEventName, string>> = {
    demo_used: "DemoUsed",
    plugin_downloaded: "PluginDownloaded",
    connect_started: "WordPressConnectStarted",
    connect_completed: "WordPressConnected",
    first_image_processed: "FirstImageProcessed",
    credits_low: "CreditsLow",
    subscription_canceled: "SubscriptionCanceled",
  };

  const metaEventName = customEventNames[eventName];
  if (metaEventName) {
    window.fbq("trackCustom", metaEventName, properties);
  }
}

export function trackMarketingEvent(
  eventName: MarketingEventName,
  options: TrackMarketingEventOptions = {}
) {
  if (typeof window === "undefined") return;
  ensureAuthTokenCache();

  const properties = cleanProperties({
    ...options.properties,
    path: window.location.pathname,
    search: sanitizeAnalyticsSearch(window.location.pathname, window.location.search),
    referrer: sanitizeAnalyticsReferrer(document.referrer),
  });

  const payload = {
    event_name: eventName,
    source: options.source || "web_app",
    anonymous_id: getAnonymousId(),
    properties,
    occurred_at: new Date().toISOString(),
  };

  window.dataLayer?.push({ event: eventName, ...payload });
  window.gtag?.("event", eventName, properties);
  window.plausible?.(eventName, { props: properties });
  trackMetaEvent(eventName, properties);

  void (async () => {
    try {
      // The server verifies this token with Supabase Auth and derives user ID
      // and email itself. Caller-provided identity is never sent or trusted.
      let accessToken = cachedAccessToken;
      if (!accessToken) {
        accessToken = await getAccessToken();
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      await fetch(`${getApiBase()}/track-event`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (_) {
      // Marketing events must never interrupt the product workflow.
    }
  })();
}
