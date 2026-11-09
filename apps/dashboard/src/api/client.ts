export const API_BASE: string =
  import.meta.env?.DEV
    ? "/backend"
    : (import.meta.env?.VITE_API_URL as string | undefined) ||
      "https://api.tijarago.com";

export interface RetailFieldConfig {
  enabled?: boolean;
  sort_order?: number;
  visible: boolean;
  required: boolean;
  type?: "text" | "number" | "select" | "date" | "url" | "string_list";
  choices?: string[];
}

export interface CatalogConfiguration {
  retail_type: number | null;
  catalog_config: RetailType["config"];
  registry: Array<{key: string; type: string; choices: string[]}>;
}

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

export interface StoreMember {
  id: number;
  user: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export interface AccessRole {
  id: number; key: string; name: string; description: string; permissions: string[];
  field_permissions: Record<string, Record<string, { view: boolean; edit: boolean }>>;
  is_system: boolean; is_active: boolean; affected_staff_count: number; created_at: string; updated_at: string;
}
export interface AccessGroup {
  id: number; name: string; description: string; is_active: boolean; role_ids: number[];
  member_ids: number[]; inherited_permissions: string[]; created_at: string; updated_at: string;
}
export interface AccessMember extends StoreMember {
  role_ids: number[]; group_ids: number[]; direct_permissions: string[];
  direct_field_permissions: Record<string, Record<string, { view: boolean; edit: boolean }>>;
  is_active: boolean; effective_permissions: string[];
  effective_field_permissions: Record<string, Record<string, { view: boolean; edit: boolean }>>;
}
export interface StaffInvitation {
  public_id: string; email: string; first_name: string; last_name: string;
  status: "pending" | "accepted" | "expired" | "revoked"; role_ids: number[]; group_ids: number[];
  expires_at: string; created_at: string;
}
export interface PermissionCatalog {
  permissions: Record<string, Array<{ key: string; description: string }>>;
  fields: Record<string, Array<{ key: string; label: string; sensitive: boolean }>>;
}
export interface AccessAuditEvent {
  id: number; actor_email: string | null; target_type: string; target_id: string;
  action: string; before: Record<string, unknown>; after: Record<string, unknown>; correlation_id: string; created_at: string;
}

export interface Store {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  logo_url: string | null;
  retail_type: number | null;
  retail_type_detail: RetailType | null;
  catalog_config: RetailType["config"];
  members: StoreMember[];
  storefront_url: string | null;
  storefront_request_id: number | null;
  storefront_status: "draft" | "preparing" | "live" | "failed";
  storefront_progress: number;
  plan: "free" | "premium";
  analytics_level: "essential" | "standard" | "advanced";
  created_at: string;
}

export interface StorefrontDeployment {
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
  operation: "create" | "update" | "redesign";
  deployed_url: string;
  created_at: string;
}

export interface SubscriptionPlan {
  id: number; name: string; slug: string; description: string; price: string; currency: string;
  translations?: Record<"en" | "fr" | "ar", { name: string; description: string }>;
  duration_days: number; entitlement_scope: "all_owned_stores" | "one_store"; features: string[];
  benefits?: Array<{
    key: string; name: string; description: string; value: boolean | number | string; unit: string; display: string;
    scope?: "account" | "store" | "user"; counting_rules?: string; reset_window?: string;
    missing_behavior?: string; zero_behavior?: string; downgrade_behavior?: string;
    translations?: Record<"en" | "fr" | "ar", { name: string; description: string; display: string }>;
  }>;
  grants_premium_designs: boolean; is_featured: boolean; is_free: boolean;
}
export interface PlanCatalog {
  plans: SubscriptionPlan[];
  billing: {
    available: boolean;
    sandbox: boolean;
    provider: { code: string; name: string };
    gateways: Array<{ code: string; name: string; sandbox: boolean }>;
  };
}
export interface SubscriptionPaymentStatus {
  id: string;
  plan_id: number | null;
  plan_name: string;
  gross_amount: string;
  amount: string;
  balance_applied: string;
  balance_authorized: boolean;
  credit_after_confirmation: string;
  currency: string;
  provider: string;
  status: "pending" | "confirmed" | "failed" | "duplicate" | "canceled";
  entitlement_scope: "all_owned_stores" | "one_store";
  selected_store_id: number | null;
  processed_at: string | null;
  created_at: string;
}
export interface SubscriptionStatus {
  access: { allowed: boolean; code: "subscription_required" | null };
  subscription: null | {
    status: "inactive" | "active" | "canceled" | "expired";
    plan: SubscriptionPlan | null;
    selected_store: { id: number; name: string; slug: string } | null;
    started_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean;
  };
  subscriptions: Array<NonNullable<SubscriptionStatus["subscription"]>>;
  latest_payment: SubscriptionPaymentStatus | null;
  payment: SubscriptionPaymentStatus | null;
  balances: Array<{ currency: string; balance: string; reserved: string; available: string }>;
}

export interface StoreEmailForwarding {
  alias: string;
  configured: boolean;
  active_destination: string;
  pending_destination: string;
  pending_verified: boolean;
  status: "inactive" | "pending" | "active";
  sending_available: boolean;
}

export interface MailboxSummary {
  address: string;
  configured: boolean;
  enabled: boolean;
  unread: number;
  open: number;
}

export interface MailAttachment {
  id: number;
  filename: string;
  content_type: string;
  size: number;
  content_id: string;
  url: string;
}

export interface MailMessage {
  public_id: string;
  direction: "inbound" | "outbound";
  status: "received" | "queued" | "sent" | "delivered" | "delayed" | "bounced" | "complained" | "failed";
  sender_email: string;
  sender_name: string;
  recipient_email: string;
  subject: string;
  text_body: string;
  html_body: string;
  message_id: string;
  in_reply_to: string;
  attachments: MailAttachment[];
  created_at: string;
}

export interface MailConversation {
  public_id: string;
  correspondent_email: string;
  correspondent_name: string;
  subject: string;
  status: "open" | "archived";
  unread_count: number;
  last_message_at: string;
  latest_message: MailMessage | null;
  messages?: MailMessage[];
}

export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[] }

export interface StoreConfig {
  remove_platform_branding: boolean;
  can_remove_platform_branding: boolean;
  currency: string;
  default_locale: "ar" | "fr" | "en";
  payment_provider: string;
  payment_gateway: {
    code: string;
    name: string;
    configured: boolean;
    sandbox: boolean;
    credential_fields: Array<{ key: string; label: string; type?: string; secret: boolean; required: boolean }>;
    available_providers: Array<{
      code: string;
      name: string;
      credential_fields: Array<{ key: string; label: string; type?: string; secret: boolean; required: boolean }>;
      availability?: "available" | "future";
      selectable?: boolean;
    }>;
  };
  payment_keys: Record<string, string | boolean>;
  cod_enabled: boolean;
  from_email: string;
  brand_color: string;
  loyalty_enabled: boolean;
  shipping_fee: number;
  free_shipping_enabled: boolean;
  free_shipping_threshold: number | null;
  free_shipping_currency: string;
  invoice_enabled: boolean;
  invoice_legal_name: string;
  invoice_billing_address: string;
  invoice_country: string;
  invoice_contact_email: string;
  invoice_identifiers: Record<string, string>;
  invoice_issuer_scope: string;
  invoice_series_prefix: string;
  invoice_tax_regime: "review" | "exempt" | "product";
  invoice_tax_rate: number | null;
  invoice_prices_include_tax: boolean;
  invoice_shipping_tax_rate: number | null;
  invoice_tax_wording: string;
  design: string;
  contact_email: string;
  support_phone: string;
  whatsapp_phone: string;
  social_links: Record<string, string>;
  homepage_product_source: "featured" | "newest" | "discounted" | "top_rated";
  homepage_product_limit: number;
  domain: string;
  appearance: StorefrontAppearance;
  seo_title: string;
  seo_description: string;
  seo_social_image: string;
  allow_search_indexing: boolean;
}

export interface StorefrontDomainRecord {
  id: number;
  hostname: string;
  display_hostname: string;
  kind: "platform" | "custom" | "provider";
  status: "pending" | "awaiting_ownership" | "awaiting_dns" | "verifying" | "active" | "failed" | "removing";
  is_primary: boolean;
  healthy: boolean;
  url: string;
  ownership_verified_at: string | null;
  expected_dns_records: Array<{ purpose?: string; type: string; name: string; value: string }>;
  provider_verified: boolean;
  certificate_status: "unknown" | "pending" | "valid" | "failed";
  health_verified_at: string | null;
  last_checked_at: string | null;
  next_retry_at: string | null;
  failure_code: string;
  public_message: string;
  redirect_to: string;
}

export interface StorefrontAppearance {
  schema_version: 1;
  typography: {
    body_font: "system" | "modern" | "humanist" | "editorial" | "arabic";
    heading_font: "system" | "modern" | "humanist" | "editorial" | "arabic";
    base_size: "small" | "medium" | "large";
    heading_scale: "compact" | "medium" | "large";
  };
  header: {
    layout: "theme" | "logo_start" | "logo_center";
    sticky: "none" | "always";
    width: "contained" | "full";
    logo_size: "compact" | "standard" | "large";
    nav_alignment: "start" | "center";
    show_search: boolean;
    show_account: boolean;
    show_language: boolean;
    show_cart: boolean;
    show_categories?: boolean;
    show_about?: boolean;
    show_contact?: boolean;
  };
  style: {
    button_shape: "square" | "rounded" | "pill";
    card_shape: "square" | "rounded" | "soft";
    card_padding: "none" | "compact" | "comfortable";
    card_alignment: "start" | "center";
    card_hover: "none" | "shadow" | "lift";
    content_width: "compact" | "standard" | "wide";
  };
  colors: {
    theme_primary: string; theme_secondary: string; theme_muted: string;
    page: string; header: string; header_text: string; navigation: string; navigation_text: string; announcement: string; hero: string;
    section: string; card: string; discount_badge: string; discount_badge_text: string; newsletter: string; footer: string;
  };
  footer: {
    show_contact: boolean;
    show_social_links: boolean;
    copyright: LocalizedStorefrontText;
  };
}

export type StorefrontEditorLocale = "en" | "fr" | "ar";
export type LocalizedStorefrontText = Record<StorefrontEditorLocale, string>;
export type StorefrontSectionType = "announcement" | "hero" | "slideshow" | "promotional_banner" | "collections" | "products" | "image_text" | "newsletter" | "theme_feature" | "product_main" | "product_assurances" | "related_products";
export type { StorefrontSlide, StorefrontAnnouncementItem } from "../../../../packages/storefront-core/src/config";
import type { StorefrontSlide, StorefrontAnnouncementItem } from "../../../../packages/storefront-core/src/config";

export interface StorefrontPageSection {
  id: string;
  type: StorefrontSectionType;
  enabled: boolean;
  settings: Record<string, LocalizedStorefrontText | StorefrontSlide[] | StorefrontAnnouncementItem[] | string | number | boolean>;
}

export interface StorefrontPageDocument {
  page_key: string;
  page_type: "system" | "content" | "policy";
  route: string;
  title: LocalizedStorefrontText;
  is_visible: boolean;
  show_in_navigation: boolean;
  sort_order: number;
  is_protected: boolean;
  draft_sections: StorefrontPageSection[];
  published_sections: StorefrontPageSection[];
  revision: number;
  published_at: string | null;
  updated_at: string;
}

export interface Customer {
  id: number;
  email: string;
  name: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  preferred_language: "en" | "fr" | "ar";
  email_verified: boolean;
  phone_verified: boolean;
  marketing_subscribed: boolean;
  loyalty_points: number;
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
}

export interface OrderedProduct {
  id: number;
  product_id: number;
  variant_id: number | null;
  section_key: string;
  ref: string;
  name: string;
  attributes: Record<string, unknown>;
  quantity: number;
  fulfilled_quantity: number;
  reserved_quantity: number;
  price: number;
  tax_rate?: number | null;
  available: boolean;
  stock_deducted: boolean;
  exception_id: string | null;
}

export interface QuantityException {
  id: string;
  product_id: number;
  section_key: string;
  ref: string;
  name: string;
  attributes: Record<string, unknown>;
  delta_quantity: number;
  treated: boolean;
}

export interface OrderStatusHistory {
  id: number;
  from_status: string;
  to_status: string;
  changed_by: { id: number; email: string; role: string } | null;
  notes: string;
  created_at: string;
}

export interface Order {
  id: number;
  order_id: string;
  amount: number;
  subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  tax_breakdown: Array<{ rate: string; base: string; tax: string; shipping?: boolean }>;
  discount_amount: number;
  coupon_code: string;
  coupon_discount_type: "percentage" | "fixed" | "";
  coupon_value: number | null;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  exception: boolean;
  payment_mode: "online" | "cod";
  is_paid: "pending" | "confirmed" | "failed" | "cod";
  invoice_locale: "fr" | "en" | "ar" | "";
  currency: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  customer_notes: string;
  marketing_consent: boolean;
  loyalty_points_awarded: number;
  items_acknowledged_at: string | null;
  items_acknowledged_by: number | null;
  delivery_person: { id: number; email: string; role: string } | null;
  tracking_number: string;
  carrier: string;
  cancelled_by: "" | "merchant" | "customer";
  cancel_reason: string;
  cancelled_at: string | null;
  merchant_notes: string;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  items: OrderedProduct[];
  exceptions: QuantityException[];
  status_history: OrderStatusHistory[];
  invoice: { number: string; status: "issued" | "rendering" | "ready" | "needs_review" | "void"; delivery_status: "pending" | "sent" | "failed" } | null;
}

export interface AnalyticsReport {
  level: "essential" | "standard" | "advanced";
  range_days: 7 | 30 | 90 | 365;
  available_ranges: Array<7 | 30 | 90 | 365>;
  currency: string;
  generated_at: string;
  has_data: boolean;
  kpis: {
    collected_revenue: string;
    average_order_value: string;
    customers: number;
    products: number;
    average_items_per_order: number;
    out_of_stock_products: number;
  };
  daily: Array<{ date: string; revenue: string; orders: number }>;
  order_status: Record<"pending" | "confirmed" | "shipped" | "delivered" | "cancelled", number>;
  standard: null | {
    weekdays: Array<{ day: number; revenue: string; orders: number }>;
    hours: Array<{ hour: number; revenue: string; orders: number }>;
    top_products: Array<{ product_id: number; name: string; quantity: number; revenue: string }>;
    payment: { online: string; cod: string };
    stock: { in_stock: number; low_stock: number; out_of_stock: number };
    funnel: AnalyticsFunnel;
    product_performance: AnalyticsProductPerformance[];
    zero_result_searches: Array<{ query: string; searches: number }>;
  };
  advanced: null | {
    revenue_change_percent: number | null;
    repeat_customer_rate: number;
    cancellation_rate: number;
    average_fulfilment_hours: number;
    best_weekday: number | null;
    best_hour: number | null;
    funnel_comparison: {
      previous: AnalyticsFunnel;
      change_percent: Record<"store_visits" | "product_views" | "cart_additions" | "checkout_starts" | "order_submissions", number | null>;
    };
    funnel_trend: AnalyticsFunnelTrend[];
    product_intelligence: AnalyticsProductPerformance[];
    sources: AnalyticsSourcePerformance[];
    opportunities: AnalyticsOpportunity[];
  };
}

export interface AnalyticsFunnel {
  store_visits: number;
  product_views: number;
  cart_additions: number;
  checkout_starts: number;
  order_submissions: number;
  unique_sessions: {
    product_views: number;
    cart_additions: number;
    checkout_starts: number;
    order_submissions: number;
  };
  rates: {
    add_to_cart: number;
    checkout_start: number;
    order_submission: number;
    cart_abandonment: number;
    checkout_abandonment: number;
  };
}

export interface AnalyticsProductPerformance {
  product_id: number;
  name: string;
  views: number;
  view_sessions: number;
  cart_additions: number;
  cart_sessions: number;
  orders: number;
  quantity: number;
  collected_orders: number;
  conversion_rate: number;
  revenue: string;
  revenue_per_view?: string;
}

export interface AnalyticsFunnelTrend {
  date: string;
  visits: number;
  product_views: number;
  cart_additions: number;
  checkout_starts: number;
  order_submissions: number;
  collected_orders: number;
}

export interface AnalyticsSourcePerformance {
  source: string;
  campaign: string;
  visits: number;
  order_submissions: number;
  collected_orders: number;
  revenue: string;
  conversion_rate: number;
}

export interface AnalyticsOpportunity {
  kind: "high_traffic_low_conversion" | "carted_not_ordered" | "high_cart_abandonment";
  severity: "warning";
  product_id: number | null;
  product_name: string;
  metrics: Record<string, number>;
}

export interface Campaign {
  id: string;
  subject: string;
  preview_text: string;
  body_html: string;
  body_text: string;
  language: "en" | "fr" | "ar";
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
}

export interface AttributeDef {
  id: number;
  key: string;
  label: string;
  type: string;
  level: "product" | "variant";
  options: Array<{ value: string; label: string }> | string[];
  required: boolean;
  sort_order: number;
}

export interface CatalogSection {
  id: number;
  key: string;
  label: string;
  description?: string;
  thumbnail?: string;
  is_visible?: boolean;
  parent?: number | null;
  sort_mode?: "manual" | "newest" | "price_asc" | "price_desc" | "name_asc";
  icon: string;
  sort_order: number;
  attribute_defs: AttributeDef[];
}

export interface ProductImage {
  id: number;
  image: string;
  media_type?: "image" | "external_video";
  external_url?: string;
  alt_text?: string;
  is_primary: boolean;
  order: number;
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

export interface StockVariant {
  id: number;
  attributes: Record<string, string | number | boolean | string[] | null>;
  price: number | null;
  sku?: string;
  barcode?: string;
  weight?: number | null;
  image?: ProductImage | null;
  quantity: number;
  reserved: number;
  available_quantity: number;
  extra: Record<string, unknown>;
}

export interface ProductVendor {
  id: number;
  name: string;
  slug: string;
}

export interface ProductVariantOption {
  key: string;
  label: string;
  type: "select" | "color" | "text";
  values: ProductVariantValue[];
}

export type ProductVariantValue = string | {
  value: string;
  label: string;
  swatch?: string;
};

export interface Product {
  id: number;
  section: number;
  categories?: CatalogSection[];
  name: string;
  slug?: string;
  ref: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  promo: number | null;
  loyalty_points: number;
  rating: number;
  reviews_count: number;
  extra: Record<string, unknown>;
  tags?: string[];
  seo_title?: string;
  seo_description?: string;
  seo_social_image?: string;
  vendors?: ProductVendor[];
  related_product_ids?: number[];
  attributes: Record<string, string | number | boolean | string[] | null>;
  variant_options?: ProductVariantOption[];
  is_active: boolean;
  uses_variants?: boolean;
  show_related_products?: boolean;
  track_inventory?: boolean;
  is_featured: boolean;
  merchandising_order: number;
  images: ProductImage[];
  variants: StockVariant[];
  inventory_ready: boolean;
  inventory?: number | null;
  has_variants?: boolean;
  variants_count?: number;
  you_save_amount?: number;
  created_at: string;
  updated_at?: string;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: "percentage" | "fixed";
  value: string;
  scope: "all_products" | "categories" | "products";
  category_ids: number[];
  product_ids: number[];
  minimum_subtotal: string;
  maximum_discount: string | null;
  total_usage_limit: number | null;
  per_customer_usage_limit: number | null;
  usage_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  availability: "active" | "paused" | "scheduled" | "expired" | "exhausted";
  created_at: string;
  updated_at: string;
}

export interface DesignInfo {
  key: string;
  status: "ready" | "building";
  name: string;
  tagline: string;
  description: string;
  screenshots: string[];
  demo_url: string | null;
  tier?: "standard" | "premium";
  features?: string[];
  feature_maturity?: Record<string, "production" | "beta" | "prototype">;
  config_schema: Array<Record<string, unknown>>;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  code: string | null;
  payload?: Record<string, unknown>;
  constructor(status: number, detail: string, code: string | null = null, payload?: Record<string, unknown>) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.payload = payload;
  }
}

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

export async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/accounts/csrf`, { credentials: "include" });
    if (res.ok) {
      const body = (await res.json()) as { csrfToken?: string };
      if (body.csrfToken) csrfToken = body.csrfToken;
    }
  } catch {
    // Network error — will retry on next call
  }
  return csrfToken ?? "";
}

function clearCsrf() {
  csrfToken = null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  if (UNSAFE_METHODS.has(method)) {
    if (!csrfToken) await fetchCsrfToken();
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

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
    const code = (
      data && typeof data === "object" && "code" in data && typeof data.code === "string"
    ) ? data.code : null;
    const payload = data && typeof data === "object" ? data as Record<string, unknown> : undefined;
    throw new ApiError(res.status, detail, code, payload);
  }
  return data as T;
}

async function uploadRequest<T>(path: string, body: FormData, onProgress?: (percent: number) => void, method = "POST"): Promise<T> {
  if (!csrfToken) await fetchCsrfToken();
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${path}`);
    xhr.withCredentials = true;
    if (csrfToken) xhr.setRequestHeader("X-CSRFToken", csrfToken);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      let data: unknown = null;
      if (xhr.responseText) {
        try { data = JSON.parse(xhr.responseText); } catch { data = xhr.responseText; }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(data as T);
        return;
      }
      notifyMerchantSessionExpired(path, xhr.status);
      const detail = extractDetail(data) ?? `Request failed (${xhr.status}).`;
      const code = data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : null;
      const payload = data && typeof data === "object" ? data as Record<string, unknown> : undefined;
      reject(new ApiError(xhr.status, detail, code, payload));
    });
    xhr.addEventListener("error", () => reject(new ApiError(0, "Upload failed.")));
    xhr.addEventListener("abort", () => reject(new ApiError(0, "Upload canceled.")));
    xhr.send(body);
  });
}

interface DirectUploadSignature {
  direct_upload: boolean;
  upload_url?: string;
  api_key?: string;
  signature?: string;
  params?: Record<string, string | number>;
  max_bytes?: number;
  allowed_formats?: string[];
}

interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  signature: string;
  resource_type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  secure_url?: string;
}

function uploadDirect(
  signature: DirectUploadSignature,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signature.api_key ?? "");
    form.append("signature", signature.signature ?? "");
    Object.entries(signature.params ?? {}).forEach(([key, value]) => form.append(key, String(value)));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", signature.upload_url ?? "");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 99)));
    });
    xhr.addEventListener("load", () => {
      let data: unknown = null;
      try { data = JSON.parse(xhr.responseText); } catch { data = xhr.responseText; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as CloudinaryUploadResponse);
      } else {
        reject(new ApiError(xhr.status, extractDetail(data) ?? "Cloud upload failed."));
      }
    });
    xhr.addEventListener("error", () => reject(new ApiError(0, "Cloud upload failed.")));
    xhr.addEventListener("abort", () => reject(new ApiError(0, "Upload canceled.")));
    xhr.send(form);
  });
}

async function optimizedUpload<T>(
  signPath: string,
  attachPath: string,
  file: File,
  attachFields: Record<string, unknown>,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const signed = await request<DirectUploadSignature>(signPath, json("POST", {}));
  if (!signed.direct_upload) {
    const form = new FormData();
    form.append("image", file);
    Object.entries(attachFields).forEach(([key, value]) => form.append(key, String(value)));
    return uploadRequest<T>(attachPath, form, onProgress);
  }
  if (signed.max_bytes && file.size > signed.max_bytes) {
    throw new ApiError(400, `File is too large. Maximum size is ${Math.floor(signed.max_bytes / 1024 / 1024)} MB.`);
  }
  const uploaded = await uploadDirect(signed, file, onProgress);
  const result = await request<T>(attachPath, json("POST", { ...attachFields, direct_upload: uploaded }));
  onProgress?.(100);
  return result;
}

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

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export interface ProductReview {
  id: number;
  customer_name: string;
  rating: number;
  title: string;
  content: string;
  verified_purchase: boolean;
  created_at: string;
  product: number;
  status: "pending" | "published" | "rejected";
}

export const api = {
  listProductReviews(storeId: number) {
    return request<ProductReview[]>(`/api/catalog/store/${storeId}/reviews/`);
  },
  moderateProductReview(storeId: number, reviewId: number, status: ProductReview["status"]) {
    return request<ProductReview>(`/api/catalog/store/${storeId}/reviews/${reviewId}/`, json("PATCH", {status}));
  },
  resendMerchantVerification(email: string) {
    return request<{ message: string }>(
      "/accounts/verify-email/resend",
      json("POST", { email }),
    );
  },
  verifyMerchantEmail(token: string) {
    return request<{ message: string; verified: boolean; already_verified: boolean }>(
      "/accounts/verify-email",
      json("POST", { token }),
    );
  },
  requestPasswordReset(email: string) {
    return request<{ message: string }>("/accounts/password-reset", json("POST", { email }));
  },
  confirmPasswordReset(token: string, password: string) {
    return request<{ message: string }>("/accounts/password-reset/confirm", json("POST", { token, password }));
  },
  async login(email: string, password: string) {
    const result = await request<{ message: string; user: PlatformUser }>("/accounts/token", json("POST", { email, password, scope: "owner" }));
    clearCsrf();
    await fetchCsrfToken();
    return result;
  },
  async logout() {
    const result = await request<{ message: string }>("/accounts/logout", { method: "POST" });
    clearCsrf();
    return result;
  },
  me() {
    return request<{ message: string; user: PlatformUser }>("/accounts/me");
  },

  listSubscriptionPlans() {
    return request<PlanCatalog>("/api/subscriptions/plans");
  },
  subscriptionStatus(paymentId?: string | null) {
    const suffix = paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : "";
    return request<SubscriptionStatus>(`/api/subscriptions/status${suffix}`);
  },
  async createSubscriptionCheckout(planId: number, storeId: number | null, lang: "en" | "fr" | "ar", useBalance: boolean, provider: string) {
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      plan_id: planId,
      store_id: storeId,
      lang,
      return_origin: window.location.origin,
      use_balance: useBalance,
      provider,
      idempotency_key: idempotencyKey,
    };
    const create = () => request<{ payment_id: string; payment_url: string; gross_amount: string; balance_applied: string; balance_authorized: boolean; amount: string; credit_after_confirmation: string; currency: string }>(
      "/api/subscriptions/checkout",
      {
        ...json("POST", payload),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    try {
      return await create();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return create();
    }
  },

  listStores() {
    return request<Store[]>("/api/store/");
  },
  createStore(data: { name: string; slug: string; retail_type?: number | null }) {
    return request<Store>("/api/store/", json("POST", data));
  },
  startStorefront(requestId: number) {
    return request<StorefrontDeployment>(`/api/requests/${requestId}/scaffold`, json("POST", {}));
  },
  getStorefrontDeployment(requestId: number) {
    return request<StorefrontDeployment>(`/api/requests/${requestId}/`);
  },
  createStorefrontDeployment(input: {
    store: number;
    design: string;
    config: { store_name: string; brand_color?: string; currency?: string; contact_email?: string };
  }) {
    return request<StorefrontDeployment>("/api/requests/", json("POST", input));
  },
  deleteStore(storeId: number, storeName: string, confirmation: string) {
    return request<null>(`/api/store/${storeId}/`, json("DELETE", { store_name: storeName, confirmation }));
  },
  getCatalogConfiguration(storeId: number) {
    return request<CatalogConfiguration>(`/api/catalog/store/${storeId}/configuration/`);
  },
  patchCatalogConfiguration(storeId: number, data: {retail_type: number | null; product_fields: Record<string, RetailFieldConfig>; variant_fields: Record<string, RetailFieldConfig>}) {
    return request<CatalogConfiguration>(`/api/catalog/store/${storeId}/configuration/`, json("PATCH", data));
  },
  catalogTransferCapabilities(storeId: number, language: "ar" | "fr" | "en" = "ar") {
    return request<{
      formats: Array<"csv" | "xlsx" | "json">;
      guide: {
        title: string; summary: string; steps: string[]; important_notes: string[];
        limits: { maximum_file_bytes: number; maximum_products: number | null; accepted_extensions: string[] };
        fields: Array<{ name: string; requirement: string; description: string }>;
        sections: Array<{ key: string; label: string }>;
        templates: { csv: string; xlsx: string };
      };
      export: { allowed: boolean; label: string; description: string };
      import: { allowed: boolean; label: string; description: string; entitlement: "catalog.import"; denial: null | { detail: string; rule: string } };
    }>(`/api/catalog/store/${storeId}/transfer-capabilities/?lang=${language}`);
  },
  getConfig(storeId: number) {
    return request<StoreConfig>(`/api/store/${storeId}/config/`);
  },
  patchConfig(storeId: number, patch: Partial<StoreConfig>) {
    return request<StoreConfig>(`/api/store/${storeId}/config/`, json("PATCH", patch));
  },
  async invoicePreview(storeId: number) {
    const response = await fetch(`${API_BASE}/api/store/${storeId}/invoice-preview/`, { credentials: "include" });
    if (!response.ok) throw new ApiError(response.status, `Invoice preview failed (${response.status}).`);
    return response.blob();
  },
  async downloadMerchantInvoice(storeId: number, orderId: string) {
    const response = await fetch(`${API_BASE}/api/store/${storeId}/orders/${orderId}/invoice/`, { credentials: "include" });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as unknown;
      const detail = extractDetail(data) ?? `Invoice download failed (${response.status}).`;
      const payload = data && typeof data === "object" ? data as Record<string, unknown> : undefined;
      throw new ApiError(response.status, detail, null, payload);
    }
    return response.blob();
  },
  async exportCatalog(storeId: number, format: "csv" | "xlsx" | "json" = "csv") {
    const response = await fetch(`${API_BASE}/api/catalog/store/${storeId}/export.csv?file_format=${format}`, { credentials: "include" });
    if (!response.ok) throw new ApiError(response.status, `Export failed (${response.status}).`);
    return response.blob();
  },
  async catalogImportTemplate(storeId: number, format: "csv" | "xlsx" | "json", language: "ar" | "fr" | "en" = "ar") {
    const response = await fetch(`${API_BASE}/api/catalog/store/${storeId}/import-template/?file_format=${format}&lang=${language}`, { credentials: "include" });
    if (!response.ok) throw new ApiError(response.status, `Template download failed (${response.status}).`);
    return response.blob();
  },
  async validateCatalogImport(
    storeId: number,
    files: File | File[],
    idempotencyKey: string,
    defaultSection = "",
    externalPolicy?: { publishProducts: boolean; includeUnavailable: boolean; defaultAvailableStock: number; defaultUnavailableStock: number },
    sectionResolutions?: Record<string, string>,
  ) {
    if (!csrfToken) await fetchCsrfToken();
    const form = new FormData();
    const selected = Array.isArray(files) ? files : [files];
    selected.forEach((file) => form.append("files", file));
    if (defaultSection) form.append("default_section", defaultSection);
    if (externalPolicy) {
      form.append("publish_products", String(externalPolicy.publishProducts));
      form.append("include_unavailable", String(externalPolicy.includeUnavailable));
      form.append("default_available_stock", String(externalPolicy.defaultAvailableStock));
      form.append("default_unavailable_stock", String(externalPolicy.defaultUnavailableStock));
    }
    if (sectionResolutions) form.append("section_resolutions", JSON.stringify(sectionResolutions));
    const response = await fetch(`${API_BASE}/api/catalog/store/${storeId}/imports/validate/`, {
      method: "POST", credentials: "include", body: form,
      headers: { ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}), "Idempotency-Key": idempotencyKey },
    });
    const data = await response.json();
    if (!response.ok) throw new ApiError(response.status, extractDetail(data) ?? "Import validation failed.");
    return data as {
      id: string; valid: boolean; rows: number; schema: string;
      errors: Array<{ sheet?: string; row?: number; column?: string; code?: string; message?: string; suggestion?: string }>;
      duplicate_policy: string; commit_policy: string;
      result: {
        preview?: { products: number; simple_products: number; variant_products: number; variants: number; stock: number; groups: Array<{ ref: string; combinations: Array<Record<string, string>>; effective_prices: string[] }> };
        created?: number; updated?: number; rejected?: number; failed?: number;
        currency?: string; stock_policy?: string; warnings?: string[];
        unknown_sections?: string[]; pending_sections?: Array<{ source: string; key: string; label: string }>;
      };
    };
  },
  commitCatalogImport(storeId: number, operationId: string) {
    return request<{ status: string; result: { created: number; updated: number; rejected: number; failed: number; processed: number; total: number; variants?: number } }>(
      `/api/catalog/store/${storeId}/imports/${operationId}/commit/`, json("POST", {}),
    );
  },
  getDomains(storeId: number) {
    return request<StorefrontDomainRecord[]>(`/api/store/${storeId}/domains/`);
  },
  connectDomain(storeId: number, hostname: string, includeWww: boolean) {
    return request<{ domains: StorefrontDomainRecord[] }>(`/api/store/${storeId}/domains/`, json("POST", { hostname, include_www: includeWww }));
  },
  verifyDomain(storeId: number, domainId: number) {
    return request<StorefrontDomainRecord>(`/api/store/${storeId}/domains/${domainId}/verify/`, json("POST", {}));
  },
  makeDomainPrimary(storeId: number, domainId: number) {
    return request<StorefrontDomainRecord>(`/api/store/${storeId}/domains/${domainId}/primary/`, json("POST", {}));
  },
  disconnectDomain(storeId: number, domainId: number) {
    return request<void>(`/api/store/${storeId}/domains/${domainId}/`, { method: "DELETE" });
  },
  getEmailForwarding(storeId: number) {
    return request<StoreEmailForwarding>(`/api/store/${storeId}/email-forwarding/`);
  },
  setEmailForwarding(storeId: number, destination: string) {
    return request<StoreEmailForwarding>(`/api/store/${storeId}/email-forwarding/`, json("POST", { destination }));
  },
  activateEmailForwarding(storeId: number) {
    return request<StoreEmailForwarding>(`/api/store/${storeId}/email-forwarding/`, json("POST", { action: "activate" }));
  },
  disableEmailForwarding(storeId: number) {
    return request<StoreEmailForwarding>(`/api/store/${storeId}/email-forwarding/`, json("POST", { action: "disable" }));
  },
  getMailboxSummary(storeId: number) {
    return request<MailboxSummary>(`/api/store/${storeId}/mailbox/`);
  },
  setMailboxEnabled(storeId: number, enabled: boolean) {
    return request<MailboxSummary>(`/api/store/${storeId}/mailbox/`, json("POST", { action: enabled ? "enable" : "disable" }));
  },
  listMailConversations(storeId: number, folder: "inbox" | "sent" | "archived", query = "") {
    const params = new URLSearchParams({ folder });
    if (query) params.set("q", query);
    return request<Paginated<MailConversation>>(`/api/store/${storeId}/mailbox/conversations/?${params}`);
  },
  getMailConversation(storeId: number, conversationId: string) {
    return request<MailConversation>(`/api/store/${storeId}/mailbox/conversations/${conversationId}/`);
  },
  updateMailConversation(storeId: number, conversationId: string, action: "archive" | "restore" | "read" | "unread") {
    return request<MailConversation>(`/api/store/${storeId}/mailbox/conversations/${conversationId}/`, json("PATCH", { action }));
  },
  composeMail(storeId: number, data: { to: string; subject: string; text: string; html?: string }) {
    return request<MailMessage>(`/api/store/${storeId}/mailbox/compose/`, json("POST", data));
  },
  replyMail(storeId: number, conversationId: string, data: { text: string; html?: string }) {
    return request<MailMessage>(`/api/store/${storeId}/mailbox/conversations/${conversationId}/reply/`, json("POST", data));
  },
  listCustomers(storeId: number) {
    return request<Customer[]>(`/api/store/${storeId}/customers/`);
  },

  listMembers(storeId: number) {
    return request<StoreMember[]>(`/api/store/${storeId}/members/`);
  },
  addMember(storeId: number, data: { email: string; first_name?: string; last_name?: string; password?: string; confirm_password?: string; role: string }) {
    return request<StoreMember>(`/api/store/${storeId}/members/`, json("POST", data));
  },
  updateMemberRole(storeId: number, memberId: number, role: string) {
    return request<StoreMember>(`/api/store/${storeId}/members/${memberId}/`, json("PATCH", { role }));
  },
  removeMember(storeId: number, memberId: number) {
    return request<null>(`/api/store/${storeId}/members/${memberId}/`, { method: "DELETE" });
  },
  accessCatalog: (storeId: number) => request<PermissionCatalog>(`/api/access/store/${storeId}/catalog/`),
  effectiveAccess: (storeId: number) => request<{ store_id: number; membership_id: number; permissions: string[]; field_permissions: AccessMember["effective_field_permissions"] }>(`/api/access/store/${storeId}/me/`),
  accessMembers: (storeId: number) => request<AccessMember[]>(`/api/access/store/${storeId}/members/`),
  updateAccessMember: (storeId: number, memberId: number, data: Partial<Pick<AccessMember, "role_ids" | "group_ids" | "direct_permissions" | "direct_field_permissions" | "is_active">>) => request<AccessMember>(`/api/access/store/${storeId}/members/${memberId}/`, json("PATCH", data)),
  revokeAccessMember: (storeId: number, memberId: number) => request<null>(`/api/access/store/${storeId}/members/${memberId}/`, { method: "DELETE" }),
  accessRoles: (storeId: number) => request<AccessRole[]>(`/api/access/store/${storeId}/roles/`),
  createAccessRole: (storeId: number, data: Pick<AccessRole, "key" | "name" | "description" | "permissions" | "field_permissions" | "is_active">) => request<AccessRole>(`/api/access/store/${storeId}/roles/`, json("POST", data)),
  updateAccessRole: (storeId: number, roleId: number, data: Partial<Pick<AccessRole, "name" | "description" | "permissions" | "field_permissions" | "is_active">>) => request<AccessRole>(`/api/access/store/${storeId}/roles/${roleId}/`, json("PATCH", data)),
  duplicateAccessRole: (storeId: number, roleId: number, name: string) => request<AccessRole>(`/api/access/store/${storeId}/roles/${roleId}/duplicate/`, json("POST", { name })),
  deleteAccessRole: (storeId: number, roleId: number) => request<null>(`/api/access/store/${storeId}/roles/${roleId}/`, { method: "DELETE" }),
  accessGroups: (storeId: number) => request<AccessGroup[]>(`/api/access/store/${storeId}/groups/`),
  createAccessGroup: (storeId: number, data: Pick<AccessGroup, "name" | "description" | "is_active" | "role_ids" | "member_ids">) => request<AccessGroup>(`/api/access/store/${storeId}/groups/`, json("POST", data)),
  updateAccessGroup: (storeId: number, groupId: number, data: Partial<Pick<AccessGroup, "name" | "description" | "is_active" | "role_ids" | "member_ids">>) => request<AccessGroup>(`/api/access/store/${storeId}/groups/${groupId}/`, json("PATCH", data)),
  deleteAccessGroup: (storeId: number, groupId: number) => request<null>(`/api/access/store/${storeId}/groups/${groupId}/`, { method: "DELETE" }),
  accessInvitations: (storeId: number) => request<StaffInvitation[]>(`/api/access/store/${storeId}/invitations/`),
  inviteStaff: (storeId: number, data: { email: string; first_name?: string; last_name?: string; role_ids: number[]; group_ids: number[] }) => request<StaffInvitation>(`/api/access/store/${storeId}/invitations/`, json("POST", data)),
  revokeInvitation: (storeId: number, invitationId: string) => request<StaffInvitation>(`/api/access/store/${storeId}/invitations/${invitationId}/revoke/`, json("POST", {})),
  resendInvitation: (storeId: number, invitationId: string) => request<StaffInvitation>(`/api/access/store/${storeId}/invitations/${invitationId}/resend/`, json("POST", {})),
  acceptInvitation: (data: { token: string; password?: string; first_name?: string; last_name?: string }) => request<{ detail: string; store_id: number }>("/api/access/invitations/accept/", json("POST", data)),
  accessAudit: (storeId: number) => request<AccessAuditEvent[]>(`/api/access/store/${storeId}/audit/`),

  uploadLogo(storeId: number, file: File, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append("logo", file);
    return uploadRequest<{ logo_url: string | null }>(`/api/store/${storeId}/logo/`, form, onProgress);
  },
  deleteLogo(storeId: number) {
    return request<null>(`/api/store/${storeId}/logo/`, { method: "DELETE" });
  },

  listOrders(storeId: number) {
    return request<Order[]>(`/api/store/${storeId}/orders/`);
  },
  getAnalytics(storeId: number, range: 7 | 30 | 90 | 365) {
    return request<AnalyticsReport>(`/api/store/${storeId}/analytics/?range=${range}`);
  },
  getOrder(storeId: number, orderId: string) {
    return request<Order>(`/api/store/${storeId}/orders/${encodeURIComponent(orderId)}/`);
  },
  orderAction(storeId: number, action: "confirm" | "fail" | "ship" | "deliver" | "cancel", data: Record<string, unknown>) {
    return request<Order>(
      `/api/store/${storeId}/orders/${action}/`,
      json("POST", data),
    );
  },
  updateOrderNotes(storeId: number, orderId: string, merchant_notes: string) {
    return request<Order>(
      `/api/store/${storeId}/orders/notes/`,
      json("POST", { order_id: orderId, merchant_notes }),
    );
  },

  listRetailTypes() {
    return request<RetailType[]>(`/api/catalog/retail-types/`);
  },

  listSections(storeId: number) {
    return request<CatalogSection[]>(`/api/catalog/store/${storeId}/sections/`);
  },
  createSection(storeId: number, data: Record<string, unknown>) {
    return request<CatalogSection>(`/api/catalog/store/${storeId}/sections/`, json("POST", data));
  },
  updateSection(storeId: number, sectionId: number, data: Record<string, unknown>) {
    return request<CatalogSection>(`/api/catalog/store/${storeId}/sections/${sectionId}/`, json("PATCH", data));
  },
  uploadSectionBanner(storeId: number, sectionId: number, file: File, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append("thumbnail", file);
    return uploadRequest<CatalogSection>(`/api/catalog/store/${storeId}/sections/${sectionId}/`, form, onProgress, "PATCH");
  },
  deleteSection(storeId: number, sectionId: number) {
    return request<null>(`/api/catalog/store/${storeId}/sections/${sectionId}/`, { method: "DELETE" });
  },

  listProductVendors(storeId: number) {
    return request<ProductVendor[]>(`/api/catalog/store/${storeId}/vendors/`);
  },
  createProductVendor(storeId: number, data: { name: string; slug?: string }) {
    return request<ProductVendor>(`/api/catalog/store/${storeId}/vendors/`, json("POST", data));
  },
  deleteProductVendor(storeId: number, vendorId: number) {
    return request<null>(`/api/catalog/store/${storeId}/vendors/${vendorId}/`, { method: "DELETE" });
  },

  listProducts(storeId: number) {
    return request<Product[]>(`/api/catalog/store/${storeId}/products/`, { cache: "no-store" });
  },
  createProduct(storeId: number, data: Record<string, unknown>) {
    return request<Product>(`/api/catalog/store/${storeId}/products/`, json("POST", data));
  },
  updateProduct(storeId: number, productId: number, data: Record<string, unknown>) {
    return request<Product>(`/api/catalog/store/${storeId}/products/${productId}/`, json("PATCH", data));
  },
  deleteProduct(storeId: number, productId: number) {
    return request<null>(`/api/catalog/store/${storeId}/products/${productId}/`, { method: "DELETE" });
  },
  deleteAllProducts(storeId: number, storeSlug: string, confirmation: string, expectedCount: number) {
    return request<{ deleted: number }>(`/api/catalog/store/${storeId}/products/delete-all/`, json("DELETE", {
      store_slug: storeSlug, confirmation, expected_count: expectedCount,
    }));
  },

  listCoupons(storeId: number) {
    return request<Coupon[]>(`/api/store/${storeId}/coupons/`);
  },
  createCoupon(storeId: number, data: Record<string, unknown>) {
    return request<Coupon>(`/api/store/${storeId}/coupons/`, json("POST", data));
  },
  updateCoupon(storeId: number, couponId: number, data: Record<string, unknown>) {
    return request<Coupon>(`/api/store/${storeId}/coupons/${couponId}/`, json("PATCH", data));
  },
  deleteCoupon(storeId: number, couponId: number) {
    return request<null>(`/api/store/${storeId}/coupons/${couponId}/`, { method: "DELETE" });
  },

  uploadImage(storeId: number, productId: number, file: File, isPrimary: boolean, onProgress?: (percent: number) => void) {
    const path = `/api/catalog/store/${storeId}/products/${productId}/images/`;
    return optimizedUpload<ProductImage>(`${path}sign/`, path, file, { is_primary: isPrimary }, onProgress);
  },
  deleteImage(storeId: number, productId: number, imageId: number) {
    return request<null>(`/api/catalog/store/${storeId}/products/${productId}/images/${imageId}/`, {
      method: "DELETE",
    });
  },

  listVariants(storeId: number, productId: number) {
    return request<StockVariant[]>(`/api/catalog/store/${storeId}/products/${productId}/variants/`);
  },
  createVariant(storeId: number, productId: number, data: Record<string, unknown>) {
    return request<StockVariant>(`/api/catalog/store/${storeId}/products/${productId}/variants/`, json("POST", data));
  },
  updateVariant(storeId: number, productId: number, variantId: number, data: Record<string, unknown>) {
    return request<StockVariant>(
      `/api/catalog/store/${storeId}/products/${productId}/variants/${variantId}/`,
      json("PATCH", data),
    );
  },
  deleteVariant(storeId: number, productId: number, variantId: number) {
    return request<null>(
      `/api/catalog/store/${storeId}/products/${productId}/variants/${variantId}/`,
      { method: "DELETE" },
    );
  },

  listCampaigns(storeId: number) {
    return request<Campaign[]>(`/api/store/${storeId}/campaigns/`);
  },
  createCampaign(storeId: number, data: Partial<Campaign>) {
    return request<Campaign>(`/api/store/${storeId}/campaigns/`, json("POST", data));
  },
  sendCampaign(storeId: number, campaignId: string, testEmail?: string) {
    return request<{ detail: string; queued?: boolean; sent?: number; failed?: number; total?: number }>(
      `/api/store/${storeId}/campaigns/${campaignId}/send/`,
      json("POST", testEmail ? { test_email: testEmail } : {}),
    );
  },

  listDesigns() {
    return request<DesignInfo[]>("/api/designs/");
  },

  listStorefrontPages(storeId: number) {
    return request<StorefrontPageDocument[]>(`/api/store/${storeId}/pages/`);
  },
  getStorefrontPage(storeId: number, pageKey: string) {
    return request<StorefrontPageDocument>(`/api/store/${storeId}/pages/${encodeURIComponent(pageKey)}/`);
  },
  saveStorefrontPage(storeId: number, pageKey: string, data: { draft_sections?: StorefrontPageSection[]; title?: LocalizedStorefrontText; is_visible?: boolean; show_in_navigation?: boolean }) {
    return request<StorefrontPageDocument>(
      `/api/store/${storeId}/pages/${encodeURIComponent(pageKey)}/`,
      json("PATCH", data),
    );
  },
  publishStorefrontPage(storeId: number, pageKey: string) {
    return request<StorefrontPageDocument>(
      `/api/store/${storeId}/pages/${encodeURIComponent(pageKey)}/publish/`,
      json("POST", {}),
    );
  },
  createStorefrontPage(storeId: number, data: { title: LocalizedStorefrontText; route: string; show_in_navigation: boolean }) {
    return request<StorefrontPageDocument>(`/api/store/${storeId}/pages/`, json("POST", data));
  },
  deleteStorefrontPage(storeId: number, pageKey: string) {
    return request<null>(`/api/store/${storeId}/pages/${encodeURIComponent(pageKey)}/`, { method: "DELETE" });
  },
  uploadStorefrontImage(storeId: number, file: File, onProgress?: (percent: number) => void) {
    const path = `/api/store/${storeId}/storefront-assets/`;
    return optimizedUpload<{ id: number; image_url?: string; image?: string; created_at: string }>(
      `${path}sign/`, path, file, {}, onProgress,
    );
  },

  assetUrl(url: string): string {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url}`;
  },
};
