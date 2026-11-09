import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockProducts(page: Page, importAllowed: boolean) {
  const user = { email: "owner@example.test", first_name: "Store", last_name: "Owner", email_verified: true };
  const store = {
    id: 7, slug: "catalog-test", name: "Catalog Test", logo: null, logo_url: null,
    retail_type: null, retail_type_detail: null, catalog_config: {},
    members: [{ id: 1, user: 1, email: user.email, first_name: "Store", last_name: "Owner", role: "owner", created_at: "2026-10-01T00:00:00Z" }],
    storefront_url: "", storefront_request_id: null, storefront_status: "not_deployed", storefront_progress: 0,
    plan: "free", analytics_level: "essential", created_at: "2026-10-01T00:00:00Z",
  };
  await page.route("**/backend/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/backend/, "");
    if (path === "/accounts/me") return json(route, { message: "ok", user });
    if (path === "/api/store/") return json(route, [store]);
    if (path === "/api/access/store/7/me/") return json(route, { store_id: 7, membership_id: 1, role: "owner", permissions: ["products.view", "products.create"], field_permissions: {} });
    if (path === "/api/subscriptions/status") return json(route, { subscription: null, subscriptions: [], latest_payment: null, payment: null, balances: [] });
    if (path === "/api/catalog/store/7/products/") return json(route, []);
    if (path === "/api/catalog/store/7/sections/") return json(route, []);
    if (path === "/api/catalog/store/7/transfer-capabilities/") return json(route, {
      formats: ["csv", "xlsx", "json"],
      guide: {
        title: "إضافة منتجات من ملف", summary: "أضف كل منتج بسيط في سطر مستقل.",
        steps: ["نزّل النموذج.", "أضف المنتجات.", "ارفع الملف وراجع النتيجة."], important_notes: [],
        limits: { maximum_file_bytes: 2097152, maximum_products: 1000, accepted_extensions: [".csv", ".xlsx", ".json"] },
        fields: [], sections: [], templates: { csv: "/template.csv", xlsx: "/template.xlsx" },
      },
      export: { allowed: true, label: "تنزيل قائمة المنتجات", description: "تنزيل المنتجات بصيغة CSV أو Excel أو JSON." },
      import: {
        allowed: importAllowed,
        label: "إضافة منتجات من ملف",
        description: "إضافة المنتجات أو تحديثها من ملف.",
        entitlement: "catalog.import",
        denial: importAllowed ? null : { detail: "This option is not included in your current plan.", rule: "catalog.import" },
      },
    });
    return json(route, { detail: "Not mocked" }, 404);
  });
}

test("basic export remains available while import is independently plan-gated", async ({ page }) => {
  await mockProducts(page, false);
  await page.goto("/products");
  const exportControl = page.locator("summary", { hasText: "Download products" });
  const importControl = page.locator("summary", { hasText: "Add from file" });
  await expect(exportControl).toHaveAttribute("aria-disabled", "false");
  await expect(exportControl).not.toHaveAttribute("title", /.+/);
  await expect(importControl).toHaveAttribute("aria-disabled", "true");
  await expect(importControl).not.toHaveAttribute("title", /.+/);
  await expect(page.getByRole("heading", { name: "إضافة منتجات من ملف" })).toBeVisible();
});

test("catalog import control becomes available only when backend capability allows it", async ({ page }) => {
  await mockProducts(page, true);
  await page.goto("/products");
  const importControl = page.locator("summary", { hasText: "Add from file" });
  await expect(importControl).toHaveAttribute("aria-disabled", "false");
  await expect(importControl).not.toHaveAttribute("title", /.+/);
});
