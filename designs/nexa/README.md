# NEXA production adapter (unreleased)

This package renders `@storefront/core` with NEXA presentation tokens and scoped CSS. It has no Studio imports, catalog fixtures, payment simulation, or independent customer/cart state. `bootStorefront` loads tenant configuration; `Storefront` owns catalog, pathname routing, variants, cart, checkout, account sessions and newsletter HTTP requests.

From the design-stock root:

```sh
VITE_API_URL=https://your-staging-api.example VITE_STORE_SLUG=your-test-store npm --prefix designs/nexa run dev --workspaces=false
npm --prefix designs/nexa run build --workspaces=false
npm --prefix designs/nexa run typecheck --workspaces=false
```

Use Node 20 or newer. The dev server defaults to port 5186. Supply only public configuration in Vite variables; never credentials. Existing shared-core tenant resolution also supports storefront hostnames.

## Configuration and sections

`appearance.ts` supplies the search-first header only when no merchant header preset or centered-logo layout exists. It preserves backend design identity, appearance, navigation, sections and payment configuration. Published home sections are rendered by the shared dispatcher in configured order, honoring enabled state. Supported shared sections include hero, collections, products (grid/slider), image_text, newsletter and rich text. Merchant logo, accent, typography presets, radii, content width and footer content remain controlled by shared appearance/configuration. The NEXA package does not install default merchant copy or imagery.

Studio-specific editorial arrangements that exceed these shared section schemas are not persisted as invented section types. Multi-panel hero art, arbitrary per-category illustrations and bespoke editorial feature grids require a separately reviewed platform schema/editor extension. No shared-core or backend changes are included here.

## Release gate

Package metadata describes intended styling and capabilities, not customer availability. NEXA is deliberately absent from the manifest, backend allowlist and premium entitlement activation. Do not publish until an isolated staging merchant passes catalog, variants/inventory, customization save/publish, checkout/payment, account/session, newsletter and responsive acceptance. Local mock API checks do not satisfy this gate.

Assets contain only licensed fonts; product and campaign images come from merchant configuration/catalog. See the Studio `reviews/nexa-production` report for current evidence and remaining gaps.
