import { expect, test, type Page, type Route } from "@playwright/test";

type AnalyticsLevel = "standard" | "advanced";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const user = {
  email: "merchant@example.com",
  first_name: "Analytics",
  last_name: "Merchant",
  email_verified: true,
};

function store(level: AnalyticsLevel) {
  return {
    id: 7,
    slug: "analytics-lab",
    name: "Analytics Lab",
    logo: null,
    logo_url: null,
    retail_type: null,
    retail_type_detail: null,
    members: [{
      id: 1, user: 1, email: user.email, first_name: user.first_name,
      last_name: user.last_name, role: "owner", created_at: "2026-09-01T00:00:00Z",
    }],
    storefront_url: "https://analytics-lab.example.test",
    storefront_request_id: 11,
    storefront_status: "live",
    storefront_progress: 100,
    plan: "premium",
    analytics_level: level,
    created_at: "2026-09-01T00:00:00Z",
  };
}

const funnel = {
  store_visits: 100,
  product_views: 86,
  cart_additions: 31,
  checkout_starts: 18,
  order_submissions: 9,
  unique_sessions: { product_views: 70, cart_additions: 28, checkout_starts: 16, order_submissions: 9 },
  rates: { add_to_cart: 40, checkout_start: 57.14, order_submission: 56.25, cart_abandonment: 67.86, checkout_abandonment: 43.75 },
};

function report(level: AnalyticsLevel) {
  const product = {
    product_id: 23,
    name: "White Shirt",
    views: 420,
    view_sessions: 350,
    cart_additions: 65,
    cart_sessions: 58,
    orders: 4,
    quantity: 4,
    collected_orders: 3,
    conversion_rate: 1.14,
    revenue: "897.00",
    ...(level === "advanced" ? { revenue_per_view: "2.14" } : {}),
  };
  return {
    level,
    range_days: 30,
    available_ranges: level === "advanced" ? [7, 30, 90, 365] : [7, 30, 90],
    currency: "MAD",
    generated_at: "2026-09-09T12:00:00Z",
    has_data: true,
    kpis: {
      collected_revenue: "1896.00", average_order_value: "210.67", customers: 8,
      products: 12, average_items_per_order: 1.4, out_of_stock_products: 1,
    },
    daily: [
      { date: "2026-09-08", revenue: "699.00", orders: 3 },
      { date: "2026-09-09", revenue: "1197.00", orders: 6 },
    ],
    order_status: { pending: 2, confirmed: 3, shipped: 1, delivered: 4, cancelled: 1 },
    standard: {
      weekdays: [{ day: 3, revenue: "1197.00", orders: 6 }],
      hours: [{ hour: 14, revenue: "1197.00", orders: 6 }],
      top_products: [{ product_id: 23, name: "White Shirt", quantity: 4, revenue: "897.00" }],
      payment: { online: "699.00", cod: "1197.00" },
      stock: { in_stock: 9, low_stock: 2, out_of_stock: 1 },
      funnel,
      product_performance: [product],
      zero_result_searches: [{ query: "green boots", searches: 7 }],
    },
    advanced: level === "advanced" ? {
      revenue_change_percent: 18.5,
      repeat_customer_rate: 25,
      cancellation_rate: 10,
      average_fulfilment_hours: 8.5,
      best_weekday: 3,
      best_hour: 14,
      funnel_comparison: {
        previous: { ...funnel, store_visits: 80, product_views: 66, cart_additions: 20, checkout_starts: 12, order_submissions: 6 },
        change_percent: { store_visits: 25, product_views: 30.3, cart_additions: 55, checkout_starts: 50, order_submissions: 50 },
      },
      funnel_trend: [
        { date: "2026-09-08", visits: 42, product_views: 35, cart_additions: 12, checkout_starts: 7, order_submissions: 3, collected_orders: 2 },
        { date: "2026-09-09", visits: 58, product_views: 51, cart_additions: 19, checkout_starts: 11, order_submissions: 6, collected_orders: 4 },
      ],
      product_intelligence: [product],
      sources: [{ source: "instagram", campaign: "autumn", visits: 48, order_submissions: 6, collected_orders: 4, revenue: "1197.00", conversion_rate: 12.5 }],
      opportunities: [{
        kind: "high_traffic_low_conversion",
        severity: "warning",
        product_id: 23,
        product_name: "White Shirt",
        metrics: { views: 420, cart_additions: 65, orders: 4 },
      }],
    } : null,
  };
}

async function mockDashboard(page: Page, level: AnalyticsLevel) {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.route("**/backend/accounts/me", (route) => json(route, { message: "ok", user }));
  await page.route("**/backend/api/store/", (route) => json(route, [store(level)]));
  await page.route("**/backend/api/subscriptions/status", (route) => json(route, {
    subscription: null, subscriptions: [], latest_payment: null, payment: null, balances: [],
  }));
  await page.route("**/backend/api/access/store/7/me/", (route) => json(route, {
    store_id: 7,
    membership_id: 1,
    permissions: ["analytics.view"],
    field_permissions: {},
  }));
  await page.route("**/backend/api/store/7/analytics/?range=*", (route) => json(route, report(level)));
  return runtimeErrors;
}

test("standard analytics exposes funnel and product intelligence but keeps advanced analysis gated", async ({ page }) => {
  const runtimeErrors = await mockDashboard(page, "standard");
  await page.goto("/analytics");

  await expect(page.getByRole("heading", { name: "Conversion and product intelligence" })).toBeVisible();
  await expect(page.getByTestId("conversion-funnel")).toContainText("Store visits");
  await expect(page.getByTestId("conversion-funnel")).toContainText("Orders submitted");
  await expect(page.getByRole("cell", { name: "White Shirt" })).toBeVisible();
  await expect(page.getByText("green boots")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Funnel trends" })).toHaveCount(0);
  await expect(page.getByText("Unlock advanced analytics")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("advanced analytics renders comparisons, source attribution, opportunities and expandable funnel chart", async ({ page }) => {
  const runtimeErrors = await mockDashboard(page, "advanced");
  await page.goto("/analytics");

  await expect(page.getByRole("heading", { name: "Funnel trends" })).toBeVisible();
  await expect(page.getByText("instagram · autumn")).toBeVisible();
  await expect(page.getByText(/420 views and 65 cart additions produced only 4 orders/)).toBeVisible();
  await expect(page.locator(".analytics-comparison-grid")).toContainText("+25%");

  await page.locator(".analytics-funnel-trend-card .platform-chart-expand-button").click();
  await expect(page.getByRole("dialog", { name: "Funnel trends" })).toBeVisible();
  await page.getByRole("button", { name: "Close expanded chart" }).click();
  await expect(page.getByRole("dialog", { name: "Funnel trends" })).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test("conversion analytics remains within the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeErrors = await mockDashboard(page, "advanced");
  await page.goto("/analytics");
  await expect(page.getByTestId("conversion-funnel")).toBeVisible();

  const overflow = await page.evaluate(() => ({
    amount: document.documentElement.scrollWidth - window.innerWidth,
    elements: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector: `${element.tagName.toLowerCase()}.${element.className}`, left: rect.left, right: rect.right, width: rect.width };
      })
      .filter((item) => item.right > window.innerWidth + 1)
      .slice(0, 12),
  }));
  expect(overflow.amount, `Horizontal overflow: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(1);
  expect(runtimeErrors).toEqual([]);
});

test("desktop sidebar collapses persistently and language selection lives in the header", async ({ page }) => {
  const runtimeErrors = await mockDashboard(page, "advanced");
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Conversion and product intelligence" })).toBeVisible();

  await expect(page.locator(".topbar .lang-switch")).toBeVisible();
  await expect(page.locator(".sidebar .lang-switch")).toHaveCount(0);

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".app")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar .nav-item span").first()).toBeHidden();
  await expect.poll(() => page.locator(".main").evaluate((element) => getComputedStyle(element).marginInlineStart)).toBe("76px");

  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect(page.locator(".app")).toHaveClass(/sidebar-collapsed/);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(".app")).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar .nav-item span").first()).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
