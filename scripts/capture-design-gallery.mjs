#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const temporaryOutput = process.argv.includes("--temporary");
const explicitOutput = readOption("output");
const outputDir = explicitOutput
  ? join(root, explicitOutput)
  : temporaryOutput
  ? join(tmpdir(), `tijarago-gallery-smoke-${process.pid}`)
  : join(root, "apps", "showroom", "public", "gallery", "current");
const apiUrl = "http://127.0.0.1:8090";
const viteBin = join(root, "node_modules", ".bin", "vite");
const requestedDesigns = readOption("design")?.split(",").map((value) => value.trim()).filter(Boolean);
const requestedViews = readOption("views")?.split(",").map((value) => value.trim()).filter(Boolean);
const responsiveViews = ["width-320", "width-375", "width-768", "width-1024", "width-1280", "width-1920"];
const allViews = ["storefront", "header", "product", "cart", "checkout", "tablet", "mobile", "mobile-header", "navigation", ...responsiveViews];
const views = requestedViews ?? allViews;
const designs = requestedDesigns
  ? manifest.designs.filter((design) => requestedDesigns.includes(design.key))
  : manifest.designs;

if (designs.length === 0) fail("No matching designs were found.");
for (const view of views) {
  if (!allViews.includes(view)) fail(`Unknown gallery view: ${view}`);
}

const browser = findBrowser();
mkdirSync(outputDir, { recursive: true });

let apiProcess = null;
let designProcess = null;

process.on("SIGINT", () => {
  stopProcesses();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopProcesses();
  process.exit(143);
});

try {
  if (!(await reachable(apiUrl))) {
    apiProcess = spawn(process.execPath, [join(root, "scripts", "mock-api.mjs")], {
      cwd: root,
      env: { ...process.env, MOCK_API_TLS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    pipeErrors(apiProcess, "mock API");
    await waitFor(apiUrl, "mock API", apiProcess);
  }

  for (const design of designs) {
    const designDir = join(root, "designs", design.key);
    if (!existsSync(join(designDir, "package.json"))) fail(`Missing design package: ${design.key}`);
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;

    designProcess = spawn(
      viteBin,
      ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      {
        cwd: designDir,
        env: { ...process.env, VITE_API_URL: apiUrl, VITE_STORE_SLUG: design.key },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    pipeErrors(designProcess, design.key);
    await waitFor(origin, design.key, designProcess);

    console.log(`\n${design.key}`);
    for (const view of views) {
      const { width, height, query, suffix } = captureSpec(view);
      const targetDir = explicitOutput ? join(outputDir, design.key) : outputDir;
      mkdirSync(targetDir, { recursive: true });
      const target = join(targetDir, `${design.key}${suffix}.png`);
      const url = `${origin}/${query ? `?gallery=${query}&capture=${Date.now()}` : `?capture=${Date.now()}`}`;
      const result = spawnSync(
        browser,
        [
          "--headless",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--ignore-certificate-errors",
          "--hide-scrollbars",
          "--dump-dom",
          "--run-all-compositor-stages-before-draw",
          "--virtual-time-budget=9000",
          `--window-size=${width},${height}`,
          `--screenshot=${target}`,
          url,
        ],
        { cwd: root, encoding: "utf8" },
      );
      if (result.status !== 0) {
        fail(`${design.key}/${view} capture failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
      }
      if (!existsSync(target) || statSync(target).size < 10_000) {
        fail(`${design.key}/${view} did not produce a valid screenshot.`);
      }
      verifyRenderedDom(design.key, view, result.stdout);
      console.log(`  ✓ ${view}`);
    }

    verifyInteractiveViews(design.key, views);
    await stop(designProcess);
    designProcess = null;
  }
} finally {
  stopProcesses();
  if (temporaryOutput) rmSync(outputDir, { recursive: true, force: true });
}

console.log(`\nGallery capture complete — ${designs.length} design(s), ${views.length} view(s) each.`);

function readOption(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function findBrowser() {
  const candidates = [process.env.GALLERY_BROWSER, "google-chrome", "chromium", "chromium-browser"].filter(Boolean);
  for (const candidate of candidates) {
    if (spawnSync(candidate, ["--version"], { stdio: "ignore" }).status === 0) return candidate;
  }
  fail("No supported Chromium browser found. Set GALLERY_BROWSER to its executable path.");
}

function captureSpec(view) {
  if (view.startsWith("width-")) {
    const width = Number(view.slice(6));
    return { width, height: width < 600 ? 900 : 1080, query: "", suffix: `-${view}` };
  }
  if (view === "header") return { width: 1440, height: 300, query: "", suffix: "-header" };
  if (view === "mobile") return { width: 430, height: 900, query: "", suffix: "-mobile" };
  if (view === "mobile-header") return { width: 390, height: 280, query: "", suffix: "-mobile-header" };
  if (view === "navigation") return { width: 430, height: 900, query: "navigation", suffix: "-navigation" };
  if (view === "tablet") return { width: 900, height: 1080, query: "", suffix: "-tablet" };
  return {
    width: 1440,
    height: 1080,
    query: view === "storefront" ? "" : view,
    suffix: view === "storefront" ? "" : `-${view}`,
  };
}

async function reachable(url) {
  try {
    const response = await fetch(url);
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitFor(url, label, child = null) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child?.exitCode !== null) fail(`${label} stopped before becoming ready (exit ${child.exitCode}).`);
    if (await reachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`Timed out waiting for ${label} at ${url}.`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => port ? resolve(port) : reject(new Error("Could not allocate a gallery port.")));
    });
  });
}

function pipeErrors(child, label) {
  let errorText = "";
  child.stderr?.on("data", (chunk) => { errorText += String(chunk); });
  child.on("exit", (code) => {
    if (code && designProcess === child) console.error(`${label} stopped unexpectedly (${code}). ${errorText.trim()}`);
  });
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verifyInteractiveViews(key, capturedViews) {
  const targetDir = explicitOutput ? join(outputDir, key) : outputDir;
  const storefront = join(targetDir, `${key}.png`);
  if (!existsSync(storefront)) return;
  const hashes = new Map([[hash(storefront), "storefront"]]);
  for (const view of ["product", "cart", "checkout"]) {
    if (!capturedViews.includes(view)) continue;
    const path = join(targetDir, `${key}-${view}.png`);
    const viewHash = hash(path);
    const duplicate = hashes.get(viewHash);
    if (duplicate) fail(`${key}/${view} is identical to ${duplicate}; the requested UI state did not open.`);
    hashes.set(viewHash, view);
  }
}

function verifyRenderedDom(key, view, html) {
  const demoBrands = { basic: "Northline Goods", beauty: "Aurelle", fashion: "Forma Studio", electronics: "Circuit", nexa: "NEXA Select" };
  if (!html.includes(demoBrands[key])) {
    fail(`${key}/${view} did not render the configured store identity.`);
  }
  if (html.includes('class="sf-grid sf-grid-loading"')) {
    fail(`${key}/${view} remained in its catalog loading state.`);
  }
  const requiredClass = {
    product: "sf-product-page",
    cart: "sf-cart is-open",
    checkout: "sf-co-panel",
    navigation: "sf-mobile-drawer is-open",
  }[view];
  if (requiredClass && !(view === "product" ? html.includes("sf-pdp sf-product-page") : html.includes(`class="${requiredClass}`))) {
    fail(`${key}/${view} did not open the expected commerce UI.`);
  }
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function stopProcesses() {
  if (designProcess?.exitCode === null) designProcess.kill("SIGTERM");
  if (apiProcess?.exitCode === null) apiProcess.kill("SIGTERM");
}

function fail(message) {
  console.error(`Gallery capture failed: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}
