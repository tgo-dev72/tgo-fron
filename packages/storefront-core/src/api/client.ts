import type { CatalogSection, Product, SectionKey, Variant } from "./types";

/**
 * Data-access layer for the store-platform API.
 *
 * Catalog/order/payment endpoints are public and tenant-scoped: the store is
 * resolved from the request's subdomain in production, or from the
 * `X-Store-Slug` header in local dev (set VITE_STORE_SLUG). Set VITE_API_URL
 * to point at the store's API base. Local configured hosts are replaced with
 * the hostname currently open in the browser, while preserving scheme/port.
 *
 * There is deliberately NO bundled catalog snapshot — the storefront always
 * renders live data so a deployed store never shows stale products.
 */

function runtimeApiBase(configured: string): string {
  if (typeof window === "undefined" || !configured) return configured;
  try {
    const target = new URL(configured);
    const localTarget = target.hostname === "localhost" ||
      target.hostname === "127.0.0.1" ||
      target.hostname === "::1" ||
      /^10\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\./.test(target.hostname);
    const browserHost = window.location.hostname;
    const localBrowser = browserHost === "localhost" || browserHost === "::1" ||
      /^127\.|^10\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\./.test(browserHost);
    if (!localTarget || (!import.meta.env?.DEV && !localBrowser)) return configured;
    const host = window.location.hostname.includes(":")
      ? `[${window.location.hostname}]`
      : window.location.hostname;
    return `${target.protocol}//${host}${target.port ? `:${target.port}` : ""}`;
  } catch {
    return configured;
  }
}

export const API_BASE: string = runtimeApiBase(
  (import.meta.env?.VITE_API_URL as string | undefined) ?? "",
);
const STORE_SLUG: string = (import.meta.env?.VITE_STORE_SLUG as string | undefined) ?? "";
const BASE_DOMAIN: string = (import.meta.env?.VITE_STOREFRONT_BASE_DOMAIN as string | undefined) ?? "tijarago.com";

/**
 * Which store this bundle is serving. Dev sets VITE_STORE_SLUG explicitly;
 * in production the same static bundle is shared by every store subdomain
 * (<slug>.tijarago.com), so the slug is derived from the page host.
 * The API lives on its own host (api.tijarago.com) whose Host can't
 * identify the store, hence the explicit header.
 */
function resolveStoreSlug(): string {
  if (STORE_SLUG) return STORE_SLUG;
  if (typeof window === "undefined") return "";
  const host = window.location.hostname.toLowerCase();
  const suffix = `.${BASE_DOMAIN}`;
  if (host.endsWith(suffix) && host.length > suffix.length) {
    const slug = host.slice(0, -suffix.length);
    if (!slug.includes(".") && !["www", "api", "admin", "store"].includes(slug)) return slug;
  }
  return "";
}

const STORE_SLUG_RUNTIME: string = resolveStoreSlug();

/** Official showroom tenants are preview-only. Their document may load only
 * inside the studio; a top-level visit must not reveal a working demo origin. */
export function isProtectedPreviewStore(): boolean {
  const previewPath = typeof window !== "undefined" && window.location.pathname.startsWith("/theme-preview/");
  return STORE_SLUG_RUNTIME.startsWith("demo-") || previewPath;
}

let previewSession: { ticket: string; preset: string } | null = null;

/** In-memory capability delivered by the trusted showroom parent. It is
 * deliberately never persisted or placed in the storefront URL. */
export function configurePreviewSession(ticket: string, preset = ""): void {
  previewSession = ticket ? { ticket, preset } : null;
}

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string[]>;

  constructor(message: string, status: number, code = "", fields: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrfToken) {
    await fetchCsrfToken();
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) ? { "X-CSRFToken": csrfToken } : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (STORE_SLUG_RUNTIME) headers["X-Store-Slug"] = STORE_SLUG_RUNTIME;
  if (previewSession) {
    headers["X-Preview-Ticket"] = previewSession.ticket;
    if (previewSession.preset) headers["X-Preview-Preset"] = previewSession.preset;
  }
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";

  // Revalidate on navigation so browser stale-while-revalidate does not retain
  // a previous catalog or moderation state after a normal refresh.
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", cache: "no-cache", ...init, headers });
  if (!res.ok) {
    let detail = `API ${res.status} ${path}`;
    let code = "";
    let fields: Record<string, string[]> = {};
    try {
      const body = (await res.json()) as Record<string, unknown>;
      if (typeof body.detail === "string") detail = body.detail;
      if (typeof body.code === "string") code = body.code;
      fields = Object.fromEntries(Object.entries(body)
        .filter(([key]) => key !== "detail" && key !== "code")
        .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : [String(value)]]));
      if (!code) code = Object.keys(fields)[0] ?? "";
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(detail, res.status, code, fields);
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Normalize DRF decimal strings and optional JSON fields at the API boundary. */
export function normalizeVariant(input: Variant): Variant {
  return {
    ...input,
    price: input.price === null ? null : numberValue(input.price),
    compare_at_price: input.compare_at_price == null ? null : numberValue(input.compare_at_price),
    effective_price: input.effective_price == null ? undefined : numberValue(input.effective_price),
    effective_compare_at_price: input.effective_compare_at_price == null ? null : numberValue(input.effective_compare_at_price),
    quantity: numberValue(input.quantity),
    reserved: numberValue(input.reserved),
    available_quantity: numberValue(input.available_quantity),
    attributes: input.attributes && typeof input.attributes === "object" ? input.attributes : {},
    extra: input.extra && typeof input.extra === "object" ? input.extra : {},
  };
}

export function normalizeProduct(input: Product): Product {
  return {
    ...input,
    price: numberValue(input.price),
    compare_at_price: input.compare_at_price == null ? null : numberValue(input.compare_at_price),
    promo: numberValue(input.promo),
    loyalty_points: numberValue(input.loyalty_points),
    rating: numberValue(input.rating),
    reviews_count: numberValue(input.reviews_count),
    is_featured: Boolean(input.is_featured),
    uses_variants: Boolean(input.uses_variants ?? input.variants?.some((variant) => Object.keys(variant.attributes ?? {}).length > 0)),
    show_related_products: Boolean(input.show_related_products),
    track_inventory: input.track_inventory !== false,
    inventory: input.inventory == null ? null : numberValue(input.inventory),
    inventory_ready: input.inventory_ready == null ? undefined : Boolean(input.inventory_ready),
    merchandising_order: numberValue(input.merchandising_order),
    attributes: input.attributes && typeof input.attributes === "object" ? input.attributes : {},
    variant_options: Array.isArray(input.variant_options) ? input.variant_options : [],
    extra: input.extra && typeof input.extra === "object" ? input.extra : {},
    images: Array.isArray(input.images) ? input.images : [],
    variants: Array.isArray(input.variants) ? input.variants.map(normalizeVariant) : [],
  };
}

/**
 * Customer returned by the auth endpoints.
 */
export interface Customer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  address: string;
  city: string;
  country: string;
  preferredLanguage: "en" | "fr" | "ar";
  loyaltyPoints: number;
  createdAt: string;
}

export interface CustomerRegistration {
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  password: string;
  confirmPassword: string;
  preferredLanguage: "en" | "fr" | "ar";
}

export interface RegistrationPending {
  verificationRequired: true;
  email: string;
}

export interface CustomerOrderItem {
  id: number;
  product_id: number;
  name: string;
  quantity: number;
  fulfilled_quantity: number;
  price: string;
  attributes: Record<string, unknown>;
}

export interface CustomerOrder {
  order_id: string;
  amount: string;
  subtotal: string;
  shipping_amount: string;
  discount_amount: string;
  coupon_code: string;
  coupon_discount_type: "percentage" | "fixed" | "";
  coupon_value: string | null;
  exception: boolean;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  payment_mode: "online" | "cod";
  is_paid: "pending" | "confirmed" | "failed" | "cod";
  currency: string;
  tracking_number: string;
  carrier: string;
  created_at: string;
  updated_at: string;
  items: CustomerOrderItem[];
  invoice: { number: string; status: "ready" } | null;
}

/** Guard for the 401/409 auth failures so callers can show specific hints. */
export class AuthError extends ApiError {}

let csrfToken: string | null = null;

/** Fetch the CSRF token the API issues for cookie-authenticated writes. */
async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" });
  if (res.ok) {
    const body = (await res.json()) as { csrfToken?: string };
    if (body.csrfToken) csrfToken = body.csrfToken;
  }
  return csrfToken ?? "";
}

/** Credential + CSRF headers for the cookie-based customer endpoints. */
function withAuth(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: "include",
    headers: {
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
  };
}

export const CUSTOMER_SESSION_EXPIRED_EVENT = "tijarago:customer-session-expired";

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, withAuth(init));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 409)) {
      if (err.status === 401 && typeof window !== "undefined"
        && ["/api/auth/me/", "/api/auth/profile/", "/api/orders/mine/"].includes(path.split("?", 1)[0])) {
        window.dispatchEvent(new Event(CUSTOMER_SESSION_EXPIRED_EVENT));
      }
      throw new AuthError(err.message, err.status, err.code);
    }
    throw err;
  }
}

function authPost<T>(path: string, body: unknown): Promise<T> {
  return authRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/**
 * Customer-auth endpoints — the client scope of the API's cookie scheme.
 * Sessions live in tenant-scoped httpOnly cookies (set by the API), so the
 * storefront never stores tokens itself.
 */
export const customerAuth = {
  register(input: CustomerRegistration): Promise<RegistrationPending> {
    return authPost<RegistrationPending>("/api/auth/register/", input);
  },
  async login(email: string, password: string): Promise<Customer> {
    const res = await authPost<{ customer: Customer }>("/api/auth/login/", { email, password });
    return res.customer;
  },
  async logout(): Promise<void> {
    await fetchCsrfToken();
    await authRequest<void>("/api/auth/logout/", { method: "POST" });
  },
  async me(): Promise<Customer> {
    const res = await authRequest<{ customer: Customer }>("/api/auth/me/");
    return res.customer;
  },
  async verifyEmail(token: string): Promise<Customer> {
    const res = await authPost<{ customer: Customer }>("/api/auth/verify-email/", { token });
    return res.customer;
  },
  resendVerification(email: string): Promise<{ message: string }> {
    return authPost<{ message: string }>("/api/auth/resend-verification/", { email });
  },
  requestPasswordReset(email: string): Promise<{ message: string }> {
    return authPost<{ message: string }>("/api/auth/password-reset/", { email });
  },
  confirmPasswordReset(token: string, password: string): Promise<{ message: string }> {
    return authPost<{ message: string }>("/api/auth/password-reset/confirm/", { token, password });
  },
  async updateProfile(input: Partial<Pick<Customer, "firstName" | "lastName" | "phone" | "address" | "city" | "country" | "preferredLanguage">>): Promise<Customer> {
    await fetchCsrfToken();
    const res = await authRequest<{ customer: Customer }>("/api/auth/profile/", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return res.customer;
  },
  orders(): Promise<CustomerOrder[]> {
    return authRequest<CustomerOrder[]>("/api/orders/mine/");
  },
  async invoice(orderId: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (STORE_SLUG_RUNTIME) headers["X-Store-Slug"] = STORE_SLUG_RUNTIME;
    const response = await fetch(`${API_BASE}/api/orders/${orderId}/invoice/`, { credentials: "include", headers });
    if (!response.ok) throw new AuthError("Invoice unavailable", response.status);
    return response.blob();
  },
};

/** Fresh catalog fetch on every call — the storefront never caches stale data. */
export interface ProductReview {
  id: number;
  customer_name: string;
  rating: number;
  title: string;
  content: string;
  verified_purchase: boolean;
  created_at: string;
}

export const api = {
  getProductReviews(slug: string) {
    return request<ProductReview[]>(`/api/catalog/products/${encodeURIComponent(slug)}/reviews/`);
  },
  submitProductReview(slug: string, data: Pick<ProductReview, "customer_name" | "rating" | "title" | "content">) {
    return post<ProductReview>(`/api/catalog/products/${encodeURIComponent(slug)}/reviews/`, data);
  },
  /**
   * Runtime storefront config (Option A). The store is resolved server-side:
   * subdomain in production (mystore.tijarago.com -> mystore), or the
   * X-Store-Slug header in dev. The same static bundle therefore serves ANY
   * store — no per-store env vars or builds.
   */
  getStoreConfig(): Promise<import("../config").StorefrontConfig> {
    // Older deployed bundles omit this capability and receive plain page copy.
    return request<import("../config").StorefrontConfig>("/api/storefront/config/?rich_text=1");
  },
  getSections(lang?: string): Promise<CatalogSection[]> {
    return request<CatalogSection[]>("/api/catalog/sections/", { headers: lang ? { "Accept-Language": lang } : undefined });
  },
  async getProducts(section?: SectionKey, lang?: string): Promise<Product[]> {
    const products = await request<Product[]>(`/api/catalog/products/${section ? `?section=${encodeURIComponent(section)}` : ""}`, {
      headers: lang ? { "Accept-Language": lang } : undefined,
    });
    return products.map(normalizeProduct);
  },
  async getProductsPage(options: { section?: SectionKey; source?: string; offset?: number; limit?: number; lang?: string } = {}): Promise<{ count: number; results: Product[] }> {
    const params = new URLSearchParams({ limit: String(options.limit ?? 48), offset: String(options.offset ?? 0) });
    if (options.section && options.section !== "all") params.set("section", options.section);
    if (options.source) params.set("source", options.source);
    const page = await request<{ count: number; results: Product[] }>(`/api/catalog/products/?${params}`, {
      headers: options.lang ? { "Accept-Language": options.lang } : undefined,
    });
    if (Array.isArray(page)) return { count: page.length, results: page.map(normalizeProduct) };
    return { count: page.count, results: page.results.map(normalizeProduct) };
  },
  async getProduct(slug: string): Promise<Product> {
    return normalizeProduct(await request<Product>(`/api/catalog/products/${encodeURIComponent(slug)}/`));
  },
  async getStock(productId: number): Promise<Variant[]> {
    const variants = await request<Variant[]>(`/api/catalog/products/${productId}/stock/`);
    return variants.map(normalizeVariant);
  },
  /** Public newsletter signup (GET/POST are public; store resolved like catalog). */
  subscribe(email: string): Promise<{ detail: string }> {
    return post<{ detail: string }>("/api/subscribe/", { email });
  },
  submitContactInquiry(data: { name: string; email: string; phone?: string; subject: string; message: string; website?: string }): Promise<{ detail: string }> {
    return post<{ detail: string }>("/api/contact/", data);
  },
};

export { request };
