import { API_BASE } from "./client";
import { metaConsent, trackMeta } from "./meta";

export type StorefrontEventType =
  | "page_view"
  | "product_view"
  | "search"
  | "add_to_cart"
  | "checkout_started"
  | "order_submitted"
  | "account_entry_clicked"
  | "login_viewed"
  | "registration_viewed"
  | "login_started"
  | "login_completed"
  | "login_failed"
  | "registration_completed"
  | "password_reset_started";

export interface StorefrontEventInput {
  eventId?: string;
  eventType: StorefrontEventType;
  productId?: number;
  /** Merchant catalog references used by Meta; never sent as arbitrary analytics properties. */
  contentIds?: string[];
  variantId?: number | null;
  orderId?: string;
  properties?: Record<string, string | number>;
}

const VISITOR_KEY = "sf-analytics-visitor";
const SESSION_KEY = "sf-analytics-session";
const ATTRIBUTION_KEY = "sf-analytics-attribution";

function randomId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function visitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = randomId("visitor");
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return "";
  }
}

function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = randomId("session");
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return randomId("session");
  }
}

function sessionAttribution(): Record<string, string> {
  if (typeof window === "undefined") return { source: "direct" };
  try {
    const existing = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (existing) return JSON.parse(existing) as Record<string, string>;
    const query = new URLSearchParams(window.location.search);
    const source = query.get("utm_source")?.trim().slice(0, 200);
    const campaign = query.get("utm_campaign")?.trim().slice(0, 200);
    let referrerHost = "";
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.hostname !== window.location.hostname) referrerHost = referrer.hostname.slice(0, 200);
    }
    const attribution = {
      source: source || referrerHost || "direct",
      ...(campaign ? { campaign } : {}),
      ...(referrerHost ? { referrer_host: referrerHost } : {}),
    };
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return { source: "direct" };
  }
}

function storeSlug(): string {
  const configured = (import.meta.env?.VITE_STORE_SLUG as string | undefined) ?? "";
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  const host = window.location.hostname.toLowerCase();
  const base = (import.meta.env?.VITE_STOREFRONT_BASE_DOMAIN as string | undefined) ?? "tijarago.com";
  const suffix = `.${base}`;
  return host.endsWith(suffix) ? host.slice(0, -suffix.length) : "";
}

/**
 * Best-effort behavioural event delivery. Commerce truth still comes from the
 * server-side order ledger, so analytics can never block a shopper action.
 */
export function trackStorefrontEvent(input: StorefrontEventInput): void {
  if (typeof window === "undefined" || !API_BASE) return;
  const slug = storeSlug();
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (slug) headers["X-Store-Slug"] = slug;
  const eventId = input.eventId ?? randomId("event");
  trackMeta(input, eventId);
  const body = JSON.stringify({
    event_id: eventId,
    event_type: input.eventType,
    visitor_id: visitorId(),
    session_id: sessionId(),
    product_id: input.productId,
    variant_id: input.variantId,
    order_id: input.orderId,
    occurred_at: new Date().toISOString(),
    properties: { ...sessionAttribution(), ...(input.properties ?? {}) },
    marketing_tracking_consent: metaConsent() === "granted",
  });
  void fetch(`${API_BASE}/api/analytics/events/`, {
    method: "POST",
    headers,
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics must never interfere with browsing, cart, or checkout.
  });
}
