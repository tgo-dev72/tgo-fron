import { expect, test, type Page, type Route } from "@playwright/test";

const operator = {
  id: 1, email: "operator@tijarago.com", first_name: "Platform", last_name: "Operator", is_superuser: true,
  permissions: { manage_pricing: true, manage_users: true, manage_staff: true },
  access: { overview: true, stores: true, users: true, staff: true, orders: true, payments: true, membership_payments: true, billing: true, pricing: true, deployments: true, presentation: true, monitoring: true, system: true },
  last_login: "2026-10-19T09:30:00Z",
};

const managedUser = {
  id: 22, email: "merchant@example.com", name: "Mina Merchant", first_name: "Mina", last_name: "Merchant",
  is_active: true, is_staff: false, is_superuser: false, email_verified: true, is_self: false, can_delete: true,
  delete_blockers: [], stores_count: 2, customer_stores_count: 1,
  principal_types: ["merchant_account", "merchant_owner"], store_roles: ["Owner"],
  date_joined: "2026-01-12T11:00:00Z", last_login: "2026-10-18T13:15:00Z",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockUsers(page: Page) {
  await page.route("**/backend/accounts/csrf", (route) => json(route, { csrfToken: "admin-ux-csrf" }));
  await page.route("**/backend/api/platform-admin/session", (route) => json(route, { user: operator }));
  await page.route(/\/backend\/api\/platform-admin\/users(?:\?.*)?$/, (route) => json(route, { count: 1, next: null, previous: null, results: [managedUser] }));
}

test("user editor groups operations, warns on discard, and restores focus", async ({ page }) => {
  await mockUsers(page);
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  const edit = page.getByRole("button", { name: "Edit user" });
  await edit.focus();
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Manage user" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save changes" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Profile" })).toHaveClass(/active/);
  await page.getByLabel("First name").fill("Mina updated");
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Discard your changes?")).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await dialog.getByRole("button", { name: "Access & security" }).click();
  await expect(dialog.getByText("Active account")).toBeVisible();
  await dialog.getByRole("button", { name: "Activity" }).click();
  await expect(dialog.getByText("Delete user account")).toBeVisible();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
});

test("responsive users table and Arabic drawer stay inside the viewport", async ({ page }) => {
  await mockUsers(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/users");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#platform-sidebar")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#platform-sidebar")).not.toHaveClass(/open/);
  await page.getByRole("button", { name: "العربية" }).click();
  await page.getByRole("button", { name: "تعديل المستخدم" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const box = await page.getByRole("dialog").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBe(844);
  await expect(page.getByRole("dialog").getByRole("button", { name: "حفظ التغييرات" })).toBeVisible();
  await page.screenshot({ path: "../../reviews/admin-ux-modernization/users-mobile-ar.png", fullPage: true });
});

test("platform readiness names every connected service", async ({ page }) => {
  await mockUsers(page);
  await page.route("**/backend/api/platform-admin/system", (route) => json(route, {
    generated_at: "2026-10-20T16:10:00Z", status: "healthy", attention_count: 0,
    database: { status: "healthy", vendor: "postgresql", latency_ms: 8 },
    providers: { vercel: true, cloudflare: true, github: true, cloudinary: true, platform_payment_gateway: true },
    catalog: { products: 1, variants: 10, active_without_variants: 0, out_of_stock_variants: 0 },
    operations: { untreated_stock_exceptions: 0, failed_deployments: 0, stalled_deployments: 0, failed_campaigns: 0, active_subscribers: 2 },
  }));
  await page.goto("/system");
  for (const service of ["Store publishing", "Store addresses", "Application updates", "Product images", "Online payments"]) {
    await expect(page.getByText(service, { exact: true })).toBeVisible();
  }
});

test("platform owner can configure monitoring and send a delivery test", async ({ page }) => {
  await mockUsers(page);
  let savedEmail = "tijarago.services@gmail.com";
  let testSent = false;
  const payload = () => ({
    enabled: true, alert_email: savedEmail, reminder_minutes: 60,
    last_alert_sent_at: null, last_test_sent_at: testSent ? "2026-11-03T20:00:00Z" : null,
    updated_at: "2026-11-03T19:00:00Z", incidents: [],
  });
  await page.route("**/backend/api/platform-admin/monitoring", async (route) => {
    if (route.request().method() === "PATCH") {
      savedEmail = (await route.request().postDataJSON()).alert_email;
    }
    await json(route, payload());
  });
  await page.route("**/backend/api/platform-admin/monitoring/test", (route) => {
    testSent = true;
    return json(route, payload());
  });

  await page.goto("/monitoring");
  await expect(page.getByRole("heading", { name: "Monitoring & alerts" })).toBeVisible();
  await expect(page.getByLabel("Alert email")).toHaveValue("tijarago.services@gmail.com");
  await page.getByLabel("Alert email").fill("ops@tijarago.com");
  await page.getByRole("button", { name: "Save monitoring" }).click();
  await expect(page.getByText("Monitoring settings updated.")).toBeVisible();
  expect(savedEmail).toBe("ops@tijarago.com");
  await page.getByRole("button", { name: "Send test email" }).click();
  await expect(page.getByText("Test email delivered.")).toBeVisible();
  expect(testSent).toBe(true);
});

test("storefront updates disable current releases and refresh progress from SSE", async ({ page }) => {
  await page.route("**/backend/accounts/csrf", (route) => json(route, { csrfToken: "admin-ux-csrf" }));
  await page.route("**/backend/api/platform-admin/session", (route) => json(route, { user: operator }));
  const base = {
    store: { id: 7, name: "Demo", slug: "demo" }, name: "Demo", slug: "demo", design: "basic",
    status: "created", deploy_status: "deployed", public_message: "", attempt_count: 1,
    operation: "update", last_heartbeat_at: "2026-10-20T16:00:00Z", completed_at: null,
    deployed_url: "https://demo.example.com", created_at: "2026-10-20T15:00:00Z",
  };
  let listReads = 0;
  await page.route(/\/backend\/api\/platform-admin\/deployments(?:\?.*)?$/, (route) => {
    listReads += 1;
    const progress = listReads > 1 ? 65 : 10;
    return json(route, { count: 3, next: null, previous: null, results: [
      { ...base, id: 1, name: "Current", slug: "current", pipeline_state: "live", progress: 100, release_status: "current" },
      { ...base, id: 2, name: "Outdated", slug: "outdated", pipeline_state: "live", progress: 100, release_status: "update_available" },
      { ...base, id: 3, name: "Updating", slug: "updating", pipeline_state: "building", progress, release_status: "updating" },
    ] });
  });
  await page.route("**/backend/api/platform-admin/deployments/3/events", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    headers: { "Cache-Control": "no-cache" },
    body: 'event: deployment.updated\ndata: {"state":"building","progress":65}\n\n',
  }));

  await page.goto("/deployments");
  const currentRow = page.getByRole("row").filter({ hasText: "Current" });
  const outdatedRow = page.getByRole("row").filter({ hasText: "Outdated" });
  await expect(currentRow.getByRole("button", { name: "Up to date" })).toBeDisabled();
  await expect(outdatedRow.getByRole("button", { name: "Update store" })).toBeEnabled();
  await expect.poll(() => listReads).toBeGreaterThan(1);
  await expect(page.getByRole("row").filter({ hasText: "Updating" })).toContainText("65%");
});

test("Arabic keeps navigation right and opens the user drawer from the left above the shell", async ({ page }) => {
  await mockUsers(page);
  await page.setViewportSize({ width: 1844, height: 958 });
  await page.goto("/users");
  await page.getByRole("button", { name: "العربية" }).click();
  await page.getByRole("button", { name: "تعديل المستخدم" }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector(".user-editor")?.getBoundingClientRect().left)).toBe(0);
  const geometry = await page.evaluate(() => {
    const sidebar = document.querySelector(".sidebar")?.getBoundingClientRect();
    const drawer = document.querySelector(".user-editor")?.getBoundingClientRect();
    const backdrop = document.querySelector(".user-editor-backdrop")?.getBoundingClientRect();
    const menu = document.querySelector(".sidebar-collapse")?.getBoundingClientRect();
    return {
      sidebarLeft: sidebar?.left,
      sidebarRight: sidebar?.right,
      menuRight: menu?.right,
      drawerLeft: drawer?.left,
      drawerRight: drawer?.right,
      backdropWidth: backdrop?.width,
      modalAboveSidebar: Boolean(document.elementFromPoint(1830, 300)?.closest(".user-editor-backdrop")),
    };
  });
  expect(geometry.sidebarLeft).toBe(1572);
  expect(geometry.sidebarRight).toBe(1844);
  expect(geometry.menuRight).toBeGreaterThanOrEqual(1824);
  expect(geometry.menuRight).toBeLessThanOrEqual(1840);
  expect(geometry.drawerLeft).toBe(0);
  expect(geometry.drawerRight).toBe(700);
  expect(geometry.backdropWidth).toBe(1844);
  expect(geometry.modalAboveSidebar).toBe(true);
  await expect(page.getByRole("dialog").getByRole("button", { name: "حفظ التغييرات" })).toBeVisible();
});

test("desktop operations view uses compact neutral hierarchy", async ({ page }) => {
  await mockUsers(page);
  await page.setViewportSize({ width: 1844, height: 958 });
  await page.goto("/users");
  await page.getByRole("button", { name: "Edit user" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Access & security" }).click();
  const measurements = await page.evaluate(() => ({
    row: document.querySelector("tbody tr")?.getBoundingClientRect().height ?? 0,
    drawer: document.querySelector(".user-editor")?.getBoundingClientRect().width ?? 0,
    drawerHeight: document.querySelector(".user-editor")?.getBoundingClientRect().height ?? 0,
    backdrop: document.querySelector(".user-editor-backdrop")?.getBoundingClientRect(),
    footer: document.querySelector(".user-editor form > footer")?.getBoundingClientRect(),
    logo: document.querySelector(".sidebar-brand .brand-mark")?.getBoundingClientRect(),
    brand: document.querySelector(".sidebar-brand")?.getBoundingClientRect(),
    menu: document.querySelector(".sidebar-collapse")?.getBoundingClientRect(),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(measurements.row).toBeGreaterThanOrEqual(44);
  expect(measurements.row).toBeLessThanOrEqual(60);
  expect(measurements.drawer).toBeGreaterThanOrEqual(620);
  expect(measurements.drawerHeight).toBe(958);
  expect(measurements.backdrop?.x).toBe(0);
  expect(measurements.backdrop?.y).toBe(0);
  expect(measurements.backdrop?.width).toBe(1844);
  expect(measurements.backdrop?.height).toBe(958);
  expect(measurements.footer?.bottom).toBeLessThanOrEqual(958);
  expect(Math.abs(((measurements.logo?.x ?? 0) + (measurements.logo?.width ?? 0) / 2) - ((measurements.brand?.x ?? 0) + (measurements.brand?.width ?? 0) / 2))).toBeLessThan(2);
  expect(measurements.menu?.left).toBeLessThan(20);
  expect(measurements.overflow).toBe(0);
  await page.screenshot({ path: "../../reviews/admin-ux-modernization/users-desktop-access.png", fullPage: true });
});
