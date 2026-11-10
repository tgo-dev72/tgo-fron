/**
 * Live API client for the store-platform backend (auth, stores, catalog).
 * Dev server runs over HTTPS on the LAN. Override with VITE_API_URL.
 */

export const API_BASE: string =
  import.meta.env?.DEV
    ? "/backend"
    : (import.meta.env?.VITE_API_URL as string | undefined) ||
      "https://api.tijarago.com";

export interface PlatformPresentation {
  contact_email: string;
  support_phone: string;
  whatsapp_phone: string;
  social_links: Record<string, string>;
}

export interface RetailFieldConfig {
  visible: boolean;
  required: boolean;
  type?: "text" | "number" | "select" | "date" | "url" | "string_list";
  choices?: string[];
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlatformUser {
  email: string;
  first_name: string;
  last_name: string;
  email_verified?: boolean;
  business_name?: string;
  phone_number?: string;
  phone_verified?: boolean;
  preferred_language?: "en" | "fr" | "ar";
}

export interface RetailType {
  id: number;
  key: string;
  label: string;
  description: string;
  icon: string;
  config: {
    product_fields: Record<string, RetailFieldConfig>;
    variant_fields: Record<string, RetailFieldConfig>;
    units: string[];
    features: Record<string, boolean>;
  };
  sort_order: number;
}

export interface Design {
  key: string;
  name: string;
  tagline: string;
  description: string;
  screenshots: string[];
  demo_url: string | null;
  preview_available?: boolean;
  demo_store_slug?: string | null;
  presets?: DesignPreset[];
  preview_ticket?: string;
  tier?: "standard" | "premium";
  features?: string[];
  feature_maturity?: Record<string, "production" | "beta" | "prototype">;
  family: string;
  business_need: string;
  best_for: string[];
  journey: string[];
  business_outcomes: string[];
  status: "ready" | "building";
  config_schema: { key: string; label: string; type: string; required: boolean; options?: string[] }[];
}

export interface DesignPreset {
  key: string;
  name: string;
  description: string;
  accent: string;
  surface: string;
}

export interface Store {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  logo_url: string | null;
  retail_type: number | null;
  retail_type_detail: RetailType | null;
  members: StoreMember[];
  storefront_url: string | null;
  storefront_request_id: number | null;
  storefront_status: "draft" | "preparing" | "live" | "failed";
  storefront_progress: number;
  plan: "free" | "premium";
  created_at: string;
}

export interface StoreAddressAvailability {
  slug: string;
  available: boolean;
  reason: "available" | "taken" | "invalid";
}

export interface StoreMember {
  id: number;
  user: number;
  email: string;
  role: string;
  created_at: string;
}

export interface DeployRequest {
  id: number;
  store: number;
  design: string;
  name: string;
  slug: string;
  status: "pending" | "scaffolding" | "created" | "failed";
  deploy_status: "not_deployed" | "deploying" | "deployed" | "failed";
  pipeline_state: "accepted" | "preparing" | "publishing" | "provisioning" | "configuring_domain" | "building" | "verifying" | "live" | "failed";
  progress: number;
  public_message: string;
  event_version: number;
  deployed_url: string;
  app_path: string;
  port: number | null;
  log: string;
  deploy_log: string;
  created_at: string;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  translations?: Record<"en" | "fr" | "ar", { name: string; description: string }>;
  price: string;
  currency: string;
  duration_days: number;
  entitlement_scope: "all_owned_stores" | "one_store";
  features: string[];
  benefits?: Array<{
    key: string; name: string; description: string; value: boolean | number | string; unit: string; display: string;
    scope?: "account" | "store" | "user"; counting_rules?: string; reset_window?: string;
    missing_behavior?: string; zero_behavior?: string; downgrade_behavior?: string;
    translations?: Record<"en" | "fr" | "ar", { name: string; description: string; display: string }>;
  }>;
  grants_premium_designs: boolean;
  is_featured: boolean;
  is_free: boolean;
}

export interface SubscriptionEntry {
  status: "inactive" | "active" | "canceled" | "expired";
  plan: SubscriptionPlan | null;
  entitlements: Record<string, boolean | number | string>;
  selected_store: { id: number; name: string; slug: string } | null;
  started_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface SubscriptionCatalog {
  plans: SubscriptionPlan[];
  billing: {
    available: boolean;
    sandbox: boolean;
    provider: { code: string; name: string };
    gateways: Array<{ code: string; name: string; sandbox: boolean }>;
  };
}

export interface SubscriptionStatus {
  access: { allowed: boolean; code: "subscription_required" | null };
  subscription: SubscriptionEntry | null;
  subscriptions: SubscriptionEntry[];
  latest_payment: SubscriptionPaymentStatus | null;
  payment: SubscriptionPaymentStatus | null;
  balances: Array<{ currency: string; balance: string; reserved: string; available: string }>;
}

export interface SubscriptionPaymentStatus {
    id: string;
    plan_id: number | null;
    plan_name: string;
    amount: string;
    balance_authorized: boolean;
    currency: string;
    provider: string;
    status: "pending" | "confirmed" | "failed" | "duplicate" | "canceled";
    entitlement_scope: "all_owned_stores" | "one_store";
    selected_store_id: number | null;
    processed_at: string | null;
    created_at: string;
}

export interface CheckoutResult {
  payment_url: string;
  payment_id: string;
}

// ─── Error ──────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  detail: string;
  code?: string;
  payload?: Record<string, unknown>;
  constructor(status: number, detail: string, code?: string, payload?: Record<string, unknown>) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.payload = payload;
  }
}

// ─── CSRF ───────────────────────────────────────────────────────────────────

let csrfToken: string | null = null;
export const MERCHANT_SESSION_EXPIRED_EVENT = "tijarago:merchant-session-expired";

export function shouldExpireMerchantSession(path: string, status: number): boolean {
  if (status !== 401) return false;
  return ![
    "/accounts/token",
    "/accounts/me",
    "/accounts/register",
    "/accounts/verify-email",
    "/accounts/verify-email/resend",
  ].includes(path.split("?", 1)[0]);
}

function notifyMerchantSessionExpired(path: string, status: number) {
  if (!shouldExpireMerchantSession(path, status)) return;
  clearCsrf();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MERCHANT_SESSION_EXPIRED_EVENT));
}

async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/accounts/csrf`, { credentials: "include" });
  } catch {
    throw new ApiError(0, "network_unavailable");
  }
  if (!res.ok) throw new ApiError(res.status, "session_initialization_failed");
  const body = (await res.json()) as { csrfToken?: string };
  if (!body.csrfToken) throw new ApiError(503, "session_initialization_failed");
  csrfToken = body.csrfToken;
  return csrfToken;
}

function clearCsrf() {
  csrfToken = null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ─── Request ────────────────────────────────────────────────────────────────

function firstErrorValue(obj: Record<string, unknown>): string | null {
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      if (value.length && typeof value[0] === "string") return value[0];
      for (const item of value) {
        if (item && typeof item === "object") {
          const nested = firstErrorValue(item as Record<string, unknown>);
          if (nested) return nested;
        }
      }
    } else if (typeof value === "string") {
      return value;
    } else if (value && typeof value === "object") {
      const nested = firstErrorValue(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function extractDetail(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.detail === "string") return d.detail;
  if (typeof d.message === "string") return d.message;
  return firstErrorValue(d);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  if (UNSAFE_METHODS.has(method)) {
    if (!csrfToken) await fetchCsrfToken();
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, "network_unavailable");
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    notifyMerchantSessionExpired(path, res.status);
    const detail = extractDetail(data) ?? `Request failed (${res.status}).`;
    const payload = data && typeof data === "object" ? data as Record<string, unknown> : undefined;
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    throw new ApiError(res.status, detail, code, payload);
  }
  return data as T;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

// ─── Platform API ───────────────────────────────────────────────────────────

export const platform = {
  presentation() {
    return request<PlatformPresentation>("/api/platform-admin/presentation/public");
  },
  register(input: {
    email: string;
    confirm_email: string;
    password: string;
    confirm_password: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    preferred_language: "en" | "fr" | "ar";
    terms_accepted: boolean;
  }) {
    return request<{ message: string; verification_required: boolean; user: PlatformUser }>("/accounts/register", json("POST", input));
  },

  resendVerification(email: string) {
    return request<{ message: string }>("/accounts/verify-email/resend", json("POST", { email }));
  },

  async login(email: string, password: string) {
    const result = await request<{ message: string; user: PlatformUser }>("/accounts/token", json("POST", { email, password, scope: "owner" }));
    clearCsrf();
    return result;
  },

  async loginAndInitCsrf(email: string, password: string) {
    const result = await this.login(email, password);
    await fetchCsrfToken();
    return result;
  },

  async logout() {
    try {
      return await request<{ message: string }>("/accounts/logout", { method: "POST" });
    } finally {
      clearCsrf();
    }
  },

  me() {
    return request<{ message: string; user: PlatformUser }>("/accounts/me");
  },

  async initSession() {
    await fetchCsrfToken();
    try {
      const res = await this.me();
      return res;
    } catch {
      return null;
    }
  },

  listStores() {
    return request<Store[]>("/api/store/");
  },

  storeAddressAvailability(slug: string) {
    return request<StoreAddressAvailability>(`/api/store/availability/?slug=${encodeURIComponent(slug)}`);
  },

  createStore(input: {
    name: string;
    slug: string;
    retail_type?: number | null;
    config?: {
      brand_color?: string;
      currency?: string;
      contact_email?: string;
      support_phone?: string;
      whatsapp_phone?: string;
      social_links?: Record<string, string>;
      homepage_product_source?: "featured" | "newest" | "discounted" | "top_rated";
      homepage_product_limit?: number;
      design?: string;
    };
  }) {
    return request<Store & { storefront_request_id: number | null }>("/api/store/", {
      ...json("POST", input),
      // Let the small creation command reach the backend if the merchant
      // refreshes immediately after entering the provisional launch route.
      keepalive: true,
    });
  },

  uploadStoreLogo(storeId: number, logo: File) {
    const body = new FormData();
    body.append("logo", logo);
    return request<{ logo_url: string | null }>(`/api/store/${storeId}/logo/`, { method: "POST", body });
  },

  getRequest(id: number) {
    return request<DeployRequest>(`/api/requests/${id}/`);
  },

  requestEventsUrl(id: number) {
    return `${API_BASE}/api/requests/${id}/events`;
  },

  async listDesigns() {
    return request<Design[]>("/api/designs/");
  },

  getThemePreview(themeKey: string) {
    return request<Design>(`/api/theme-previews/${encodeURIComponent(themeKey)}/`);
  },

  listRetailTypes() {
    return request<RetailType[]>("/api/catalog/retail-types/");
  },

  listSubscriptionPlans(signal?: AbortSignal) {
    return request<SubscriptionCatalog>("/api/subscriptions/plans", signal ? { signal } : undefined);
  },

  subscriptionStatus(paymentId?: string | null) {
    const suffix = paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : "";
    return request<SubscriptionStatus>(`/api/subscriptions/status${suffix}`);
  },

  checkoutSubscription(input: { plan: number; store?: number; locale: "en" | "fr" | "ar"; useBalance: boolean; provider: string }) {
    const idempotencyKey = crypto.randomUUID();
    return request<CheckoutResult>(
      "/api/subscriptions/checkout",
      {
        ...json("POST", {
          plan_id: input.plan,
          store_id: input.store,
          lang: input.locale,
          use_balance: input.useBalance,
          provider: input.provider,
          return_origin: window.location.origin,
          idempotency_key: idempotencyKey,
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
  },

  createDeployRequest(input: { store: number; design: string; config: { store_name: string; brand_color?: string; currency?: string; contact_email?: string } }) {
    return request<DeployRequest>("/api/requests/", json("POST", input));
  },

  scaffoldRequest(id: number) {
    return request<DeployRequest>(`/api/requests/${id}/scaffold`, json("POST", {}));
  },
};
