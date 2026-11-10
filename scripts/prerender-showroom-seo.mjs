import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "apps/showroom/dist");
const template = readFileSync(resolve(dist, "index.html"), "utf8");
const origin = "https://www.tijarago.com";
const image = `${origin}/icon-512.png?v=2`;

const routes = {
  "/": {
    title: "TijaraGO — أنشئ وأدر متجرك الإلكتروني بسهولة",
    description: "أنشئ متجرًا إلكترونيًا متعدد اللغات، وأدر المنتجات والطلبات والعملاء والتسويق وتصميم متجرك بسهولة مع TijaraGO.",
    lang: "ar",
    schema: [
      { "@context": "https://schema.org", "@type": "Organization", name: "TijaraGO", url: `${origin}/`, logo: image },
      { "@context": "https://schema.org", "@type": "WebSite", name: "TijaraGO", url: `${origin}/`, inLanguage: ["en", "fr", "ar"] },
    ],
  },
  "/pricing": {
    title: "TijaraGO pricing — Plans for online stores",
    description: "Compare TijaraGO plans for creating and managing online stores, including store, catalog, team, analytics and marketing allowances.",
  },
  "/gallery": {
    title: "Online store themes and designs — TijaraGO",
    description: "Explore TijaraGO storefront designs for fashion, beauty, electronics and general retail businesses.",
  },
  "/how-it-works": {
    title: "How to create an online store with TijaraGO",
    description: "See how TijaraGO guides merchants from account creation and storefront design to products, deployment and order management.",
  },
  "/terms": {
    title: "Terms of service — TijaraGO",
    description: "Read the terms governing use of the TijaraGO commerce platform and merchant services.",
  },
  "/privacy": {
    title: "Privacy policy — TijaraGO",
    description: "Learn how TijaraGO handles personal information across its public website, merchant workspace and storefront services.",
  },
};

const escapeAttribute = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

function render(path, metadata) {
  const canonical = `${origin}${path === "/" ? "/" : path}`;
  const breadcrumb = path === "/" ? null : {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TijaraGO", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: metadata.title.split(" — ")[0], item: canonical },
    ],
  };
  const schemas = [...(metadata.schema ?? []), ...(breadcrumb ? [breadcrumb] : [])];
  const tags = [
    `<title>${escapeAttribute(metadata.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(metadata.description)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<link rel="canonical" href="${canonical}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${escapeAttribute(metadata.title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(metadata.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttribute(metadata.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(metadata.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...schemas.map((schema) => `<script type="application/ld+json">${safeJson(schema)}</script>`),
  ].join("\n    ");
  return template
    .replace(/<html lang="[^"]+">/i, `<html lang="${metadata.lang ?? "en"}">`)
    .replace(/\s*<title>[^<]*<\/title>/i, "")
    .replace(/\s*<meta name="description"[^>]*>/i, "")
    .replace("</head>", `    ${tags}\n  </head>`);
}

for (const [path, metadata] of Object.entries(routes)) {
  const destination = path === "/" ? resolve(dist, "index.html") : resolve(dist, path.slice(1), "index.html");
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, render(path, metadata));
}

console.log(`Prerendered ${Object.keys(routes).length} showroom SEO documents`);
