import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const user = { email: "owner@example.test", first_name: "Store", last_name: "Owner", email_verified: true };
const store = {
  id: 7,
  slug: "delete-focus-test",
  name: "Delete Focus Test",
  logo: null,
  logo_url: null,
  retail_type: null,
  retail_type_detail: null,
  catalog_config: {},
  members: [{ id: 1, user: 1, email: user.email, first_name: "Store", last_name: "Owner", role: "owner", created_at: "2026-10-01T00:00:00Z" }],
  storefront_url: "https://delete-focus-test.example.test",
  storefront_request_id: 2,
  storefront_status: "live",
  storefront_progress: 100,
  plan: "premium",
  analytics_level: "advanced",
  created_at: "2026-10-01T00:00:00Z",
};

const config = {
  plan: "premium",
  currency: "MAD",
  payment_provider: "cash_on_delivery",
  payment_gateway: { code: "youcanpay", name: "YouCan Pay", configured: false, sandbox: false, credential_fields: [], available_providers: [
    { code: "paypal", name: "PayPal", credential_fields: [], availability: "future", selectable: false },
    { code: "youcanpay", name: "YouCan Pay", credential_fields: [], availability: "future", selectable: false },
    { code: "stripe", name: "Stripe", credential_fields: [], availability: "future", selectable: false },
  ] },
  payment_keys: {},
  from_email: "",
  brand_color: "#2D6A4F",
  loyalty_enabled: true,
  shipping_fee: 0,
  design: "basic",
  contact_email: "hello@example.test",
  support_phone: "",
  whatsapp_phone: "",
  social_links: {},
  homepage_product_source: "featured",
  homepage_product_limit: 8,
  domain: "",
  appearance: {
    schema_version: 1,
    typography: { body_font: "system", heading_font: "system", base_size: "medium", heading_scale: "medium" },
    header: { layout: "theme", sticky: "always", width: "contained", logo_size: "standard", nav_alignment: "center", show_search: true, show_account: true, show_language: true, show_cart: true },
    style: { button_shape: "rounded", card_shape: "rounded", content_width: "standard" },
    colors: { page: "", header: "", header_text: "", announcement: "", hero: "", section: "", card: "", newsletter: "", footer: "" },
    footer: { show_contact: true, show_social_links: true, copyright: { en: "", fr: "", ar: "" } },
  },
};

async function mockSettings(page: Page, stores = [store]) {
  await page.route("**/backend/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/backend/, "");
    if (path === "/accounts/me") return json(route, { message: "ok", user });
    if (path === "/api/store/") return json(route, stores);
    if (path === "/api/store/7/config/") return json(route, config);
    if (path === "/api/store/7/email-forwarding/") return json(route, { alias: "store@example.test", configured: false, active_destination: "", pending_destination: "", pending_verified: false });
    if (path === "/api/access/store/7/me/") return json(route, { store_id: 7, membership_id: 1, role: "owner", permissions: ["settings.view", "settings.update"], field_permissions: {} });
    if (path === "/api/subscriptions/status") return json(route, { subscription: null, subscriptions: [], latest_payment: null, payment: null, balances: [] });
    return json(route, { detail: "Not mocked" }, 404);
  });
}

test("store deletion name confirmation keeps focus while the owner types", async ({ page }) => {
  await mockSettings(page);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Danger zone" }).click();
  await page.getByRole("button", { name: "Delete store" }).click();

  const dialog = page.getByRole("alertdialog", { name: "Permanently delete store?" });
  const storeName = dialog.getByLabel(/to confirm, type/i);
  await expect(storeName).toBeFocused();
  await storeName.pressSequentially("test-store", { delay: 10 });

  await expect(storeName).toBeFocused();
  await expect(storeName).toHaveValue("test-store");
  await expect(dialog).toBeVisible();
});

test("future payment providers are visible but cannot be selected or configured", async ({ page }) => {
  await mockSettings(page);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Payment settings" }).click();

  for (const provider of ["PayPal", "YouCan Pay", "Stripe"]) {
    const row = page.locator(".payment-provider-row", { hasText: provider });
    await expect(row).toContainText("Future feature");
    await expect(row.getByRole("button", { name: "Use this provider" })).toHaveCount(0);
    await expect(row.locator("input")).toHaveCount(0);
  }
});

test("store switcher keeps five stores readable and identifies the current store", async ({ page }) => {
  const stores = [
    store,
    ...["Beauty Lab", "Electro", "LUX", "ENNACHER STORE"].map((name, index) => ({
      ...store,
      id: 8 + index,
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
    })),
  ];
  await mockSettings(page, stores);
  await page.goto("/settings");
  await page.locator(".store-switch > button").click();

  const drawer = page.getByRole("dialog", { name: "Switch store" });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(".switch-drawer-list .store-card")).toHaveCount(5);
  await expect(drawer.locator('.store-card[aria-current="true"]')).toContainText("Current");
  await expect(drawer.locator(".store-card-create")).toContainText("Create another store");
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).not.toBeVisible();
});

test("dialogs finish their exit transition and restore focus", async ({ page }) => {
  await mockSettings(page);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Danger zone" }).click();
  const opener = page.getByRole("button", { name: "Delete store" });
  await opener.click();
  const dialog = page.getByRole("alertdialog", { name: "Permanently delete store?" });
  await expect(dialog).toBeVisible();

  await dialog.locator(".modal-close").click();
  await expect(dialog).toBeAttached();
  await expect(dialog).not.toBeAttached({ timeout: 1_000 });
  await expect(opener).toBeFocused();
  await expect(page.locator(".modal-overlay")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
