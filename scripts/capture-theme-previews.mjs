#!/usr/bin/env node

import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const catalogUrl = process.env.THEME_PREVIEW_CATALOG_URL || "https://api.tijarago.com/api/theme-previews/";
const outputDir = join(process.cwd(), "apps", "showroom", "public", "gallery", "generated");
const allowedSuffix = process.env.THEME_PREVIEW_HOST_SUFFIX || ".preview.tijarago.com";
const browser = findBrowser();

const response = await fetch(catalogUrl, { headers: { Accept: "application/json" } });
if (!response.ok) fail(`Preview registry returned HTTP ${response.status}.`);
const themes = (await response.json()).filter((theme) => theme.status === "ready" && theme.preview_available);
if (!themes.length) fail("The registry has no enabled theme previews to capture.");
mkdirSync(outputDir, { recursive: true });

for (const theme of themes) {
  const url = new URL(theme.demo_url);
  if (url.protocol !== "https:" || !(url.hostname === allowedSuffix.slice(1) || url.hostname.endsWith(allowedSuffix))) {
    fail(`Refusing untrusted preview URL for ${theme.key}: ${url.origin}`);
  }
  for (const capture of [{ suffix: "", width: 1440, height: 1080 }, { suffix: "-mobile", width: 390, height: 900 }]) {
    const target = join(outputDir, `${theme.key}${capture.suffix}.png`);
    const flags = [
      "--headless", "--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox", "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw", "--virtual-time-budget=12000",
      `--window-size=${capture.width},${capture.height}`,
    ];
    const dom = spawnSync(browser, [...flags, "--dump-dom", url.toString()], { encoding: "utf8" });
    if (dom.status !== 0 || !dom.stdout.includes('class="sf-root"') || dom.stdout.includes("ds-store-bootstrap")) {
      fail(`${theme.key}${capture.suffix} did not stabilize into a rendered storefront.`);
    }
    const result = spawnSync(browser, [...flags, `--screenshot=${target}`, url.toString()], { encoding: "utf8" });
    if (result.status !== 0 || !existsSync(target) || statSync(target).size < 10_000) {
      fail(`${theme.key}${capture.suffix} capture failed: ${result.stderr || result.stdout || "invalid output"}`);
    }
    console.log(`✓ ${theme.key}${capture.suffix}`);
  }
}

function findBrowser() {
  for (const candidate of [process.env.GALLERY_BROWSER, "google-chrome", "chromium", "chromium-browser"].filter(Boolean)) {
    if (spawnSync(candidate, ["--version"], { stdio: "ignore" }).status === 0) return candidate;
  }
  fail("No Chromium browser found. Set GALLERY_BROWSER to its executable path.");
}

function fail(message) { console.error(message); process.exit(1); }
