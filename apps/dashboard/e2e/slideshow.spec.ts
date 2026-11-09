import { expect, test } from "@playwright/test";

test("public slideshow pauses for keyboard access and reduced motion, with mobile images", async ({ page }) => {
  await page.route("https://images.example.test/**", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9X0AAAAASUVORK5CYII=", "base64") }));
  await page.clock.install();
  await page.goto("/e2e/fixtures/slideshow.html");
  await expect(page.getByRole("heading", { name: "First offer" })).toBeVisible();
  await page.clock.fastForward(5100);
  await expect(page.getByRole("heading", { name: "Second offer" })).toBeVisible();
  await page.getByRole("link", { name: "Explore" }).focus();
  await page.clock.fastForward(10100);
  await expect(page.getByRole("heading", { name: "Second offer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await page.getByRole("button", { name: "Previous slide" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "First offer" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.clock.fastForward(10100);
  await expect(page.getByRole("heading", { name: "First offer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause slideshow" })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const currentImage = page.locator('.sf-slide[aria-hidden="false"] .sf-slide-media img');
  await expect.poll(() => currentImage.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain("mobile.png");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("slideshow-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => currentImage.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain("desktop.png");
});
