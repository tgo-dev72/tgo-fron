# TijaraGO storefront themes

The showroom offers five released storefront themes. `manifest.json` is the current catalog; the backend pins the same source revision when it scaffolds a store.

| Theme | Package | Tier | Buying journey |
| --- | --- | --- | --- |
| Essential | `designs/basic` | Standard | Clear catalog, product options, cart and checkout |
| Beauty | `designs/beauty` | Premium | Concern and ingredient discovery, routine products, product education |
| Fashion | `designs/fashion` | Premium | Campaign imagery, editorial collections, prominent apparel variants |
| Electronics | `designs/electronics` | Premium | Attribute filters, specifications, product comparison |
| Atelier | `designs/atelier` | Premium | Editorial discovery for curated lifestyle and mixed catalogs |

All five use `packages/storefront-core` for the API client, localization, RTL, catalog, product pages, cart, checkout, accounts, SEO, loading states and merchant appearance controls. `packages/storefront-core/src/themes/` contains the shared theme definitions, category components and rendering hooks. Each `designs/<key>` package is a thin app shell plus its own visual CSS. No theme duplicates payment or order logic.

## Selection and customization

The merchant selects a design key from `/api/designs/`. The backend validates plan entitlement and stores that key. A release revision pins both the catalog manifest and the storefront source used for deployment. The selected app boots with the runtime store configuration from `/api/storefront/config/` and real catalog data. Existing stores on older pinned revisions retain their deployed bundles.

`THEME_DEFINITIONS` exposes each theme's tier, section types and basic settings as serializable data. Merchant appearance, palette, logo, homepage sections and published pages come from runtime store configuration. The core storefront renders configured pages before a theme's defaults. Beauty concern and ingredient chips use product attributes; Electronics comparison only shows attributes present on the products. Product claims and warranty details come from merchant catalog data. Theme CSS supplies defaults; merchant appearance and brand settings can override supported tokens. There is no full visual theme editor in this release.

To release another theme, add a `designs/<key>` package with a small `App.tsx` that composes `Storefront`, a token definition and theme CSS. Add its definition to `packages/storefront-core/src/themes/`, a manifest entry, a capability manifest if premium, and demo catalog data only for local previews. Run gallery capture and the release checks. Keep payment, cart and authentication in the shared core. Experimental packages such as `designs/nexa` have separate build and typecheck scripts and remain outside the manifest until their release gate is complete.

## Local previews

Requires Node 20 or newer.

```bash
npm ci
npm run mock:api
npm run dev:basic
npm run dev:beauty
npm run dev:fashion
npm run dev:electronics
npm run dev:atelier
```

The preview API serves fictional, category-specific demo products selected by the storefront's `VITE_STORE_SLUG`. Generated demo imagery is in `scripts/mock-media/`. This is preview content only; deployed stores use the backend catalog API. Set `VITE_API_URL=http://127.0.0.1:8090` and `VITE_STORE_SLUG=<theme-key>` when opening a local theme app directly.

```bash
npm run gallery:capture
npm run quality
npm run build
npm run build:apps
```

The gallery capture produces six screenshots per theme under `apps/showroom/public/gallery/current/`. There are no hosted interactive demo URLs yet. Before production publication, build an isolated bundle for each theme with the backend's `scripts/verify-storefront-bundle.py`, commit the source, and update `STOREFRONT_RELEASE_REVISION` to that exact commit in a coordinated deployment.
# tgo-fron
