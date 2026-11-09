# Storefront design standard

This document is the acceptance contract for every storefront design in this
repository. A design may change composition, typography, motion and visual
language, but it must not weaken the shared commerce experience.

## Shared baseline

All standard and premium designs must inherit the shared storefront core and
support the following real merchant data:

- Store identity: merchant name, logo, favicon, brand colours, support email,
  phone, WhatsApp and social links.
- Catalog: retail-type sections, product attributes, cover and gallery images,
  real prices, merchant-defined promotions, stock and variants.
- Discovery: catalog search with product suggestions, sorting, retail-schema
  filters, deterministic related products and merchant-controlled homepage
  product selection.
- Product purchase: dedicated and merchant-composable product page, image
  gallery, colour-before-size selection when those attributes exist,
  unavailable-combination prevention, quantity selection and stock-aware cart
  actions.
- Content: merchant-defined home, catalog, about, contact, FAQ, shipping,
  returns, payments, privacy and terms pages, with draft and publish states.
- Customer journey: cart, authenticated checkout prefill, guest checkout,
  newsletter consent, customer sign-up, email verification, profile, orders
  and order tracking.
- International experience: English, French and Arabic, correct RTL layout,
  readable Arabic line height and Latin digits for commercial values.
- Quality: responsive layout, keyboard-visible focus, useful empty/loading/error
  states, reduced-motion compatibility and no exposure of infrastructure terms.

## Truthful merchandising rules

- Never invent discounts, reviews, stock urgency, delivery promises, products
  or testimonials. A component is hidden when its backing value is absent.
- Related products use catalog category, merchant tags, merchandising order,
  rating and recency. They are deterministic and must not be presented as AI.
- A product with several variants is never quick-added using an arbitrary
  variant. The customer must choose a valid combination first.
- Fulfilment-only data such as package weight and dimensions is not shown as a
  customer benefit unless the retail model explicitly makes it a sellable
  attribute.

## Business-family positioning

The baseline commerce contract is not a premium feature. A family exists only
when it answers a declared merchant and customer need across the complete
journey. Color, typography, spacing and decoration are presets, not families.
Premium families earn their distinction through meaningful presentation and
selling tools, for example advanced editorial layouts, comparison, bundles,
quote requests, wishlist or loyalty experiences. Premium status must never
mean that Basic has broken product selection, accessibility or checkout.

## Customisation boundary

Merchant changes are data, not source-code edits. The dashboard owns content,
visibility, ordering and supported settings; the storefront renders the
published configuration. Each new configurable block must define:

1. a stable type and versioned settings schema;
2. validation and safe defaults in the backend;
3. editing controls with non-technical language in the dashboard;
4. a responsive renderer and fallback state in the shared storefront core;
5. automated contract tests before it is available to merchants.

## Acceptance gates

Before a design or shared-core change is accepted, run:

```bash
npm run validate:manifest
npm run validate:design-quality
npm run test:storefront-core
npm run typecheck
npm run build
```

The version 2 manifest contains five released business families. Only entries marked
`ready` are selectable or deployable; building entries stay visible as an
honest roadmap. Every gate above applies before a family becomes ready.

## Next capability slices

The highest-value remaining work is a versioned page/block system beyond the
current content and commerce blocks, followed by nested navigation, numeric
range filters, richer collection merchandising and design-preview deployments.
These should extend the same contract rather than fork commerce logic per
template.
