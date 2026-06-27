import { getApiBase } from "@/lib/utils";

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
    gtag?: (...args: unknown[]) => void;
    plausible?: (eventName: string, options?: { props?: MarketingEventProperties }) => void;
  }
}

const ANONYMOUS_ID_KEY = "alt_text_pro_anonymous_id";

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

function cleanProperties(properties: MarketingEventProperties = {}): MarketingEventProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );
}

export function trackMarketingEvent(
  eventName: MarketingEventName,
  options: TrackMarketingEventOptions = {}
) {
  if (typeof window === "undefined") return;

  const properties = cleanProperties({
    ...options.properties,
    path: window.location.pathname,
    search: window.location.search || undefined,
    referrer: document.referrer || undefined,
  });

  const payload = {
    event_name: eventName,
    source: options.source || "web_app",
    anonymous_id: getAnonymousId(),
    user_id: options.userId || undefined,
    user_email: options.userEmail || undefined,
    properties,
    occurred_at: new Date().toISOString(),
  };

  window.dataLayer?.push({ event: eventName, ...payload });
  window.gtag?.("event", eventName, properties);
  window.plausible?.(eventName, { props: properties });

  fetch(`${getApiBase()}/track-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Marketing events must never interrupt the product workflow.
  });
}
