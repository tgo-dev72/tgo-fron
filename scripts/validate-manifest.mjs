#!/usr/bin/env node
/**
 * Validates design-stock/manifest.json — the contract the showroom and
 * backend GET /api/designs/ read. Fails loudly on a malformed entry.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

const CONFIG_TYPES = new Set(["text", "email", "color", "select"]);
const TIERS = new Set(["standard", "premium"]);
const STATUSES = new Set(["ready", "building"]);
const FEATURE_MATURITY = new Set(["production", "beta", "prototype"]);
const PREMIUM_FEATURES = new Set([
  "accountDashboard",
  "bundles",
  "compare",
  "expressCheckout",
  "facetedSearch",
  "infiniteScroll",
  "instantSearch",
  "lookbook",
  "quickView",
  "quoteBuilder",
  "recommendations",
  "savedAddresses",
  "socialProof",
  "tieredPricing",
  "wishlist",
]);
const REQUIRED_CONFIG_KEYS = new Set(["store_name", "contact_email", "currency", "brand_color"]);
const errors = [];

if (manifest.version !== 2) {
  errors.push("manifest.version must be 2");
}

if (!Array.isArray(manifest.designs) || manifest.designs.length === 0) {
  errors.push("manifest.designs must be a non-empty array");
} else {
  const keys = new Set();
  const ports = new Set();
  for (const d of manifest.designs) {
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(d.key ?? "")) {
      errors.push(`design "${d.key}": key must be lowercase with hyphens only`);
    }
    if (keys.has(d.key)) errors.push(`design "${d.key}": duplicate key`);
    keys.add(d.key);

    for (const field of ["name", "tagline", "description"]) {
      if (typeof d[field] !== "string" || d[field].length === 0) {
        errors.push(`design "${d.key}": missing string field "${field}"`);
      }
    }
    for (const field of ["family", "business_need"]) {
      if (typeof d[field] !== "string" || d[field].trim().length === 0) {
        errors.push(`design "${d.key}": missing business contract field "${field}"`);
      }
    }
    for (const field of ["best_for", "journey", "business_outcomes"]) {
      if (!Array.isArray(d[field]) || d[field].length < 2 || d[field].some((value) => typeof value !== "string" || !value.trim())) {
        errors.push(`design "${d.key}": "${field}" must contain at least two non-empty labels`);
      }
    }
    if (!STATUSES.has(d.status)) {
      errors.push(`design "${d.key}": status must be "ready" or "building"`);
    }
    if (!Array.isArray(d.screenshots)) {
      errors.push(`design "${d.key}": screenshots must be an array`);
    }
    if (d.demo_url !== null && typeof d.demo_url !== "string") {
      errors.push(`design "${d.key}": demo_url must be a string or null`);
    }
    if (!Number.isInteger(d.dev_port) || d.dev_port < 1024 || d.dev_port > 65535) {
      errors.push(`design "${d.key}": dev_port must be a valid integer port`);
    } else if (ports.has(d.dev_port)) {
      errors.push(`design "${d.key}": duplicate dev_port ${d.dev_port}`);
    } else {
      ports.add(d.dev_port);
    }
    if (!TIERS.has(d.tier)) {
      errors.push(`design "${d.key}": tier must be "standard" or "premium"`);
    }

    const features = d.features ?? [];
    if (!Array.isArray(features)) {
      errors.push(`design "${d.key}": features must be an array`);
    } else {
      const featureSet = new Set();
      for (const feature of features) {
        if (!PREMIUM_FEATURES.has(feature)) {
          errors.push(`design "${d.key}": unknown or unverified premium feature "${feature}"`);
        }
        if (featureSet.has(feature)) {
          errors.push(`design "${d.key}": duplicate feature "${feature}"`);
        }
        featureSet.add(feature);
      }
      if (d.tier === "standard" && features.length > 0) {
        errors.push(`design "${d.key}": standard designs cannot advertise premium features`);
      }
      if (d.tier === "premium" && d.status === "ready" && features.length < 2) {
        errors.push(`design "${d.key}": a ready premium family must expose at least 2 verified features`);
      }
    }

    const maturity = d.feature_maturity ?? {};
    if (typeof maturity !== "object" || maturity === null || Array.isArray(maturity)) {
      errors.push(`design "${d.key}": feature_maturity must be an object`);
    } else if (d.tier === "standard" && Object.keys(maturity).length > 0) {
      errors.push(`design "${d.key}": standard designs cannot declare premium feature maturity`);
    } else if (d.tier === "premium" && Array.isArray(features)) {
      const advertised = new Set(features);
      for (const feature of features) {
        if (maturity[feature] !== "production") {
          errors.push(`design "${d.key}": advertised feature "${feature}" must be certified as production`);
        }
      }
      for (const [feature, status] of Object.entries(maturity)) {
        if (!PREMIUM_FEATURES.has(feature)) {
          errors.push(`design "${d.key}": feature_maturity contains unknown feature "${feature}"`);
        }
        if (!FEATURE_MATURITY.has(status)) {
          errors.push(`design "${d.key}": feature "${feature}" has invalid maturity "${status}"`);
        }
        if (!advertised.has(feature) && status === "production") {
          errors.push(`design "${d.key}": production feature "${feature}" must be advertised in features`);
        }
      }
    }

    const designDir = join(root, "designs", d.key ?? "");
    for (const relative of ["package.json", "src/App.tsx", "src/main.tsx", "vite.config.ts"]) {
      if (!existsSync(join(designDir, relative))) {
        errors.push(`design "${d.key}": missing designs/${d.key}/${relative}`);
      }
    }
    const packagePath = join(designDir, "package.json");
    if (existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
        if (typeof pkg.name !== "string" || !pkg.name) errors.push(`design "${d.key}": package name is missing`);
        for (const script of ["build", "typecheck"]) {
          if (typeof pkg.scripts?.[script] !== "string") errors.push(`design "${d.key}": package script "${script}" is missing`);
        }
      } catch {
        errors.push(`design "${d.key}": package.json is invalid JSON`);
      }
    }
    const appPath = join(designDir, "src", "App.tsx");
    if (existsSync(appPath)) {
      const appSource = readFileSync(appPath, "utf8");
      if (!/from\s+["']@storefront\/core["']/.test(appSource)) {
        errors.push(`design "${d.key}": App.tsx must render through the shared storefront core`);
      }
      if (!/export\s+default\s+/.test(appSource)) {
        errors.push(`design "${d.key}": App.tsx must provide a default app export`);
      }
    }

    const capabilitiesPath = join(designDir, "src", "capabilities.json");
      if (d.tier === "premium") {
      if (!existsSync(capabilitiesPath)) {
        errors.push(`design "${d.key}": premium design is missing src/capabilities.json`);
      } else {
        try {
          const capabilities = JSON.parse(readFileSync(capabilitiesPath, "utf8"));
          if (capabilities.tier !== "premium") errors.push(`design "${d.key}": capabilities tier must be premium`);
          if (JSON.stringify(capabilities.features) !== JSON.stringify(features)) {
            errors.push(`design "${d.key}": manifest features must exactly match src/capabilities.json`);
          }
          if (JSON.stringify(capabilities.feature_maturity) !== JSON.stringify(d.feature_maturity)) {
            errors.push(`design "${d.key}": manifest feature_maturity must exactly match src/capabilities.json`);
          }
        } catch {
          errors.push(`design "${d.key}": src/capabilities.json is invalid JSON`);
        }
      }
    }

    if (!Array.isArray(d.config_schema) || d.config_schema.length === 0) {
      errors.push(`design "${d.key}": config_schema must be a non-empty array`);
    } else {
      const cfgKeys = new Set();
      for (const f of d.config_schema) {
        if (!["key", "label"].every((p) => typeof f[p] === "string")) {
          errors.push(`design "${d.key}": config_schema field missing key/label`);
        }
        if (cfgKeys.has(f.key)) errors.push(`design "${d.key}": config_schema duplicate key "${f.key}"`);
        cfgKeys.add(f.key);
        if (!CONFIG_TYPES.has(f.type)) {
          errors.push(`design "${d.key}": config_schema field "${f.key}" has unknown type "${f.type}"`);
        }
        if (typeof f.required !== "boolean") {
          errors.push(`design "${d.key}": config_schema field "${f.key}" missing boolean required`);
        }
        if (f.type === "select" && (!Array.isArray(f.options) || f.options.length === 0)) {
          errors.push(`design "${d.key}": select field "${f.key}" must define options`);
        }
      }
      for (const requiredKey of REQUIRED_CONFIG_KEYS) {
        if (!cfgKeys.has(requiredKey)) {
          errors.push(`design "${d.key}": config_schema missing required platform field "${requiredKey}"`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error("manifest.json is INVALID:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const premiumCount = manifest.designs.filter((design) => design.tier === "premium").length;
const readyCount = manifest.designs.filter((design) => design.status === "ready").length;
console.log(`manifest.json OK — ${manifest.designs.length} business families: ${readyCount} ready, ${premiumCount} premium`);
