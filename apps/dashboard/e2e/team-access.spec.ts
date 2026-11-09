import { expect, test, type Page, type Route } from "@playwright/test";

async function respond(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const user = { email: "owner@example.test", first_name: "Store", last_name: "Owner", email_verified: true };
const store = {
  id: 7, slug: "test-store", name: "Test Store", logo: null, logo_url: null,
  retail_type: null, retail_type_detail: null, catalog_config: {},
  members: [{ id: 1, user: 1, email: user.email, first_name: "Store", last_name: "Owner", role: "owner", created_at: "2026-10-01T00:00:00Z" }],
  storefront_url: "https://test-store.example.test", storefront_request_id: 2,
  storefront_status: "live", storefront_progress: 100, plan: "premium", analytics_level: "advanced", created_at: "2026-10-01T00:00:00Z",
};

async function mockAccess(page: Page, allowed = true) {
  await page.route("**/backend/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/backend/, "");
    if (path === "/accounts/me") return respond(route, { message: "ok", user });
    if (path === "/api/store/") return respond(route, [store]);
    if (path === "/api/subscriptions/status") return respond(route, { subscription: null, subscriptions: [], latest_payment: null, payment: null, balances: [] });
    if (path === "/api/access/store/7/me/") return respond(route, {
      store_id: 7, membership_id: 1,
      permissions: allowed ? ["staff.view", "staff.invite", "staff.update", "staff.revoke", "roles.view", "roles.manage", "groups.view", "groups.manage", "audit.view"] : [],
      field_permissions: {},
    });
    if (path === "/api/access/store/7/catalog/") return respond(route, { permissions: { Products: [{ key: "products.view", description: "View products" }] }, fields: {} });
    if (path === "/api/access/store/7/members/") return respond(route, [{
    id: 1, email: user.email, first_name: "Store", last_name: "Owner", role: "owner", is_active: true,
    role_ids: [], group_ids: [], direct_permissions: [], direct_field_permissions: {},
    effective_permissions: ["staff.view"], effective_field_permissions: {}, created_at: "2026-10-01T00:00:00Z",
    }]);
    if (path === "/api/access/store/7/roles/") return respond(route, [{
    id: 10, key: "administrator", name: "Administrator", description: "Built in", permissions: ["products.view"],
    field_permissions: {}, is_system: true, is_active: true, affected_staff_count: 1, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
    }]);
    if (["/api/access/store/7/groups/", "/api/access/store/7/invitations/", "/api/access/store/7/audit/"].includes(path)) return respond(route, []);
    return respond(route, { detail: "Not mocked" }, 404);
  });
}

test("owner can navigate the team access workspace and inspect staff", async ({ page }) => {
  await mockAccess(page);
  await page.goto("/team-access");
  await expect(page.getByRole("heading", { name: "Team & access" })).toBeVisible();
  await expect(page.locator(".access-list").getByText("owner@example.test", { exact: true })).toBeVisible();
});

test("unauthorized team route fails closed in the UI", async ({ page }) => {
  await mockAccess(page, false);
  await page.goto("/team-access");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Team & access" })).not.toBeVisible();
});
