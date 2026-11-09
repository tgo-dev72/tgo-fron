import { expect, test, type Page, type Route } from "@playwright/test";

const translations = (name: string, description: string) => ({
  en: { name, description },
  fr: { name: `${name} FR`, description: `${description} FR` },
  ar: { name: `${name} AR`, description: `${description} AR` },
});

const user = {
  id: 1,
  email: "operator@example.com",
  first_name: "Platform",
  last_name: "Operator",
  is_superuser: true,
  permissions: { manage_pricing: true, manage_users: true, manage_staff: true },
  access: {
    overview: true, stores: true, users: true, staff: true, orders: true,
    payments: true, membership_payments: true, billing: true, pricing: true,
    deployments: true, system: true,
  },
  last_login: null,
};

const capabilities = [
  {
    id: 1, key: "designs.premium", name: "Premium designs", description: "Use premium storefront designs.",
    translations: translations("Premium designs", "Use premium storefront designs."),
    value_type: "boolean", scope: "account", unit: "", allowed_values: [], default_value: false,
    is_active: true, sort_order: 1, used_by_plans: 1, created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z", business_rule: null,
  },
  {
    id: 2, key: "stores.max_count", name: "Stores included", description: "Maximum store count.",
    translations: translations("Stores included", "Maximum store count."),
    value_type: "integer", scope: "account", unit: "stores", allowed_values: [], default_value: 1,
    is_active: true, sort_order: 2, used_by_plans: 1, created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z", business_rule: null,
  },
  {
    id: 4, key: "analytics.level", name: "Analytics", description: "Merchant analytics depth.",
    translations: translations("Analytics", "Merchant analytics depth."),
    value_type: "choice", scope: "account", unit: "", allowed_values: ["essential", "standard", "advanced"], default_value: "essential",
    is_active: true, sort_order: 4, used_by_plans: 1, created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z", business_rule: null,
  },
  {
    id: 3, key: "legacy.hidden", name: "Retired benefit", description: "No longer configurable.",
    translations: translations("Retired benefit", "No longer configurable."),
    value_type: "boolean", scope: "account", unit: "", allowed_values: [], default_value: false,
    is_active: false, sort_order: 3, used_by_plans: 1, created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z", business_rule: null,
  },
];

const plan = {
  id: 4,
  name: "Premium",
  slug: "premium",
  description: "Premium plan",
  translations: translations("Premium", "Premium plan"),
  price: "199.00",
  currency: "MAD",
  duration_days: 30,
  entitlement_scope: "all_owned_stores",
  features: [],
  grants_premium_designs: true,
  is_active: true,
  is_featured: true,
  sort_order: 20,
  revision: 3,
  entitlements: {
    "designs.premium": true,
    "stores.max_count": 10,
    "analytics.level": "standard",
    "legacy.hidden": true,
    "unknown.stale": true,
  },
  benefits: [],
  is_free: false,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const catalog = () => ({
  plans: [{ ...plan, entitlements: { ...plan.entitlements } }],
  capabilities,
  rule_templates: capabilities.map((capability) => ({
    key: capability.key,
    name: capability.name,
    description: capability.description,
    value_type: capability.value_type,
    scope: capability.scope,
    unit: capability.unit,
    kind: "feature_access",
    default_value: capability.default_value,
    allowed_values: capability.allowed_values,
    sort_order: capability.sort_order,
    configured: true,
    required: false,
    translations: capability.translations,
    zero_means_unlimited: false,
  })),
  provider: {
    code: "youcanpay", name: "YouCan Pay", configured: true, sandbox: true,
    transaction_verification_configured: true, transaction_verification_required: true,
  },
});

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockAuthenticatedPricing(page: Page) {
  let current = catalog();
  await page.route("**/backend/accounts/csrf", (route) => json(route, { csrfToken: "browser-test-csrf" }));
  await page.route("**/backend/api/platform-admin/session", (route) => json(route, { user }));
  await page.route("**/backend/api/platform-admin/pricing", (route) => json(route, current));
  return {
    setCatalog(next: typeof current) { current = next; },
  };
}

async function openCapabilityEditor(page: Page) {
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Plans & benefits" })).toBeVisible();
  await page.getByTitle("Edit pack").click();
  await page.getByRole("button", { name: /Benefits/ }).click();
}

async function submitEditedPlan(page: Page) {
  await page.getByRole("button", { name: /Review & publish/ }).click();
  await page.getByRole("radio", { name: /Existing and new subscribers/ }).check();
  await page.getByLabel(/I reviewed this pack/).check();
  await page.getByRole("button", { name: "Confirm and save pack" }).click();
}

test("editing one capability sends a clean typed PATCH and closes the editor", async ({ page }) => {
  const pricing = await mockAuthenticatedPricing(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/backend/api/platform-admin/pricing/4", async (route) => {
    submitted = route.request().postDataJSON();
    const updatedPlan = { ...plan, revision: 4, entitlements: submitted?.entitlements as typeof plan.entitlements };
    pricing.setCatalog({ ...catalog(), plans: [updatedPlan] });
    await json(route, updatedPlan);
  });

  await openCapabilityEditor(page);
  await page.getByLabel("Premium designs").uncheck();
  await submitEditedPlan(page);

  await expect(page.getByText("The plan was saved.")).toBeVisible();
  expect(submitted).toBeDefined();
  expect(submitted?.subscriber_transition).toBe("existing_and_new");
  expect(submitted?.entitlements).toEqual({ "designs.premium": false, "stores.max_count": 10, "analytics.level": "standard" });
  expect((submitted?.entitlements as Record<string, unknown>)["legacy.hidden"]).toBeUndefined();
  expect((submitted?.entitlements as Record<string, unknown>)["unknown.stale"]).toBeUndefined();
});

test("a rejected capability PATCH exposes the backend field error", async ({ page }) => {
  await mockAuthenticatedPricing(page);
  await page.route("**/backend/api/platform-admin/pricing/4", (route) => json(route, {
    entitlements: { "stores.max_count": ["An integer entitlement requires a non-negative whole number."] },
  }, 400));

  await openCapabilityEditor(page);
  await page.getByLabel("Premium designs").uncheck();
  await submitEditedPlan(page);

  await expect(page.getByRole("alert")).toContainText("entitlements: stores.max_count: An integer entitlement requires a non-negative whole number.");
  await expect(page.getByRole("button", { name: /Benefits/ })).toHaveClass(/active/);
});

test("localized analytics labels submit the stable governed choice value", async ({ page }) => {
  const pricing = await mockAuthenticatedPricing(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/backend/api/platform-admin/pricing/4", async (route) => {
    submitted = route.request().postDataJSON();
    const updatedPlan = { ...plan, revision: 4, entitlements: submitted?.entitlements as typeof plan.entitlements };
    pricing.setCatalog({ ...catalog(), plans: [updatedPlan] });
    await json(route, updatedPlan);
  });

  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Plans & benefits" })).toBeVisible();
  await page.getByRole("button", { name: "Français" }).click();
  await page.getByTitle("Modifier le forfait").click();
  await page.getByRole("button", { name: /Avantages/ }).click();
  await page.getByLabel("Analytics").selectOption("advanced");
  await page.getByRole("button", { name: /Vérifier et publier/ }).click();
  await page.getByRole("radio", { name: /Abonnés actuels et nouveaux/ }).check();
  await page.getByLabel(/vérifié ce forfait/i).check();
  await page.getByRole("button", { name: "Confirmer et enregistrer" }).click();

  await expect(page.getByText("Le forfait a été enregistré.")).toBeVisible();
  expect(submitted?.subscriber_transition).toBe("existing_and_new");
  expect((submitted?.entitlements as Record<string, unknown>)["analytics.level"]).toBe("advanced");
});

test("a plan revision can be limited to new subscribers", async ({ page }) => {
  await mockAuthenticatedPricing(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/backend/api/platform-admin/pricing/4", async (route) => {
    submitted = route.request().postDataJSON();
    await json(route, { ...plan, revision: 4 });
  });

  await openCapabilityEditor(page);
  await page.getByRole("button", { name: /Review & publish/ }).click();
  await page.getByRole("radio", { name: /New subscribers only/ }).check();
  await page.getByLabel(/I reviewed this pack/).check();
  await page.getByRole("button", { name: "Confirm and save pack" }).click();

  await expect(page.getByText("The plan was saved.")).toBeVisible();
  expect(submitted?.subscriber_transition).toBe("new_only");
});

test("platform administration keeps operational text at a readable size", async ({ page }) => {
  await mockAuthenticatedPricing(page);
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Plans & benefits" })).toBeVisible();

  const sizes = await page.evaluate(() => {
    const size = (selector: string) => Number.parseFloat(
      window.getComputedStyle(document.querySelector(selector) as Element).fontSize,
    );
    return {
      body: size("body"),
      navigation: size(".sidebar nav a"),
      cardCopy: size(".plan-card > p"),
      providerState: size(".provider-state"),
    };
  });

  expect(sizes.body).toBeGreaterThanOrEqual(15);
  expect(sizes.navigation).toBeGreaterThanOrEqual(14);
  expect(sizes.cardCopy).toBeGreaterThanOrEqual(13);
  expect(sizes.providerState).toBeGreaterThanOrEqual(12);
});

test("the desktop sidebar collapses, expands the workspace and remembers the choice", async ({ page }) => {
  await mockAuthenticatedPricing(page);
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Plans & benefits" })).toBeVisible();

  const app = page.locator(".admin-app");
  const sidebar = page.locator("#platform-sidebar");
  const collapseButton = page.getByRole("button", { name: "Collapse sidebar" });
  const expandedPositions = await Promise.all([
    sidebar.boundingBox(),
    collapseButton.boundingBox(),
  ]);
  expect(expandedPositions[0]).not.toBeNull();
  expect(expandedPositions[1]).not.toBeNull();
  expect((expandedPositions[1]?.x || 0) - (expandedPositions[0]?.x || 0)).toBeLessThan(30);
  await collapseButton.click();

  await expect(app).toHaveClass(/sidebar-collapsed/);
  await expect(sidebar.getByText("Plans & benefits", { exact: true })).toBeHidden();
  await expect(page.getByRole("link", { name: "Plans & benefits" })).toBeVisible();
  await expect.poll(() => page.locator(".main-column").evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).marginLeft)
  )).toBe(76);

  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect(app).toHaveClass(/sidebar-collapsed/);

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(app).not.toHaveClass(/sidebar-collapsed/);
  await expect(sidebar.getByText("Plans & benefits", { exact: true })).toBeVisible();
});

test("the mobile drawer stays full width when desktop compact mode was saved", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.setItem("platformAdmin.sidebarCollapsed", "true"));
  await mockAuthenticatedPricing(page);
  await page.goto("/plans");

  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();

  const sidebar = page.locator("#platform-sidebar");
  await expect(sidebar.getByText("Plans & benefits", { exact: true })).toBeVisible();
  await expect(sidebar.locator(".brand-mark")).toBeVisible();
  await expect.poll(() => sidebar.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).width)
  )).toBe(260);
});
