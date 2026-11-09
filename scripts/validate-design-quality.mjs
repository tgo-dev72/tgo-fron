#!/usr/bin/env node
/** Guardrails for claims and production capability wiring in storefront designs. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const errors = [];
const warnings = [];
const galleryDir = join(root, "apps", "showroom", "public", "gallery", "current");
const uiSourcePattern = /\.(?:css|js|jsx|ts|tsx)$/;
const decorativePictographPattern = /\p{Extended_Pictographic}/u;

const storefrontGalleryHashes = new Map();

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function validateUiGlyphs(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".vercel", "dist", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      validateUiGlyphs(path);
      continue;
    }
    if (!uiSourcePattern.test(entry.name)) continue;
    const source = readFileSync(path, "utf8").replaceAll("©", "");
    const match = source.match(decorativePictographPattern);
    if (match) errors.push(`${path.slice(root.length + 1)}: decorative pictograph ${JSON.stringify(match[0])} must use the UI icon system`);
  }
}

for (const sourceRoot of ["apps", "designs", "packages"]) {
  validateUiGlyphs(join(root, sourceRoot));
}

const publicPremiumIndex = readFileSync(join(root, "packages/storefront-premium/src/index.ts"), "utf8");
if (publicPremiumIndex.includes("premium-checkout")) {
  errors.push("unfinished premium checkout must not be exported by @platform/premium");
}

const ratingSource = readFileSync(join(root, "packages/storefront-premium/src/components.tsx"), "utf8");
for (const claim of ["Verified purchase", "BUYER_CITIES"]) {
  if (ratingSource.includes(claim)) errors.push(`storefront rating UI contains unsupported claim/data: ${claim}`);
}

for (const design of manifest.designs ?? []) {
  if (design.status !== "ready") continue;
  const galleryFiles = {
    storefront: join(galleryDir, `${design.key}.png`),
    product: join(galleryDir, `${design.key}-product.png`),
    cart: join(galleryDir, `${design.key}-cart.png`),
    checkout: join(galleryDir, `${design.key}-checkout.png`),
    tablet: join(galleryDir, `${design.key}-tablet.png`),
    mobile: join(galleryDir, `${design.key}-mobile.png`),
  };
  for (const [view, path] of Object.entries(galleryFiles)) {
    if (!existsSync(path)) errors.push(`${design.key}: missing ${view} gallery image`);
  }
  if (existsSync(galleryFiles.storefront)) {
    const storefrontHash = fileHash(galleryFiles.storefront);
    const duplicateDesign = storefrontGalleryHashes.get(storefrontHash);
    if (duplicateDesign) errors.push(`${design.key}: storefront gallery image duplicates ${duplicateDesign}`);
    storefrontGalleryHashes.set(storefrontHash, design.key);
  }
  if (Object.values(galleryFiles).every(existsSync)) {
    const hashes = new Map([[fileHash(galleryFiles.storefront), "storefront"]]);
    for (const view of ["product", "cart", "checkout"]) {
      const viewHash = fileHash(galleryFiles[view]);
      const duplicate = hashes.get(viewHash);
      if (duplicate) errors.push(`${design.key}: ${view} gallery image duplicates ${duplicate}`);
      hashes.set(viewHash, view);
    }
  }
  if (!design.demo_url) warnings.push(`${design.key}: no hosted demo URL yet`);
  if (design.tier !== "premium") continue;

  const appPath = join(root, "designs", design.key, "src", "App.tsx");
  if (!existsSync(appPath)) {
    errors.push(`${design.key}: missing premium app`);
    continue;
  }
  const appSource = readFileSync(appPath, "utf8");
  for (const symbol of ["Storefront", "ThemeHero", "renderThemeSections", "renderThemeProduct"]) {
    if (!appSource.includes(symbol)) errors.push(`${design.key}: ${symbol} must use shared commerce and category sections`);
  }
  if (!existsSync(join(root, "designs", design.key, "src", `${design.key}.css`))) {
    errors.push(`${design.key}: missing category-specific stylesheet`);
  }
}

if (errors.length > 0) {
  console.error("Design quality checks FAILED:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`Design quality checks OK — ${manifest.designs.length} designs checked`);
if (warnings.length > 0) {
  console.warn(`Preview readiness: ${warnings.length} non-blocking gap(s)`);
  for (const warning of warnings) console.warn(`  - ${warning}`);
}
