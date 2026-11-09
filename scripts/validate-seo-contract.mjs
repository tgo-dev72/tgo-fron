import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

const showroomRobots = read("apps/showroom/public/robots.txt");
expect(showroomRobots.includes("Sitemap: https://www.tijarago.com/sitemap.xml"), "showroom robots must advertise the production sitemap");
for (const path of ["/login", "/signup", "/create", "/launch/", "/dashboard", "/profile", "/design/*/preview"]) {
  expect(showroomRobots.includes(`Disallow: ${path}`), `showroom robots must disallow ${path}`);
}

const sitemap = read("apps/showroom/public/sitemap.xml");
expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), "showroom sitemap must be XML");
expect(sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), "showroom sitemap must use the sitemap namespace");
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
expect(locations.length > 0, "showroom sitemap must contain public routes");
expect(locations.every((url) => url.startsWith("https://www.tijarago.com/")), "sitemap URLs must use the canonical production origin");
expect(locations.every((url) => !/(login|signup|create|launch|dashboard|profile|preview)/.test(url)), "sitemap must not contain private or preview routes");
expect(new Set(locations).size === locations.length, "sitemap URLs must be unique");

for (const app of ["dashboard", "platform-admin"]) {
  const robots = read(`apps/${app}/public/robots.txt`);
  const html = read(`apps/${app}/index.html`);
  const vercel = JSON.parse(read(`apps/${app}/vercel.json`));
  expect(/^User-agent: \*\nDisallow: \/\s*$/m.test(robots), `${app} robots must disallow all crawling`);
  expect(/<meta name="robots" content="noindex, nofollow, noarchive" \/>/.test(html), `${app} initial HTML must be noindex`);
  expect(vercel.headers?.some((entry) => entry.source === "/(.*)" && entry.headers?.some((header) => header.key === "X-Robots-Tag" && header.value.includes("noindex"))), `${app} must send a global X-Robots-Tag`);
}

const showroomVercel = JSON.parse(read("apps/showroom/vercel.json"));
for (const source of ["/login", "/signup", "/verify-email-pending", "/create", "/membership", "/subscription", "/dashboard", "/profile", "/launch/(.*)", "/design/(.*)/preview"]) {
  expect(showroomVercel.headers?.some((entry) => entry.source === source && entry.headers?.some((header) => header.key === "X-Robots-Tag" && header.value.includes("noindex"))), `showroom ${source} must send noindex`);
}

const prerender = read("scripts/prerender-showroom-seo.mjs");
for (const route of ["/", "/pricing", "/gallery", "/how-it-works", "/terms", "/privacy"]) {
  expect(prerender.includes(`"${route}"`), `showroom prerender contract must include ${route}`);
}
expect(prerender.includes('application/ld+json'), "showroom prerender must emit structured data");
expect(prerender.includes('rel="canonical"'), "showroom prerender must emit canonical links");

if (errors.length) {
  console.error(`SEO contract validation failed (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`SEO contract validation OK — ${locations.length} public sitemap routes; private applications and routes protected`);
