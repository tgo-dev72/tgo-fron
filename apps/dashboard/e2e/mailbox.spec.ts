import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const user = { email: "merchant@example.com", first_name: "Test", last_name: "Merchant", email_verified: true };
const store = {
  id: 7, slug: "teststore", name: "Test Store", logo: null, logo_url: null,
  retail_type: null, retail_type_detail: null, catalog_config: {},
  members: [{ id: 1, user: 1, email: user.email, first_name: "Test", last_name: "Merchant", role: "owner", created_at: "2026-10-01T00:00:00Z" }],
  storefront_url: "https://teststore.example.test", storefront_request_id: 2,
  storefront_status: "live", storefront_progress: 100, plan: "premium", analytics_level: "advanced", created_at: "2026-10-01T00:00:00Z",
};
const inbound = {
  public_id: "11111111-1111-4111-8111-111111111111", direction: "inbound", status: "received",
  sender_email: "ada@example.com", sender_name: "Ada Customer", recipient_email: "teststore@mail.tijarago.com",
  subject: "Product question", text_body: "Is the green edition available?", html_body: "", message_id: "<incoming@example.com>",
  in_reply_to: "", attachments: [], created_at: "2026-10-17T12:00:00Z",
};
const conversation = {
  public_id: "22222222-2222-4222-8222-222222222222", correspondent_email: "ada@example.com", correspondent_name: "Ada Customer",
  subject: "Product question", status: "open", unread_count: 1, last_message_at: "2026-10-17T12:00:00Z", latest_message: inbound,
};

async function mockMailbox(page: Page) {
  await page.route("**/backend/accounts/me", (route) => json(route, { message: "ok", user }));
  await page.route("**/backend/api/store/", (route) => json(route, [store]));
  await page.route("**/backend/api/subscriptions/status", (route) => json(route, {
    subscription: null, subscriptions: [], latest_payment: null, payment: null, balances: [],
  }));
  await page.route("**/backend/api/access/store/7/me/", (route) => json(route, {
    store_id: 7,
    membership_id: 1,
    permissions: ["mailbox.view", "mailbox.send"],
    field_permissions: {},
  }));
  await page.route("**/backend/api/store/7/mailbox/", async (route) => {
    if (route.request().method() === "POST") return json(route, { address: "teststore@mail.tijarago.com", configured: true, enabled: true, unread: 1, open: 1 });
    return json(route, { address: "teststore@mail.tijarago.com", configured: true, enabled: true, unread: 1, open: 1 });
  });
  await page.route("**/backend/api/store/7/mailbox/conversations/?*", (route) => json(route, { count: 1, next: null, previous: null, results: [conversation] }));
  await page.route(`**/backend/api/store/7/mailbox/conversations/${conversation.public_id}/`, (route) => json(route, { ...conversation, unread_count: 0, messages: [inbound] }));
}

test("merchant reads and replies from the store mailbox", async ({ page }) => {
  await mockMailbox(page);
  let replyBody = "";
  await page.route(`**/backend/api/store/7/mailbox/conversations/${conversation.public_id}/reply/`, async (route) => {
    replyBody = (await route.request().postDataJSON()).text;
    return json(route, { ...inbound, public_id: "33333333-3333-4333-8333-333333333333", direction: "outbound", status: "sent", sender_email: "teststore@mail.tijarago.com", sender_name: "Test Store", recipient_email: "ada@example.com", text_body: replyBody });
  });
  await page.goto("/mailbox");
  await expect(page.getByRole("heading", { name: "Store mailbox" })).toBeVisible();
  await expect(page.getByText("teststore@mail.tijarago.com")).toBeVisible();
  await page.getByRole("button", { name: /Ada Customer/ }).click();
  await expect(page.getByRole("article").getByText("Is the green edition available?")).toBeVisible();
  await page.getByPlaceholder("Write a reply as your store…").fill("Yes, it is available.");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect.poll(() => replyBody).toBe("Yes, it is available.");
});

test("mailbox conversation remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMailbox(page);
  await page.goto("/mailbox");
  await page.getByRole("button", { name: /Ada Customer/ }).click();
  await expect(page.getByRole("article").getByText("Is the green edition available?")).toBeVisible();
  await expect(page.locator(".mailbox-thread")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
