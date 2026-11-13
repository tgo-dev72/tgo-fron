import type { StoreConfig } from "../config";
import type { StorefrontEventInput } from "./analytics";
import { API_BASE } from "./client";

declare global { interface Window { fbq?: (...args: unknown[]) => void; _fbq?: unknown; } }

let activeConfig: StoreConfig | null = null;
let initializedPixel = "";

export function setMetaConfig(config: StoreConfig): void { activeConfig = config; }

const consentKey = (slug: string) => `sf-meta-consent:${slug}`;
const trackingKey = (slug: string) => `sf-meta-visitor:${slug}`;
export type MetaConsent = "granted" | "declined" | "undecided";

export function metaConsent(config: StoreConfig | null = activeConfig): MetaConsent {
  if (!config || typeof window === "undefined") return "undecided";
  try { return (window.localStorage.getItem(consentKey(config.slug || config.domain)) as MetaConsent) || "undecided"; }
  catch { return "undecided"; }
}

export function metaTrackingId(config: StoreConfig | null = activeConfig): string {
  if (!config || typeof window === "undefined") return "";
  const scope = config.slug || config.domain;
  try {
    const existing = window.localStorage.getItem(trackingKey(scope));
    if (existing) return existing;
    const created = typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `meta-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(trackingKey(scope), created);
    return created;
  } catch { return ""; }
}

function syncMetaConsent(config: StoreConfig, granted: boolean): void {
  if (!API_BASE) return;
  const visitorId = metaTrackingId(config);
  if (!visitorId) return;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (config.slug) headers["X-Store-Slug"] = config.slug;
  void fetch(`${API_BASE}/api/analytics/meta-consent/`, {
    method: "POST", headers, keepalive: true,
    body: JSON.stringify({ visitor_id: visitorId, granted }),
  }).catch(() => { /* Consent UI must remain usable during network failures. */ });
}

export function setMetaConsent(config: StoreConfig, value: Exclude<MetaConsent, "undecided">): void {
  try { window.localStorage.setItem(consentKey(config.slug || config.domain), value); } catch { /* storage may be blocked */ }
  syncMetaConsent(config, value === "granted");
  if (value === "granted") configureMeta(config);
  window.dispatchEvent(new CustomEvent("tijarago:meta-consent", { detail: value }));
}

export function configureMeta(config: StoreConfig): void {
  setMetaConfig(config);
  if (typeof window === "undefined" || !config.meta?.enabled || !config.meta.pixelId || metaConsent(config) !== "granted") return;
  if (!window.fbq) {
    const fbq = (...args: unknown[]) => { (fbq as unknown as { queue: unknown[][] }).queue.push(args); };
    (fbq as unknown as { queue: unknown[][] }).queue = [];
    window.fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.tijaragoMeta = "true";
    document.head.appendChild(script);
  }
  if (initializedPixel !== config.meta.pixelId) {
    window.fbq?.("init", config.meta.pixelId);
    initializedPixel = config.meta.pixelId;
  }
}

export function metaEvent(input: StorefrontEventInput): { name: string; params: Record<string, unknown> } | null {
  const names: Partial<Record<StorefrontEventInput["eventType"], string>> = {
    page_view: "PageView", product_view: "ViewContent", add_to_cart: "AddToCart", checkout_started: "InitiateCheckout",
  };
  let name = names[input.eventType];
  if (input.eventType === "order_submitted") name = input.properties?.payment_mode === "online_paid" ? "Purchase" : "OrderPlaced";
  if (!name) return null;
  const params: Record<string, unknown> = {
    currency: String(input.properties?.currency || "MAD").toUpperCase(),
    value: Number(input.properties?.cart_value || 0),
    content_type: "product",
  };
  if (input.contentIds?.length) params.content_ids = input.contentIds;
  else if (input.productId) params.content_ids = [String(input.productId)];
  if (input.properties?.quantity) params.num_items = Number(input.properties.quantity);
  if (input.orderId) params.order_id = input.orderId;
  return { name, params };
}

export function trackMeta(input: StorefrontEventInput, eventId: string): void {
  if (!activeConfig?.meta?.enabled || metaConsent(activeConfig) !== "granted") return;
  configureMeta(activeConfig);
  const event = metaEvent(input);
  if (!event) return;
  window.fbq?.("trackSingle", activeConfig.meta.pixelId, event.name, event.params, { eventID: eventId });
}
