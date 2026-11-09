import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = new Map([
  ["/", "https://www.tijarago.com/"],
  ["/pricing", "https://www.tijarago.com/pricing"],
  ["/gallery", "https://www.tijarago.com/gallery"],
  ["/how-it-works", "https://www.tijarago.com/how-it-works"],
  ["/terms", "https://www.tijarago.com/terms"],
  ["/privacy", "https://www.tijarago.com/privacy"],
]);

for (const [route, canonical] of routes) {
  const file = route === "/" ? "apps/showroom/dist/index.html" : `apps/showroom/dist${route}/index.html`;
  const html = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(html, /<title>[^<]+<\/title>/, `${route}: title missing`);
  assert.match(html, /<meta name="description" content="[^"]+"\s*\/>/, `${route}: description missing`);
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}" />`), `${route}: canonical mismatch`);
  assert.ok(html.includes('<meta name="robots" content="index, follow, max-image-preview:large" />'), `${route}: robots mismatch`);
  for (const field of ["og:title", "og:description", "og:url", "twitter:card", "twitter:title", "twitter:description"]) {
    assert.ok(html.includes(`content=`) && html.includes(field), `${route}: ${field} missing`);
  }
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)];
  assert.ok(blocks.length, `${route}: JSON-LD missing`);
  blocks.forEach((block) => JSON.parse(block[1]));
}

console.log(`Showroom raw-HTML SEO OK — ${routes.size} prerendered public routes`);
