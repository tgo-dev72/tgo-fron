export const API_BASE: string = import.meta.env.DEV
  ? "/backend"
  : (import.meta.env.VITE_API_URL as string | undefined) || "https://api.tijarago.com";

export interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  permissions: { manage_pricing: boolean; manage_users: boolean; manage_staff: boolean };
  access: {
    overview: boolean;
    stores: boolean;
    users: boolean;
    staff: boolean;
    orders: boolean;
    payments: boolean;
    membership_payments: boolean;
    billing: boolean;
    pricing: boolean;
    deployments: boolean;
    presentation: boolean;
    monitoring: boolean;
    system: boolean;
  };
  last_login: string | null;
}

export interface PlatformPresentation {
  contact_email: string;
  support_phone: string;
  whatsapp_phone: string;
  social_links: Record<string, string>;
  updated_at: string;
}

export interface PlatformMonitoring {
  enabled: boolean;
  alert_email: string;
  reminder_minutes: number;
  last_alert_sent_at: string | null;
  last_test_sent_at: string | null;
  updated_at: string;
  incidents: Array<{ key: string; label: string; count: number }>;
}
export interface PlatformCommerceSettings { free_trial_days: number; updated_at: string; }

export interface StaffMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  role: string | null;
  permissions: string[];
  identity_warnings: string[];
  last_login: string | null;
  date_joined: string;
}
export interface StaffRole {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  assignable: boolean;
}
export interface StaffPermission {
  code: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
}
export interface StaffCatalog {
  staff: StaffMember[];
  roles: StaffRole[];
  permissions: StaffPermission[];
  authorization_layers: Array<{ key: string; name: string; description: string }>;
}

export interface MiniStore { id: number; name: string; slug: string }
export interface Deployment {
  id: number;
  store: MiniStore | null;
  name: string;
  slug: string;
  design: string;
  status: string;
  deploy_status: string;
  pipeline_state: string;
  progress: number;
  public_message: string;
  attempt_count: number;
  operation: "create" | "update" | "redesign";
  release_status: "preparing" | "current" | "update_available" | "updating" | "update_failed" | "failed";
  last_heartbeat_at: string | null;
  completed_at: string | null;
  deployed_url: string;
  domain?: string;
  vercel_project_id?: string;
  target_revision?: string;
  deployed_revision?: string;
  last_known_good_revision?: string;
  last_error?: string;
  created_at: string;
}
export interface StoreRow {
  id: number;
  name: string;
  slug: string;
  owner_email: string | null;
  retail_type: string;
  retail_type_key: string | null;
  currency: string;
  design: string | null;
  domain: string;
  created_at: string;
  members_count: number;
  products_count: number;
  orders_count: number;
  customers_count: number;
  gross_volume: number;
  deployment: Deployment | null;
}
export interface UserRow {
  id: number;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  email_verified: boolean;
  is_self: boolean;
  can_delete: boolean;
  delete_blockers: Array<"platform_superuser" | "store_owner" | "billing_history">;
  stores_count: number;
  customer_stores_count: number;
  principal_types: Array<"platform_superadmin" | "platform_staff" | "merchant_account" | "merchant_owner" | "merchant_team" | "store_customer" | "unclassified">;
  store_roles: string[];
  date_joined: string;
  last_login: string | null;
}
export interface OrderRow {
  id: number;
  order_id: string;
  store: MiniStore;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency: string;
  status: string;
  payment_mode: string;
  payment_status: string;
  exception: boolean;
  items_count?: number;
  customer_city?: string;
  created_at: string;
  updated_at?: string;
}
export interface PaymentRow {
  id: number;
  order_id: string;
  store: MiniStore;
  customer_email: string;
  amount: number;
  currency: string;
  status: string;
  provider_reference: string;
  created_at: string;
  updated_at: string;
}
export interface MembershipPaymentRow {
  id: string;
  merchant_email: string;
  plan_name: string;
  plan_id: number | null;
  selected_store: MiniStore | null;
  entitlement_scope: "all_owned_stores" | "one_store";
  gross_amount: number;
  amount: number;
  balance_applied: number;
  credit_after_confirmation: number;
  currency: string;
  status: "pending" | "confirmed" | "failed" | "duplicate" | "canceled";
  provider_reference: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface PlatformGateway {
  code: string;
  name: string;
  configured: boolean;
  sandbox: boolean;
  enabled: boolean;
  sandbox_configurable: boolean;
  details?: Record<string, boolean>;
}
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface Overview {
  generated_at: string;
  metrics: {
    users: number; new_users_30d: number; stores: number; new_stores_30d: number;
    products: number; active_products: number; orders: number; orders_30d: number;
    gross_volume: number; realized_revenue: number; payment_success_rate: number;
    deployed_storefronts: number;
  };
  order_status: Record<string, number>;
  payment_status: Record<string, number>;
  deployment_status: Record<string, number>;
  trend: Array<{ date: string; orders: number; volume: number }>;
  retail_mix: Array<{ key: string; label: string; count: number }>;
  alerts: Array<{ key: string; severity: string; title: string; count: number; detail: string; href: string }>;
  recent: { orders: OrderRow[]; stores: StoreRow[]; deployments: Deployment[] };
}
export interface SystemHealth {
  generated_at: string;
  status: string;
  attention_count: number;
  database: { status: string; vendor: string; latency_ms: number };
  providers: Record<string, boolean>;
  catalog: { products: number; variants: number; active_without_variants: number; out_of_stock_variants: number };
  operations: { untreated_stock_exceptions: number; failed_deployments: number; stalled_deployments: number; failed_campaigns: number; active_subscribers: number };
}
export interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  translations: LocalizedPlanCopy;
  price: string;
  currency: string;
  duration_days: number;
  entitlement_scope: "all_owned_stores" | "one_store";
  features: string[];
  grants_premium_designs: boolean;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  upgrade_from?: number | null;
  revision: number;
  entitlements: Record<string, EntitlementValue>;
  benefits: PlanBenefit[];
  is_free: boolean;
  created_at: string;
  updated_at: string;
}
export interface PricingCatalog {
  plans: SubscriptionPlan[];
  capabilities: EntitlementDefinition[];
  rule_templates: BusinessRuleTemplate[];
  provider: {
    code: string;
    name: string;
    configured: boolean;
    sandbox: boolean;
    checkout_credentials_configured?: boolean;
    transaction_verification_configured: boolean;
    transaction_verification_required: boolean;
  };
}
export type EntitlementValue = boolean | number | string;
export type SupportedLocale = "en" | "fr" | "ar";
export type SubscriberTransition = "new_only" | "existing_and_new";
export type LocalizedPlanCopy = Record<SupportedLocale, { name: string; description: string; display?: string }>;
export interface PlanBenefit {
  key: string;
  name: string;
  description: string;
  value: EntitlementValue;
  unit: string;
  display: string;
  translations: LocalizedPlanCopy;
  scope: "account" | "store" | "user";
  counting_rules: string;
  reset_window: string;
  missing_behavior: string;
  zero_behavior: string;
  downgrade_behavior: string;
}
export interface BusinessRuleTemplate {
  key: string;
  name: string;
  description: string;
  value_type: "boolean" | "integer" | "decimal" | "text" | "choice";
  scope: "account" | "store";
  unit: string;
  kind: "feature_access" | "resource_limit" | "service_level";
  default_value: EntitlementValue;
  allowed_values: string[];
  sort_order: number;
  configured: boolean;
  required: boolean;
  translations: LocalizedPlanCopy;
  zero_means_unlimited: boolean;
  counting_rules: string;
  reset_window: string;
  missing_behavior: string;
  zero_behavior: string;
  downgrade_behavior: string;
}
export interface EntitlementDefinition {
  id: number;
  key: string;
  name: string;
  description: string;
  translations: LocalizedPlanCopy;
  value_type: "boolean" | "integer" | "decimal" | "text" | "choice";
  scope: "account" | "store";
  unit: string;
  allowed_values: string[];
  default_value: EntitlementValue;
  is_active: boolean;
  sort_order: number;
  used_by_plans: number;
  created_at: string;
  updated_at: string;
  business_rule: BusinessRuleTemplate | null;
}
export type PlanInput = Omit<SubscriptionPlan, "id" | "revision" | "benefits" | "grants_premium_designs" | "is_free" | "created_at" | "updated_at">;
export type PlanUpdateInput = Partial<PlanInput> & { subscriber_transition: SubscriberTransition };
export type CapabilityInput = Omit<EntitlementDefinition, "id" | "used_by_plans" | "created_at" | "updated_at" | "business_rule">;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let csrfToken = "";
export const STAFF_SESSION_EXPIRED_EVENT = "tijarago:staff-session-expired";

export function shouldExpireStaffSession(path: string, status: number): boolean {
  if (status !== 401) return false;
  return !["/accounts/token", "/api/platform-admin/session"].includes(path.split("?", 1)[0]);
}

function notifyStaffSessionExpired(path: string, status: number) {
  if (!shouldExpireStaffSession(path, status)) return;
  csrfToken = "";
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STAFF_SESSION_EXPIRED_EVENT));
}

async function csrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE}/accounts/csrf`, { credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, "Could not establish a secure session.");
  const data = await response.json() as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) headers.set("X-CSRFToken", await csrf());
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    notifyStaffSessionExpired(path, response.status);
    const flatten = (value: unknown): string[] => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.flatMap(flatten);
      if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => flatten(item).map((message) => `${key}: ${message}`));
      return [];
    };
    const message = flatten(body).join(" · ") || `Request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

function query(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return `${path}${search.size ? `?${search}` : ""}`;
}

export const adminApi = {
  login: async (email: string, password: string) => {
    await request("/accounts/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, scope: "staff" }),
    });
    return adminApi.session();
  },
  logout: () => request<{ message: string }>("/accounts/logout", { method: "POST" }),
  session: () => request<{ user: AdminUser }>("/api/platform-admin/session"),
  presentation: () => request<PlatformPresentation>("/api/platform-admin/presentation"),
  updatePresentation: (payload: Omit<PlatformPresentation, "updated_at">) => request<PlatformPresentation>("/api/platform-admin/presentation", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  monitoring: () => request<PlatformMonitoring>("/api/platform-admin/monitoring"),
  updateMonitoring: (payload: Pick<PlatformMonitoring, "enabled" | "alert_email" | "reminder_minutes">) => request<PlatformMonitoring>("/api/platform-admin/monitoring", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  testMonitoring: () => request<PlatformMonitoring>("/api/platform-admin/monitoring/test", { method: "POST" }),
  commerceSettings: () => request<PlatformCommerceSettings>("/api/platform-admin/commerce-settings"),
  updateCommerceSettings: (payload: Pick<PlatformCommerceSettings, "free_trial_days">) => request<PlatformCommerceSettings>("/api/platform-admin/commerce-settings", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  overview: () => request<Overview>("/api/platform-admin/overview"),
  stores: (params: Record<string, string | number | undefined>) => request<Paginated<StoreRow>>(query("/api/platform-admin/stores", params)),
  users: (params: Record<string, string | number | undefined>) => request<Paginated<UserRow>>(query("/api/platform-admin/users", params)),
  updateUser: (id: number, payload: { email: string; first_name: string; last_name: string; is_active: boolean; email_verified: boolean }) => request<UserRow>(`/api/platform-admin/users/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  deleteUser: (id: number) => request<null>(`/api/platform-admin/users/${id}`, { method: "DELETE" }),
  staff: () => request<StaffCatalog>("/api/platform-admin/staff"),
  createStaff: (payload: { email: string; first_name: string; last_name: string; password: string; role: string }) => request<StaffMember>("/api/platform-admin/staff", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  updateStaff: (id: number, payload: { role?: string; is_active?: boolean; first_name?: string; last_name?: string; password?: string }) => request<StaffMember>(`/api/platform-admin/staff/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  orders: (params: Record<string, string | number | undefined>) => request<Paginated<OrderRow>>(query("/api/platform-admin/orders", params)),
  payments: (params: Record<string, string | number | undefined>) => request<Paginated<PaymentRow>>(query("/api/platform-admin/payments", params)),
  membershipPayments: (params: Record<string, string | number | undefined>) => request<Paginated<MembershipPaymentRow>>(query("/api/platform-admin/membership-payments", params)),
  paymentGateways: () => request<{ gateways: PlatformGateway[] }>("/api/platform-admin/payment-gateways"),
  updatePaymentGateway: (code: string, payload: { enabled?: boolean; sandbox_enabled?: boolean }) => request<PlatformGateway>(`/api/platform-admin/payment-gateways/${code}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),
  deployments: (params: Record<string, string | number | undefined>) => request<Paginated<Deployment>>(query("/api/platform-admin/deployments", params)),
  releaseDeployment: (id: number) => request<Deployment>(`/api/platform-admin/deployments/${id}/release`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }),
  deploymentEventsUrl: (id: number) => `${API_BASE}/api/platform-admin/deployments/${id}/events`,
  system: () => request<SystemHealth>("/api/platform-admin/system"),
  pricing: () => request<PricingCatalog>("/api/platform-admin/pricing"),
  createPlan: (payload: PlanInput) => request<SubscriptionPlan>("/api/platform-admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updatePlan: (id: number, payload: PlanUpdateInput) =>
    request<SubscriptionPlan>(`/api/platform-admin/pricing/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deletePlan: (id: number) => request<null>(`/api/platform-admin/pricing/${id}`, { method: "DELETE" }),
  createCapability: (payload: CapabilityInput) => request<EntitlementDefinition>("/api/platform-admin/pricing/capabilities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),
  updateCapability: (id: number, payload: Partial<CapabilityInput>) =>
    request<EntitlementDefinition>(`/api/platform-admin/pricing/capabilities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteCapability: (id: number) => request<null>(`/api/platform-admin/pricing/capabilities/${id}`, { method: "DELETE" }),
};
