import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogSection, Product } from "../api/types";
import { normalizeProduct } from "../api/client";
import type { Customer } from "../api/client";
import { contactFromCustomer, fillMissingContact } from "../checkout/customer-contact";
import { findVariant, hasStock, initialSelection, orderedVariantDefinitions, productHasStock, productVariantOptions, salePrice, variantOptionAvailable } from "./components";
import { optimizedImageSrcSet, optimizedImageUrl, resolveImageUrl } from "../media/image";
import { contactFromOrder, createCheckoutService, mapOrder } from "../checkout/service";
import { checkoutFailureMessage } from "../checkout/errors";
import { ApiError } from "../api/client";
import { formatPrice, localeTag } from "../i18n";
import { applyCatalogFacets, buildCatalogFacets, filterAndSortProducts, isCatalogPath, productAttributeValues, productFacts, selectHomepageProducts, selectRelatedProducts } from "./catalog";

test("catalog system routes keep the full filter experience", () => {
  assert.equal(isCatalogPath("/products"), true);
  assert.equal(isCatalogPath("/collections"), true);
  assert.equal(isCatalogPath("/collections/all"), true);
  assert.equal(isCatalogPath("/collections/shoes"), true);
  assert.equal(isCatalogPath("/products/leather-sandal"), false);
  assert.equal(isCatalogPath("/about"), false);
});
import { storefrontAppearanceStyle } from "./Storefront";
import { buildStoreMenu } from "./navigation";
import { shippingCharge, themeFeatureSettings, type StoreConfig, type StorefrontHomepageSection } from "../config";

const section: CatalogSection = {
  id: 7,
  key: "specialty-food",
  label: "Specialty food",
  icon: "FaCookieBite:fa",
  sort_order: 1,
  attribute_defs: [
    { id: 1, key: "origin", label: "Origin", type: "select", level: "product", options: [{ value: "atlas", label: "Atlas Mountains" }], required: false, sort_order: 1 },
    { id: 2, key: "size", label: "Pack size", type: "select", level: "variant", options: [{ value: "small", label: "Small" }, { value: "large", label: "Large" }], required: true, sort_order: 2 },
    { id: 3, key: "organic", label: "Organic", type: "boolean", level: "product", options: [], required: false, sort_order: 3 },
  ],
};

function rawProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 41,
    section: section.id,
    ref: "FOOD-41",
    name: "Atlas Saffron",
    description: "Small-batch spice",
    price: "149.50" as unknown as number,
    promo: 10,
    loyalty_points: 12,
    rating: 4.8,
    reviews_count: 27,
    extra: { unit: "gram", weight: 20, expiry_date: "2027-12-01", organic: true, download_url: "https://private.example/file" },
    attributes: { origin: "atlas", organic: true },
    images: [],
    variants: [
      { id: 1, attributes: { size: "small" }, price: "149.50" as unknown as number, quantity: 5, reserved: 5, available_quantity: 0, extra: { sku: "SAF-S" } },
      { id: 2, attributes: { size: "large" }, price: "249.00" as unknown as number, quantity: 8, reserved: 1, available_quantity: 7, extra: { sku: "SAF-L", batch_number: "B-24" } },
    ],
    created_at: "2026-08-20T10:00:00Z",
    ...overrides,
  };
}

test("products without an inventory identity are never presented as purchasable", () => {
  assert.equal(hasStock([]), false);
  assert.equal(hasStock([{ ...rawProduct().variants[0], available_quantity: 0 }]), false);
  assert.equal(hasStock([{ ...rawProduct().variants[0], available_quantity: 1 }]), true);
  assert.equal(hasStock([{ ...rawProduct().variants[0], available_quantity: 0 }], false), true);
});

test("Cloudinary storefront images receive automatic format, quality, and responsive sizing", () => {
  const original = "https://res.cloudinary.com/demo/image/upload/v42/store/product.jpg";
  assert.equal(
    optimizedImageUrl(original, { width: 640 }),
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v42/store/product.jpg",
  );
  assert.match(optimizedImageSrcSet(original, [640, 320, 640]) ?? "", /w_320.*320w, .*w_640.*640w/);
  assert.equal(optimizedImageUrl("https://images.example.test/product.jpg", { width: 640 }), "https://images.example.test/product.jpg");
  assert.equal(resolveImageUrl("/media/product.jpg", "https://api.example.test"), "https://api.example.test/media/product.jpg");
});

test("simple products use product-level inventory without exposing a shopper variant", () => {
  const available = normalizeProduct(rawProduct({
    uses_variants: false,
    inventory: 3,
    variants: [{ id: 9, attributes: {}, price: null, quantity: 3, reserved: 0, available_quantity: 3, extra: {} }],
  }));
  const soldOut = normalizeProduct(rawProduct({
    uses_variants: false,
    inventory: 0,
    variants: [{ id: 10, attributes: {}, price: null, quantity: 3, reserved: 3, available_quantity: 0, extra: {} }],
  }));
  assert.equal(productHasStock(available), true);
  assert.equal(productHasStock(soldOut), false);
  assert.equal(productHasStock({ ...soldOut, track_inventory: false }), true);
});

test("API normalization preserves retail-specific product and variant data", () => {
  const product = normalizeProduct(rawProduct());
  assert.equal(product.price, 149.5);
  assert.equal(product.variants[1].price, 249);
  assert.equal(product.extra.expiry_date, "2027-12-01");
  assert.equal(product.variants[1].extra.batch_number, "B-24");
});

test("global appearance settings become shared storefront design tokens", () => {
  const config: StoreConfig = {
    storeName: "Design Lab",
    domain: "https://design-lab.example.test",
    contactEmail: "hello@example.test",
    currency: "MAD",
    appearance: {
      schema_version: 1,
      typography: { body_font: "humanist", heading_font: "editorial", base_size: "large", heading_scale: "large" },
      header: { layout: "logo_center", sticky: "none", width: "full", logo_size: "large", nav_alignment: "start", show_search: true, show_account: false, show_language: true, show_cart: true },
      style: { button_shape: "pill", card_shape: "soft", card_padding: "compact", card_alignment: "start", card_hover: "lift", content_width: "wide" },
      colors: { theme_primary: "#121212", theme_secondary: "#A67C32", theme_muted: "#E8D7AE", page: "#112233", header: "#F8FAFC", header_text: "#334455", navigation: "#223344", navigation_text: "#F8FAFC", menu_dropdown: "#EEDDCC", announcement: "", hero: "#445566", section: "", card: "#FFFFFF", discount_badge: "#FDE68A", discount_badge_text: "#422006", newsletter: "", footer: "#101010" },
      footer: { show_contact: true, show_social_links: false, copyright: { en: "Design Lab", fr: "", ar: "" } },
    },
  };

  const style = storefrontAppearanceStyle(config) as Record<string, string>;
  assert.match(style["--ds-font-display"], /Georgia/);
  assert.equal(style["--sf-base-size"], "17px");
  assert.equal(style["--sf-button-radius"], "9999px");
  assert.equal(style["--sf-card-radius"], "22px");
  assert.equal(style["--sf-content-width"], "1320px");
  assert.equal(style["--sf-card-padding"], "8px");
  assert.equal(style["--sf-card-align"], "start");
  assert.equal(style["--sf-card-hover-lift"], "-3px");
  assert.equal(style["--ds-r-lg"], "22px");
  assert.equal(style["--sf-bg-page"], "#112233");
  assert.equal(style["--sf-bg-page-ink"], "#ffffff");
  assert.equal(style["--sf-bg-theme_primary"], "#121212");
  assert.equal(style["--sf-bg-theme_secondary"], "#A67C32");
  assert.equal(style["--sf-bg-theme_muted"], "#E8D7AE");
  assert.equal(style["--sf-bg-header"], "#F8FAFC");
  assert.equal(style["--sf-bg-header-ink"], "#161616");
  assert.equal(style["--sf-header-ink"], "#334455");
  assert.equal(style["--sf-bg-navigation"], "#223344");
  assert.equal(style["--sf-navigation-ink"], "#F8FAFC");
  assert.equal(style["--sf-bg-menu_dropdown"], "#EEDDCC");
  assert.equal(style["--sf-bg-menu_dropdown-ink"], "#161616");
  assert.equal(style["--sf-bg-discount_badge"], "#FDE68A");
  assert.equal(style["--sf-discount-badge-ink"], "#422006");
  assert.equal(style["--sf-bg-card"], "#FFFFFF");
  assert.equal(style["--sf-bg-footer"], "#101010");
  assert.equal(style["--sf-bg-section"], "#F5F8F6");
});

test("theme palette keeps a coherent canvas while merchant brand controls the accent", () => {
  const config: StoreConfig = {
    storeName: "Brand Store",
    domain: "https://brand.example.test",
    contactEmail: "hello@example.test",
    currency: "MAD",
    palette: {
      brand: "#123456", brandDark: "#0D253E", brandDeep: "#081725", ink: "#091A2B",
      brandLight: "#7D91A2", brandLight1: "#DCE1E6", brandLight2: "#EEF1F3",
    },
  };
  const style = storefrontAppearanceStyle(config) as Record<string, string>;
  assert.equal(style["--sf-brand"], "#123456");
  assert.equal(style["--sf-bg-page"], "#FCFDFC");
  assert.equal(style["--sf-bg-section"], "#F5F8F6");
  assert.equal(style["--sf-bg-card"], "#FFFFFF");
  assert.equal(style["--sf-bg-footer"], "#111A15");
  assert.equal(style["--sf-bg-footer-ink"], "#FFFFFF");
  assert.equal(style["--ds-color-canvas"], "#FCFDFC");
});

test("premium themes keep their coherent default canvas while merchant brand controls the accent", () => {
  for (const design of ["fashion", "nexa"]) {
    const config: StoreConfig = {
      storeName: "Premium Store",
      domain: "https://premium.example.test",
      contactEmail: "hello@example.test",
      currency: "MAD",
      design,
      palette: {
        brand: "#2563EB", brandDark: "#1D4ED8", brandDeep: "#172554", ink: "#111827",
        brandLight: "#93C5FD", brandLight1: "#DBEAFE", brandLight2: "#EFF6FF",
      },
    };
    const style = storefrontAppearanceStyle(config) as Record<string, string>;
    const expectedCanvas = design === "fashion" ? "#FFFDF8" : "#FFFFFF";
    const expectedSection = design === "fashion" ? "#F7EFD9" : "#F6F9FD";
    assert.equal(style["--sf-bg-page"], expectedCanvas);
    assert.equal(style["--sf-bg-section"], expectedSection);
    assert.equal(style["--ds-color-canvas"], expectedCanvas);
    if (design === "fashion") {
      assert.equal(style["--sf-bg-newsletter"], "#24221F");
      assert.equal(style["--sf-bg-newsletter-ink"], "#FFFAF0");
    }
  }
});

test("each storefront family receives accessible navigation and discount defaults", () => {
  const expected = {
    basic: ["#FFFFFF", "#17211B", "#0F766E", "#FFFFFF"],
    beauty: ["#F7EEE8", "#493B36", "#8B3A55", "#FFFFFF"],
    fashion: ["#24221F", "#FAF8F4", "#C6A15B", "#17130B"],
    electronics: ["#0B1730", "#FFFFFF", "#1D4ED8", "#FFFFFF"],
    nexa: ["#070B14", "#FFFFFF", "#1264D8", "#FFFFFF"],
    atelier: ["#F3EEE5", "#1F1C18", "#6B4F35", "#FFFFFF"],
  } as const;
  for (const [design, colors] of Object.entries(expected)) {
    const style = storefrontAppearanceStyle({ storeName: design, domain: "https://example.test", contactEmail: "hello@example.test", currency: "MAD", design }) as Record<string, string>;
    assert.deepEqual([style["--sf-bg-navigation"], style["--sf-navigation-ink"], style["--sf-bg-discount_badge"], style["--sf-discount-badge-ink"]], colors);
  }
});

test("nexa replaces the legacy generic teal with its electronics blue default", () => {
  const style = storefrontAppearanceStyle({
    storeName: "NEXA Store",
    domain: "https://nexa.example.test",
    contactEmail: "hello@example.test",
    currency: "MAD",
    design: "nexa",
    palette: {
      brand: "#1F8A8C", brandDark: "#17696B", brandDeep: "#10494A", ink: "#102A2B",
      brandLight: "#72B9BA", brandLight1: "#D8EEEE", brandLight2: "#EFF7F7",
    },
  }) as Record<string, string>;
  assert.equal(style["--sf-brand"], "#1264D8");
  assert.equal(style["--ds-color-accent"], "#1264D8");
  assert.equal(style["--sf-bg-page"], "#FFFFFF");
  assert.equal(style["--ds-color-canvas"], "#FFFFFF");
  assert.equal(style["--sf-bg-header"], "#FFFFFF");
  assert.equal(style["--sf-bg-header-ink"], "#070B14");
});

test("merchant newsletter colors always receive a readable contrast token", () => {
  const config: StoreConfig = {
    storeName: "Fashion House",
    domain: "https://fashion.example.test",
    contactEmail: "hello@example.test",
    currency: "MAD",
    design: "fashion",
    palette: { brand: "#A67C2E", brandDark: "#725318", brandDeep: "#17120A", ink: "#11100D", brandLight: "#D8BD79", brandLight1: "#F3E7C9", brandLight2: "#FFFDF8" },
    appearance: {
      schema_version: 1,
      typography: { body_font: "system", heading_font: "editorial", base_size: "medium", heading_scale: "large" },
      header: { layout: "theme", sticky: "always", width: "contained", logo_size: "standard", nav_alignment: "center", show_search: true, show_account: true, show_language: true, show_cart: true },
      style: { button_shape: "square", card_shape: "square", content_width: "wide" },
      colors: { page: "", header: "", header_text: "", announcement: "", hero: "", section: "", card: "", newsletter: "#FFFDF8", footer: "" },
      footer: { show_contact: true, show_social_links: true, copyright: { en: "", fr: "", ar: "" } },
    },
  };
  const style = storefrontAppearanceStyle(config) as Record<string, string>;
  assert.equal(style["--sf-bg-newsletter"], "#FFFDF8");
  assert.equal(style["--sf-bg-newsletter-ink"], "#161616");
});

test("premium headers keep categories inside the Shop menu", () => {
  const config: StoreConfig = {
    storeName: "Fashion House",
    domain: "https://fashion.example.test",
    contactEmail: "hello@example.test",
    currency: "MAD",
    design: "fashion",
  };
  const menu = buildStoreMenu(config, [section], "en");
  assert.deepEqual(menu.map((item) => item.id), ["home", "shop"]);
  assert.equal(menu[1]?.children?.[0]?.id, `category-${section.id}`);
});

test("premium merchants can promote product categories to the header", () => {
  const config: StoreConfig = {
    storeName: "Fashion House", domain: "https://fashion.example.test", contactEmail: "hello@example.test", currency: "MAD", design: "fashion",
    appearance: {
      schema_version: 1,
      typography: { body_font: "system", heading_font: "editorial", base_size: "medium", heading_scale: "large" },
      header: { layout: "theme", sticky: "always", width: "contained", logo_size: "standard", nav_alignment: "center", show_search: true, show_account: true, show_language: true, show_cart: true, show_categories: true, show_about: true, show_contact: true },
      style: { button_shape: "square", card_shape: "square", content_width: "wide" },
      colors: { page: "", header: "", header_text: "", announcement: "", hero: "", section: "", card: "", newsletter: "", footer: "" },
      footer: { show_contact: true, show_social_links: true, copyright: { en: "", fr: "", ar: "" } },
    },
  };
  const menu = buildStoreMenu(config, [section], "en");
  assert.deepEqual(menu.map((item) => item.id), ["home", "shop", `category-${section.id}`]);
});

test("premium merchants can independently hide About and Contact header links", () => {
  const config: StoreConfig = {
    storeName: "Fashion House", domain: "https://fashion.example.test", contactEmail: "hello@example.test", currency: "MAD", design: "fashion",
    pages: {
      about: { type: "content", route: "about", title: { en: "About", fr: "À propos", ar: "من نحن" }, showInNavigation: true, sections: [], revision: 1 },
      contact: { type: "content", route: "contact", title: { en: "Contact", fr: "Contact", ar: "اتصل بنا" }, showInNavigation: true, sections: [], revision: 1 },
    },
    appearance: {
      schema_version: 1,
      typography: { body_font: "system", heading_font: "editorial", base_size: "medium", heading_scale: "large" },
      header: { layout: "theme", sticky: "always", width: "contained", logo_size: "standard", nav_alignment: "center", show_search: true, show_account: true, show_language: true, show_cart: true, show_about: false, show_contact: true },
      style: { button_shape: "square", card_shape: "square", content_width: "wide" },
      colors: { page: "", header: "", header_text: "", announcement: "", hero: "", section: "", card: "", newsletter: "", footer: "" },
      footer: { show_contact: true, show_social_links: true, copyright: { en: "", fr: "", ar: "" } },
    },
  };
  assert.deepEqual(buildStoreMenu(config, [section], "en").map((item) => item.id), ["home", "shop", "page-contact"]);
});

test("initial variant selection follows attribute level and skips unavailable stock", () => {
  const selection = initialSelection(normalizeProduct(rawProduct()), [section]);
  assert.deepEqual(selection, { size: "large" });
  assert.equal(findVariant(normalizeProduct(rawProduct()), selection)?.id, 2);
});

test("variant choices come from the product instead of every schema suggestion", () => {
  const product = normalizeProduct(rawProduct());
  const sizeDefinition = section.attribute_defs.find((definition) => definition.key === "size")!;
  assert.deepEqual(productVariantOptions(product, sizeDefinition), [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ]);
});

test("product-owned choices override category-level variant suggestions", () => {
  const product = normalizeProduct(rawProduct({
    uses_variants: true,
    variant_options: [
      { key: "color", label: "Finish", type: "color", values: ["Black", "White"] },
    ],
    variants: [
      { id: 10, attributes: { color: "Black" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
    ],
  }));
  const definitions = orderedVariantDefinitions(product, section);
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].key, "color");
  assert.deepEqual(definitions[0].options.map((option) => option.value), ["Black", "White"]);
});

test("enumerated text choices with arbitrary labels preselect and resolve the exact variant", () => {
  const product = normalizeProduct(rawProduct({
    uses_variants: true,
    variant_options: [{
      id: 91,
      key: "fragrance",
      label: "Fragrance",
      kind: "text",
      type: "text",
      presentation: "buttons",
      values: [
        { value: "lillian & lotus", label: "Lillian & Lotus" },
        { value: "orchid flower", label: "Orchid Flower" },
      ],
    }],
    variants: [
      { id: 10, attributes: { fragrance: "lillian & lotus" }, price: 30, quantity: 3, reserved: 0, available_quantity: 3, image: { id: 1, image: "/lotus.jpg", is_primary: false, order: 1 }, extra: {} },
      { id: 11, attributes: { fragrance: "orchid flower" }, price: 35, quantity: 2, reserved: 0, available_quantity: 2, image: { id: 2, image: "/orchid.jpg", is_primary: false, order: 2 }, extra: {} },
    ],
  }));

  const definitions = orderedVariantDefinitions(product, section);
  assert.deepEqual(definitions.map(({ key, label, type }) => ({ key, label, type })), [
    { key: "fragrance", label: "Fragrance", type: "text" },
  ]);
  assert.deepEqual(initialSelection(product, [section]), { fragrance: "lillian & lotus" });
  assert.equal(findVariant(product, { fragrance: "orchid flower" })?.id, 11);
  assert.equal(findVariant(product, { fragrance: "orchid flower" })?.image?.image, "/orchid.jpg");
});

test("product-owned choices do not disappear when section metadata is stale or unavailable", () => {
  const product = normalizeProduct(rawProduct({
    section: 999,
    uses_variants: true,
    variant_options: [{ key: "material", label: "Material", kind: "text", type: "text", values: ["Cotton", "Linen"] }],
    variants: [
      { id: 20, attributes: { material: "Cotton" }, price: null, quantity: 3, reserved: 0, available_quantity: 3, extra: {} },
      { id: 21, attributes: { material: "Linen" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
    ],
  }));

  assert.deepEqual(orderedVariantDefinitions(product).map((definition) => definition.key), ["material"]);
  assert.deepEqual(initialSelection(product, [section]), { material: "Cotton" });
  assert.equal(findVariant(product, initialSelection(product, [section]))?.id, 20);
});

test("custom text labels become enumerated facets without semantic key inference", () => {
  const product = normalizeProduct(rawProduct({
    variant_options: [{ key: "cover_style", label: "Cover style", kind: "text", type: "text", values: ["Plain", "Printed"] }],
    variants: [
      { id: 10, attributes: { cover_style: "Plain" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
      { id: 11, attributes: { cover_style: "Printed" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
    ],
  }));
  const facet = buildCatalogFacets([product], [section]).find((candidate) => candidate.key === "cover_style");
  assert.equal(facet?.label, "Cover style");
  assert.equal(facet?.type, "select");
  assert.deepEqual(facet?.options.map((option) => option.value), ["Plain", "Printed"]);
});

test("merchant-defined color swatches remain presentation metadata", () => {
  const product = normalizeProduct(rawProduct({
    uses_variants: true,
    variant_options: [{
      key: "color",
      label: "Finish",
      type: "color",
      values: [
        { value: "Ocean blue", label: "Ocean blue", swatch: "#0e7490" },
        { value: "Warm sand", label: "Warm sand", swatch: "#d6b98c" },
      ],
    }],
    variants: [
      { id: 10, attributes: { color: "Ocean blue" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
      { id: 11, attributes: { color: "Warm sand" }, price: null, quantity: 1, reserved: 0, available_quantity: 1, extra: {} },
    ],
  }));
  const definitions = orderedVariantDefinitions(product, section);

  assert.deepEqual(definitions[0].options, [
    { value: "Ocean blue", label: "Ocean blue", swatch: "#0e7490" },
    { value: "Warm sand", label: "Warm sand", swatch: "#d6b98c" },
  ]);
  assert.equal(findVariant(product, { color: "Ocean blue" })?.id, 10);
});

test("numeric sizes are exposed when those sizes exist on product variants", () => {
  const product = normalizeProduct(rawProduct({
    variants: [
      { id: 10, attributes: { shoe_size: 42 }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
      { id: 11, attributes: { shoe_size: 43 }, price: null, quantity: 0, reserved: 0, available_quantity: 0, extra: {} },
    ],
  }));
  const definition = { id: 9, key: "shoe_size", label: "Size", type: "number" as const, level: "variant" as const, options: [], required: true, sort_order: 1 };
  assert.deepEqual(productVariantOptions(product, definition).map((option) => option.value), ["42", "43"]);
});

test("colour is presented before size regardless of schema insertion order", () => {
  const clothingSection: CatalogSection = {
    ...section,
    attribute_defs: [
      { id: 20, key: "size", label: "Size", type: "select", level: "variant", options: [], required: true, sort_order: 1 },
      { id: 21, key: "color", label: "Colour", type: "color", level: "variant", options: [], required: true, sort_order: 8 },
    ],
  };
  const clothing = normalizeProduct(rawProduct({
    variants: [{ id: 30, attributes: { size: "M", color: "navy" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} }],
  }));
  assert.deepEqual(orderedVariantDefinitions(clothing, clothingSection).map((definition) => definition.key), ["color", "size"]);
});

test("a valid colour is not blocked by an incompatible size selected later in the picker", () => {
  const clothingSection: CatalogSection = {
    ...section,
    attribute_defs: [
      { id: 20, key: "size", label: "Size", type: "select", level: "variant", options: [], required: true, sort_order: 1 },
      { id: 21, key: "color", label: "Colour", type: "color", level: "variant", options: [], required: true, sort_order: 8 },
    ],
  };
  const clothing = normalizeProduct(rawProduct({
    variants: [
      { id: 30, attributes: { size: "S", color: "red" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
      { id: 31, attributes: { size: "M", color: "blue" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} },
    ],
  }));
  const definitions = orderedVariantDefinitions(clothing, clothingSection);
  assert.equal(variantOptionAvailable(clothing, definitions, 0, { color: "red", size: "S" }, "blue"), true);
  assert.equal(variantOptionAvailable(clothing, definitions, 1, { color: "blue" }, "S"), false);
  assert.equal(variantOptionAvailable(clothing, definitions, 1, { color: "blue" }, "M"), true);
});

test("White remains selectable when only White/M is stocked after Olive/XXL", () => {
  const clothingSection: CatalogSection = {
    ...section,
    attribute_defs: [
      { id: 20, key: "size", label: "Size", type: "text", level: "variant", options: [], required: true, sort_order: 2 },
      { id: 21, key: "color", label: "Colour", type: "color", level: "variant", options: [], required: true, sort_order: 3 },
    ],
  };
  const clothing = normalizeProduct(rawProduct({
    variants: [
      { id: 30, attributes: { size: "XXL", color: "Olive" }, price: null, quantity: 4, reserved: 0, available_quantity: 4, extra: {} },
      { id: 31, attributes: { size: "M", color: "White" }, price: null, quantity: 40, reserved: 0, available_quantity: 40, extra: {} },
    ],
  }));
  const definitions = orderedVariantDefinitions(clothing, clothingSection);

  assert.deepEqual(definitions.map((definition) => definition.key), ["color", "size"]);
  assert.equal(
    variantOptionAvailable(clothing, definitions, 0, { color: "Olive", size: "XXL" }, "White"),
    true,
  );
  assert.equal(variantOptionAvailable(clothing, definitions, 1, { color: "White" }, "M"), true);
});

test("Arabic storefront formatting keeps Latin digits", () => {
  assert.equal(localeTag("ar"), "ar-MA-u-nu-latn");
  assert.match(formatPrice(1234.5, "ar", "MAD"), /1[,.\s]?234/);
  assert.doesNotMatch(formatPrice(1234.5, "ar", "MAD"), /[٠-٩]/);
});

test("safe order tracking tolerates customer fields omitted by the API", () => {
  assert.deepEqual(contactFromOrder({}), {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    address: "",
  });
});

test("checkout uses the backend allocation and immutable charge breakdown", () => {
  const order = mapOrder({
    order_id: "order-1",
    amount: 120,
    subtotal: 100,
    shipping_amount: 20,
    discount_amount: 0,
    status: "pending",
    exception: true,
    payment_mode: "cod",
    is_paid: "cod",
    currency: "MAD",
    created_at: "2026-08-31T10:00:00Z",
    items: [{
      product_id: 41,
      variant_id: 2,
      ref: "FOOD-41",
      name: "Atlas Saffron",
      attributes: { size: "large" },
      quantity: 5,
      fulfilled_quantity: 2,
      price: 50,
    }],
  });

  assert.equal(order.lines[0].qty, 2);
  assert.equal(order.lines[0].requestedQty, 5);
  assert.deepEqual(order.totals, { subtotal: 100, discount: 0, shipping: 20, total: 120 });
  assert.equal(order.hasAdjustments, true);
});

test("checkout trusts the coupon snapshot and discounted total returned by the API", () => {
  const order = mapOrder({
    order_id: "order-coupon",
    amount: 95,
    subtotal: 100,
    shipping_amount: 5,
    discount_amount: 10,
    coupon_code: "WELCOME10",
    coupon_discount_type: "percentage",
    coupon_value: 10,
    status: "pending",
    exception: false,
    payment_mode: "cod",
    is_paid: "cod",
    currency: "MAD",
    created_at: "2026-09-07T10:00:00Z",
    items: [{
      product_id: 41,
      variant_id: null,
      ref: "FOOD-41",
      name: "Atlas Saffron",
      attributes: {},
      quantity: 1,
      fulfilled_quantity: 1,
      price: 100,
    }],
  });

  assert.deepEqual(order.totals, { subtotal: 100, discount: 10, shipping: 5, total: 95 });
  assert.equal(order.couponCode, "WELCOME10");
  assert.equal(order.lines[0].variantId, null);
});

test("order creation sends coupon, nullable variant, and the idempotency header", async () => {
  const originalFetch = globalThis.fetch;
  let captured: { headers: Headers; body: Record<string, unknown> } | null = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/auth/csrf/")) {
      return new Response(JSON.stringify({ csrfToken: "csrf-test" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/api/orders/")) {
      captured = {
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      };
      return new Response(JSON.stringify({
        order_id: "order-simple",
        amount: 90,
        subtotal: 100,
        shipping_amount: 0,
        discount_amount: 10,
        coupon_code: "SAVE10",
        coupon_discount_type: "fixed",
        coupon_value: 10,
        status: "pending",
        exception: false,
        payment_mode: "cod",
        is_paid: "cod",
        currency: "MAD",
        created_at: "2026-09-07T10:00:00Z",
        items: [{ product_id: 41, variant_id: null, ref: "FOOD-41", name: "Atlas Saffron", attributes: {}, quantity: 1, fulfilled_quantity: 1, price: 100 }],
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  try {
    await createCheckoutService().placeOrder({
      contact: { firstName: "A", lastName: "B", email: "a@example.com", phone: "+212600000000", city: "Rabat", address: "1 Main Street" },
      marketingConsent: true,
      method: "cod",
      lines: [{ id: 41, productId: 41, variantId: null, name: "Atlas Saffron", variant: "", qty: 1, unitPrice: 100 }],
      totals: { subtotal: 100, discount: 0, shipping: 0, total: 100 },
      currency: "MAD",
      locale: "en",
      couponCode: "SAVE10",
      idempotencyKey: "checkout-key-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(captured);
  assert.equal(captured.headers.get("Idempotency-Key"), "checkout-key-1");
  assert.equal(captured.body.coupon_code, "SAVE10");
  assert.deepEqual(captured.body.items, [{ product_id: 41, variant_id: null, quantity: 1 }]);
});

test("discount prices retain currency precision", () => {
  assert.equal(salePrice({ price: 149.5, promo: 10 }), 134.55);
  assert.equal(salePrice({ price: 120, compare_at_price: 150, promo: 0 }), 120);
});

test("catalog search includes category, product attributes, and retail-specific fields", () => {
  const product = normalizeProduct(rawProduct());
  assert.equal(filterAndSortProducts([product], [section], "Atlas Mountains gram", "featured").length, 1);
  assert.equal(filterAndSortProducts([product], [section], "electronics", "featured").length, 0);
});

test("variant-level attributes remain available to premium facets and comparisons", () => {
  const product = normalizeProduct(rawProduct());
  assert.deepEqual(productAttributeValues(product, "size"), ["small", "large"]);
  assert.deepEqual(productAttributeValues(product, "origin"), ["atlas"]);
});

test("catalog facets are generated only from declared values present in the catalog", () => {
  const first = normalizeProduct(rawProduct({ id: 1, attributes: { origin: "atlas", organic: true } }));
  const second = normalizeProduct(rawProduct({
    id: 2,
    attributes: { origin: "souss", organic: false },
    variants: [{ id: 3, attributes: { size: "small" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} }],
  }));
  const facets = buildCatalogFacets([first, second], [{
    ...section,
    attribute_defs: section.attribute_defs.map((definition) => definition.key === "origin"
      ? { ...definition, options: [...definition.options, { value: "souss", label: "Souss" }, { value: "unused", label: "Unused" }] }
      : definition),
  }]);

  assert.deepEqual(facets.map((facet) => facet.key), ["origin", "size", "organic"]);
  assert.deepEqual(facets.find((facet) => facet.key === "origin")?.options.map((option) => option.value), ["atlas", "souss"]);
  assert.equal(facets.some((facet) => facet.options.some((option) => option.value === "unused")), false);
});

test("catalog facet selections use OR within a field and AND between fields", () => {
  const atlasSmall = normalizeProduct(rawProduct({
    id: 1,
    attributes: { origin: "atlas", organic: true },
    variants: [{ id: 2, attributes: { size: "small" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} }],
  }));
  const soussLarge = normalizeProduct(rawProduct({
    id: 2,
    attributes: { origin: "souss", organic: false },
    variants: [{ id: 3, attributes: { size: "large" }, price: null, quantity: 2, reserved: 0, available_quantity: 2, extra: {} }],
  }));
  assert.deepEqual(
    applyCatalogFacets([atlasSmall, soussLarge], { origin: ["atlas", "souss"], size: ["large"] }).map((product) => product.id),
    [2],
  );
});

test("product facts use configured labels and never expose private delivery URLs", () => {
  const facts = productFacts(normalizeProduct(rawProduct()), section, 20);
  assert.ok(facts.some((fact) => fact.label === "Origin" && fact.value === "Atlas Mountains"));
  assert.ok(facts.some((fact) => fact.label === "Expiry Date" && fact.value === "2027-12-01"));
  assert.equal(facts.some((fact) => fact.key === "download_url"), false);
  assert.equal(facts.some((fact) => fact.key === "weight"), false);
});

test("catalog sorting uses effective promotional price and ratings", () => {
  const first = normalizeProduct(rawProduct());
  const second = normalizeProduct(rawProduct({ id: 42, name: "Lower price", price: 90, promo: 0, rating: 3.2, created_at: "2026-08-25T10:00:00Z" }));
  assert.deepEqual(filterAndSortProducts([first, second], [section], "", "price-low").map((item) => item.id), [42, 41]);
  assert.deepEqual(filterAndSortProducts([first, second], [section], "", "newest").map((item) => item.id), [42, 41]);
  assert.deepEqual(filterAndSortProducts([first, second], [section], "", "rating").map((item) => item.id), [41, 42]);
});

test("homepage selection honors explicit featured order and configured limit", () => {
  const products = [
    normalizeProduct(rawProduct({ id: 1, is_featured: true, merchandising_order: 2 })),
    normalizeProduct(rawProduct({ id: 2, is_featured: true, merchandising_order: 1 })),
    normalizeProduct(rawProduct({ id: 3, is_featured: false })),
    normalizeProduct(rawProduct({ id: 4, is_featured: true, merchandising_order: 3 })),
  ];
  assert.deepEqual(selectHomepageProducts(products, "featured", 4).map((item) => item.id), [2, 1, 4]);
});

test("empty homepage rules fall back to newest available products", () => {
  const older = normalizeProduct(rawProduct({ id: 1, promo: 0, created_at: "2026-08-20T10:00:00Z" }));
  const newer = normalizeProduct(rawProduct({ id: 2, promo: 0, created_at: "2026-08-25T10:00:00Z" }));
  assert.deepEqual(selectHomepageProducts([older, newer], "discounted", 4).map((item) => item.id), [2, 1]);
});

test("related products prefer the same category and shared merchant tags", () => {
  const current = normalizeProduct(rawProduct({ id: 1, extra: { tags: ["gift", "organic"] } }));
  const unrelated = normalizeProduct(rawProduct({ id: 2, section: 99, rating: 5, extra: { tags: ["other"] } }));
  const tagged = normalizeProduct(rawProduct({ id: 3, section: 99, rating: 2, extra: { tags: ["gift"] } }));
  const sameCategory = normalizeProduct(rawProduct({ id: 4, section: current.section, rating: 1, extra: {} }));
  assert.deepEqual(selectRelatedProducts([current, unrelated, tagged, sameCategory], current, 3).map((item) => item.id), [4, 3, 2]);
});

test("merchant-selected related products take precedence over inferred matches", () => {
  const current = normalizeProduct(rawProduct({ id: 1, related_product_ids: [2] }));
  const selected = normalizeProduct(rawProduct({ id: 2, section: 99, rating: 1 }));
  const inferred = normalizeProduct(rawProduct({ id: 3, section: current.section, rating: 5 }));
  assert.deepEqual(selectRelatedProducts([current, inferred, selected], current, 2).map((item) => item.id), [2, 3]);
});

const customer: Customer = {
  id: 12,
  email: "amina@example.com",
  firstName: "Amina",
  lastName: "Bennani",
  phone: "+212612345678",
  phoneVerified: false,
  emailVerified: true,
  address: "18 Rue des Fleurs",
  city: "Casablanca",
  country: "MA",
  preferredLanguage: "fr",
  loyaltyPoints: 20,
  createdAt: "2026-08-28T10:00:00Z",
};

test("authenticated checkout starts with the customer's saved contact and delivery details", () => {
  assert.deepEqual(contactFromCustomer(customer), {
    firstName: "Amina",
    lastName: "Bennani",
    email: "amina@example.com",
    phone: "+212612345678",
    address: "18 Rue des Fleurs",
    city: "Casablanca",
  });
});

test("late session hydration never overwrites delivery details already entered at checkout", () => {
  assert.deepEqual(fillMissingContact({
    firstName: "",
    lastName: "Recipient",
    email: "",
    phone: "",
    address: "A different delivery address",
    city: "Rabat",
  }, customer), {
    firstName: "Amina",
    lastName: "Recipient",
    email: "amina@example.com",
    phone: "+212612345678",
    address: "A different delivery address",
    city: "Rabat",
  });
});

test("required variant choices cannot silently fall back to the first available SKU", () => {
  const product = normalizeProduct(rawProduct({ uses_variants: true, variants: [
    { id: 20, attributes: { color: "Black", size: "S" }, price: 100, quantity: 5, reserved: 0, available_quantity: 5, extra: {} },
    { id: 21, attributes: { color: "Black", size: "M" }, price: 100, quantity: 5, reserved: 0, available_quantity: 5, extra: {} },
  ] }));
  assert.equal(findVariant(product, {}), undefined);
  assert.equal(findVariant(product, { color: "Black" }), undefined);
  assert.equal(findVariant(product, { color: "Black", size: "" }), undefined);
  assert.equal(findVariant(product, { color: "Black", size: "M" })?.id, 21);
});

test("flat shipping remains payable when no free-delivery threshold is configured", () => {
  const config: StoreConfig = { storeName: "Shop", domain: "example.test", contactEmail: "", currency: "MAD", shippingFee: 30 };
  assert.equal(shippingCharge(config, 100), 30);
  assert.equal(shippingCharge({ ...config, freeShippingThreshold: null }, 100), 30);
  assert.equal(shippingCharge({ ...config, shippingFee: 0 }, 100), 0);
  assert.equal(shippingCharge({ ...config, freeShippingThreshold: 200 }, 100), 30);
  assert.equal(shippingCharge({ ...config, freeShippingThreshold: 200 }, 200), 30);
  assert.equal(shippingCharge({ ...config, freeShippingThreshold: 200 }, 200.01), 0);
});

test("checkout preserves specific validation errors instead of claiming stock changed", () => {
  assert.equal(
    checkoutFailureMessage(new ApiError("Tax rate is missing for Lamp.", 400), "en"),
    "Tax rate is missing for Lamp.",
  );
  assert.equal(
    checkoutFailureMessage(new ApiError("API 400 /api/orders/quote/", 400, "coupon_code", { coupon_code: ["Coupon expired."] }), "en"),
    "Coupon expired.",
  );
  assert.equal(
    checkoutFailureMessage(new ApiError("API 409 /api/orders/", 409), "en"),
    "Availability changed while you were checking out. Reopen the product, choose an available combination, and try again.",
  );
});

test("theme feature blocks render only for their active supported design", () => {
  const feature: StorefrontHomepageSection = {
    id: "feature-1",
    type: "theme_feature",
    enabled: true,
    settings: {
      kind: "fashion",
      limit: 40,
      title: { en: "The edit", fr: "La sélection", ar: "المختارات" },
      body: { en: "Seasonal pieces", fr: "Pièces de saison", ar: "قطع موسمية" },
    },
  };
  assert.deepEqual(themeFeatureSettings(feature, "fashion"), {
    kind: "fashion",
    limit: 8,
    title: { en: "The edit", fr: "La sélection", ar: "المختارات" },
    body: { en: "Seasonal pieces", fr: "Pièces de saison", ar: "قطع موسمية" },
  });
  assert.equal(themeFeatureSettings(feature, "beauty"), null);
  assert.equal(themeFeatureSettings({ ...feature, enabled: false }, "fashion"), null);
  assert.equal(themeFeatureSettings({ ...feature, settings: { ...feature.settings, kind: "unknown" } }, "unknown"), null);
});

test("theme feature blocks apply safe defaults to incomplete persisted settings", () => {
  const feature: StorefrontHomepageSection = {
    id: "feature-2",
    type: "theme_feature",
    enabled: true,
    settings: { kind: "atelier", limit: "invalid", title: { en: "Objects" } as never },
  };
  assert.deepEqual(themeFeatureSettings(feature, "atelier"), {
    kind: "atelier",
    limit: 4,
    title: { en: "Objects", fr: "", ar: "" },
    body: { en: "", fr: "", ar: "" },
  });
});
