import type { CatalogSection, Product } from "../api/types";

export type CatalogSort = "featured" | "newest" | "price-low" | "price-high" | "rating";

/** Routes that represent the browsable catalog rather than a CMS page or PDP. */
export function isCatalogPath(pathname: string): boolean {
  return pathname === "/products" || pathname === "/collections" || pathname.startsWith("/collections/");
}
export type HomepageProductSource = "featured" | "newest" | "discounted" | "top_rated";

export interface ProductFact {
  key: string;
  label: string;
  value: string;
}

export interface CatalogFacetOption {
  value: string;
  label: string;
  count: number;
  swatch?: string;
}

export interface CatalogFacet {
  key: string;
  label: string;
  type: "select" | "multi" | "color" | "boolean";
  options: CatalogFacetOption[];
  sortOrder: number;
}

export type CatalogFacetSelection = Record<string, string[]>;

const HIDDEN_EXTRA_KEYS = new Set([
  "download_url",
  "meta_title",
  "meta_description",
  "seo_title",
  "seo_description",
]);
const HIDDEN_FACT_KEYS = new Set([
  ...HIDDEN_EXTRA_KEYS,
  "sku",
  "barcode",
  "batch_number",
  // Fulfilment inputs belong to shipping/rate calculations. A sellable weight
  // (for example 500 g vs 1 kg) remains visible as a real variant attribute.
  "weight",
  "weight_unit",
  "length",
  "width",
  "height",
  "dimension_unit",
]);

function words(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(" · ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "string") return String(value).trim();
  return "";
}

function optionLabel(section: CatalogSection | undefined, key: string, value: string): string {
  const definition = section?.attribute_defs.find((item) => item.key === key);
  return definition?.options.find((option) => option.value === value)?.label ?? value;
}

export function productAttributeValues(product: Product, key: string): string[] {
  const rawValues: unknown[] = [product.attributes?.[key], ...product.variants.map((variant) => variant.attributes?.[key])];
  const values = rawValues.flatMap((value) => Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);
  return [...new Set(values.map(textValue).filter(Boolean))];
}

function facetValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "string") return String(value).trim();
  return "";
}

function productFacetValues(product: Product, key: string): string[] {
  const values: unknown[] = [product.attributes?.[key], ...product.variants.map((variant) => variant.attributes?.[key])];
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map(facetValue).filter(Boolean))];
}

/** Build filters only from declared retail attributes and values that really
 * exist in the currently browsed products. Free text, dates and numeric data
 * need range-aware controls and therefore do not become misleading checkboxes. */
export function buildCatalogFacets(products: Product[], sections: CatalogSection[], limit = 8): CatalogFacet[] {
  const sectionIds = new Set(products.map((product) => product.section));
  const definitions = new Map<string, {
    key: string;
    label: string;
    type: CatalogFacet["type"];
    sortOrder: number;
    optionLabels: Map<string, { label: string; swatch?: string }>;
  }>();

  sections.filter((section) => sectionIds.has(section.id)).forEach((section) => {
    section.attribute_defs.forEach((definition) => {
      if (!["select", "multi", "color", "boolean"].includes(definition.type)) return;
      const existing = definitions.get(definition.key);
      const optionLabels = existing?.optionLabels ?? new Map<string, { label: string; swatch?: string }>();
      definition.options.forEach((option) => optionLabels.set(String(option.value), { label: option.label, swatch: option.swatch }));
      definitions.set(definition.key, {
        key: definition.key,
        label: existing?.label ?? definition.label,
        type: (existing?.type ?? definition.type) as CatalogFacet["type"],
        sortOrder: Math.min(existing?.sortOrder ?? definition.sort_order, definition.sort_order),
        optionLabels,
      });
    });
  });

  products.forEach((product) => {
    product.variant_options?.forEach((option, optionIndex) => {
      // A product-owned text option is an enumerated SKU choice, not free
      // customer input, so it is safe to expose as a select-style facet.
      if (!['select', 'color', 'text'].includes(option.type)) return;
      const existing = definitions.get(option.key);
      const optionLabels = existing?.optionLabels ?? new Map<string, { label: string; swatch?: string }>();
      option.values.forEach((candidate) => {
        const value = typeof candidate === "string" ? candidate : candidate.value;
        const label = typeof candidate === "string" ? candidate : candidate.label || candidate.value;
        const swatch = typeof candidate === "string" ? undefined : candidate.swatch;
        optionLabels.set(value, { label, swatch });
      });
      definitions.set(option.key, {
        key: option.key,
        label: existing?.label ?? option.label,
        type: (existing?.type ?? (option.type === "text" ? "select" : option.type)) as CatalogFacet["type"],
        sortOrder: Math.min(existing?.sortOrder ?? optionIndex, optionIndex),
        optionLabels,
      });
    });
  });

  return [...definitions.values()]
    .map((definition): CatalogFacet | null => {
      const counts = new Map<string, number>();
      products.forEach((product) => productFacetValues(product, definition.key).forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }));
      if (counts.size === 0 || (counts.size === 1 && definition.type !== "boolean")) return null;
      const options = [...counts.entries()].map(([value, count]) => {
        const configured = definition.optionLabels.get(value);
        return {
          value,
          label: configured?.label ?? value,
          count,
          ...(configured?.swatch ? { swatch: configured.swatch } : {}),
        };
      }).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
      return { key: definition.key, label: definition.label, type: definition.type, options, sortOrder: definition.sortOrder };
    })
    .filter((facet): facet is CatalogFacet => facet !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
    .slice(0, Math.max(1, Math.min(12, Math.trunc(limit) || 8)));
}

/** OR within one filter (red or blue), AND between filters (colour and size). */
export function applyCatalogFacets(products: Product[], selection: CatalogFacetSelection): Product[] {
  const active = Object.entries(selection).filter(([, values]) => values.length > 0);
  if (active.length === 0) return products;
  return products.filter((product) => active.every(([key, selected]) => {
    const values = productFacetValues(product, key);
    return selected.some((value) => values.includes(value));
  }));
}

export function productSearchText(product: Product, section?: CatalogSection): string {
  const attributeTerms = Object.entries(product.attributes ?? {}).flatMap(([key, raw]) => {
    const values = Array.isArray(raw) ? raw : [raw];
    return values.flatMap((value) => [value, optionLabel(section, key, textValue(value))]);
  });
  const variantTerms = product.variants.flatMap((variant) => Object.entries(variant.attributes ?? {}).flatMap(([key, raw]) => {
    const values = Array.isArray(raw) ? raw : [raw];
    return values.flatMap((value) => [value, optionLabel(section, key, textValue(value))]);
  }));
  const values: unknown[] = [
    product.name,
    product.ref,
    product.description,
    section?.label,
    ...(product.categories ?? []).map((category) => category.label),
    ...(product.tags ?? []),
    ...(product.vendors ?? []).map((vendor) => vendor.name),
    ...attributeTerms,
    ...variantTerms,
    ...Object.entries(product.extra ?? {})
      .filter(([key]) => !HIDDEN_EXTRA_KEYS.has(key))
      .map(([, value]) => value),
  ];
  return values.flatMap((value) => Array.isArray(value) ? value : [value]).map(textValue).join(" ").toLocaleLowerCase();
}

export function filterAndSortProducts(
  products: Product[],
  sections: CatalogSection[],
  query: string,
  sort: CatalogSort,
): Product[] {
  const effectivePrice = (product: Product) => product.compare_at_price != null && product.compare_at_price > product.price
    ? product.price
    : product.price * (1 - product.promo / 100);
  const discount = (product: Product) => product.compare_at_price != null && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : product.promo;
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = terms.length === 0
    ? [...products]
    : products.filter((product) => {
      const haystack = productSearchText(product, sectionById.get(product.section));
      return terms.every((term) => haystack.includes(term));
    });

  return filtered.sort((left, right) => {
    if (sort === "newest") return Date.parse(right.created_at) - Date.parse(left.created_at);
    if (sort === "price-low") return effectivePrice(left) - effectivePrice(right);
    if (sort === "price-high") return effectivePrice(right) - effectivePrice(left);
    if (sort === "rating") return right.rating - left.rating || right.reviews_count - left.reviews_count;
    return Number(right.is_featured) - Number(left.is_featured)
      || (left.merchandising_order ?? 0) - (right.merchandising_order ?? 0)
      || Number(discount(right) > 0) - Number(discount(left) > 0)
      || right.rating - left.rating
      || Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}

/** Apply the merchant's deterministic homepage merchandising rule.
 * Empty rule results fall back to newest catalog items instead of a blank home page. */
export interface MerchandisableProduct {
  is_featured?: boolean;
  merchandising_order?: number;
  created_at: string;
  price: number;
  compare_at_price?: number | null;
  promo: number | null;
  reviews_count: number;
  rating: number;
}

/** Shared selection for public storefront and merchant draft preview. */
export function selectHomepageProducts<T extends MerchandisableProduct>(
  products: T[],
  source: HomepageProductSource = "featured",
  limit = 8,
): T[] {
  const safeLimit = Math.max(1, Math.min(24, Math.trunc(limit) || 8));
  const newest = (items: T[]) => [...items].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
  let selected: T[] = [];
  if (source === "featured") {
    selected = products
      .filter((product) => product.is_featured)
      .sort((left, right) => (left.merchandising_order ?? 0) - (right.merchandising_order ?? 0)
        || Date.parse(right.created_at) - Date.parse(left.created_at));
  } else if (source === "discounted") {
    const discount = (product: T) => product.compare_at_price != null && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : product.promo ?? 0;
    selected = [...products]
      .filter((product) => discount(product) > 0)
      .sort((left, right) => discount(right) - discount(left) || Date.parse(right.created_at) - Date.parse(left.created_at));
  } else if (source === "top_rated") {
    selected = [...products]
      .filter((product) => product.reviews_count > 0)
      .sort((left, right) => right.rating - left.rating || right.reviews_count - left.reviews_count);
  } else {
    selected = newest(products);
  }
  return (selected.length > 0 ? selected : newest(products)).slice(0, safeLimit);
}

function productTags(product: Product): Set<string> {
  const value = product.tags?.length ? product.tags : product.extra?.tags;
  const tags = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return new Set(tags.map((tag) => String(tag).trim().toLocaleLowerCase()).filter(Boolean));
}

/** Deterministic, catalog-backed related products. Same-category products are
 * preferred, then shared merchant tags, merchandising priority, rating and
 * recency. No behavioral profiling or unsupported "AI" claim is involved. */
export function selectRelatedProducts(products: Product[], current: Product, limit = 4): Product[] {
  const currentTags = productTags(current);
  const safeLimit = Math.max(1, Math.min(8, Math.trunc(limit) || 4));
  const explicitIds = new Set(current.related_product_ids ?? []);
  const explicit = products.filter((product) => explicitIds.has(product.id) && product.id !== current.id);
  const inferred = products
    .filter((product) => product.id !== current.id)
    .filter((product) => !explicitIds.has(product.id))
    .map((product) => {
      const sharedTags = [...productTags(product)].filter((tag) => currentTags.has(tag)).length;
      const score = Number(product.section === current.section) * 1000
        + sharedTags * 100
        + Number(product.is_featured) * 20
        + Math.max(0, Math.min(5, product.rating));
      return { product, score };
    })
    .sort((left, right) => right.score - left.score
      || (left.product.merchandising_order ?? 0) - (right.product.merchandising_order ?? 0)
      || right.product.reviews_count - left.product.reviews_count
      || Date.parse(right.product.created_at) - Date.parse(left.product.created_at))
    .map(({ product }) => product);
  return [...explicit, ...inferred].slice(0, safeLimit);
}

export function productFacts(product: Product, section?: CatalogSection, limit = 8): ProductFact[] {
  const facts: ProductFact[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string, rawValue: unknown) => {
    if (seen.has(key)) return;
    const raw = textValue(rawValue);
    if (!raw) return;
    const values = Array.isArray(rawValue) ? rawValue.map(textValue) : [raw];
    facts.push({ key, label, value: values.map((value) => optionLabel(section, key, value)).join(" · ") });
    seen.add(key);
  };

  for (const definition of section?.attribute_defs ?? []) {
    if (definition.level === "variant") continue;
    add(definition.key, definition.label, product.attributes?.[definition.key]);
  }
  for (const [key, value] of Object.entries(product.attributes ?? {})) {
    add(key, section?.attribute_defs.find((item) => item.key === key)?.label ?? words(key), value);
  }
  for (const [key, value] of Object.entries(product.extra ?? {})) {
    if (HIDDEN_FACT_KEYS.has(key) || key === "tags") continue;
    add(key, words(key), value);
  }
  return facts.slice(0, limit);
}
