import { expect, test, type Route } from "@playwright/test";

function respond(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("merchant can request a reset from sign-in and receives neutral confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/backend/accounts/me", (route) => respond(route, { detail: "Not authenticated." }, 401));
  await page.route("**/backend/accounts/csrf", (route) => respond(route, { csrfToken: "test-csrf" }));
  let submitted = "";
  await page.route("**/backend/accounts/password-reset", async (route) => {
    submitted = (route.request().postDataJSON() as { email: string }).email;
    await respond(route, { message: "If an eligible account exists, a recovery email will be sent." });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  const email = page.getByLabel("Email", { exact: true });
  // The recovery page is lazy-loaded. Wait for the controlled input to remain
  // mounted after the development server's first transform before typing.
  await expect(email).toBeEditable();
  await page.waitForTimeout(250);
  await email.fill("MERCHANT@example.com");
  await expect(email).toHaveValue("MERCHANT@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("eligible account");
  expect(submitted).toBe("merchant@example.com");
});

test("reset token is removed from the URL and a successful reset requires sign-in", async ({ page }) => {
  await page.route("**/backend/accounts/me", (route) => respond(route, { detail: "Not authenticated." }, 401));
  await page.route("**/backend/accounts/csrf", (route) => respond(route, { csrfToken: "test-csrf" }));
  let submittedToken = "";
  await page.route("**/backend/accounts/password-reset/confirm", async (route) => {
    submittedToken = (route.request().postDataJSON() as { token: string }).token;
    await respond(route, { message: "Password updated. You can sign in now." });
  });
  await page.goto("/reset-password#token=qa-test-token");
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill("NewSecret12345");
  await page.getByLabel("Confirm password").fill("NewSecret12345");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  expect(submittedToken).toBe("qa-test-token");
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("invalid links and French/Arabic recovery copy stay usable", async ({ page }) => {
  await page.route("**/backend/accounts/me", (route) => respond(route, { detail: "Not authenticated." }, 401));
  await page.goto("/reset-password");
  await expect(page.getByRole("alert")).toContainText("invalid or has expired");
  await page.getByRole("button", { name: "Français" }).click();
  await expect(page.getByRole("alert")).toContainText("invalide ou expiré");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.getByRole("alert")).toContainText("غير صالح");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: "اطلب رابطًا جديدًا" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("merchant password is checked before confirmation and server password errors stay actionable", async ({ page }) => {
  await page.route("**/backend/accounts/me", (route) => respond(route, { detail: "Not authenticated." }, 401));
  await page.route("**/backend/accounts/csrf", (route) => respond(route, { csrfToken: "test-csrf" }));
  let confirmations = 0;
  await page.route("**/backend/accounts/password-reset/confirm", async (route) => {
    confirmations += 1;
    await respond(route, { code: "password_invalid", password: ["Choose a less common password."] }, 400);
  });
  await page.goto("/reset-password#token=qa-validation-token");
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toContainText("at least 8 characters");
  expect(confirmations).toBe(0);

  await page.getByLabel("New password", { exact: true }).fill("GoodPassword123");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toContainText("do not match");
  expect(confirmations).toBe(0);

  await page.getByLabel("Confirm password").fill("GoodPassword123");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toContainText("less common password");
  expect(confirmations).toBe(1);
});
