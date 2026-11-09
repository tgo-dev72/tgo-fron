/** Shared design types + accent palette for the design catalog. */

export interface ConfigField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface Design {
  key: string;
  name: string;
  tagline: string;
  description: string;
  screenshots: string[];
  demo_url: string | null;
  preview_available?: boolean;
  demo_store_slug?: string | null;
  presets?: { key: string; name: string; description: string; accent: string; surface: string }[];
  dev_port?: number;
  config_schema: ConfigField[];
  tier?: "standard" | "premium";
  features?: string[];
  feature_maturity?: Record<string, "production" | "beta" | "prototype">;
  family: string;
  business_need: string;
  best_for: string[];
  journey: string[];
  business_outcomes: string[];
  status: "ready" | "building";
}

export interface Manifest {
  version: number;
  designs: Design[];
}

/** Accent color per design key — used for cards, meta and the wizard pills. */
export const ACCENTS: Record<string, string> = {
  basic: "#287a52",
  beauty: "#8b5c55",
  fashion: "#a67c2e",
  electronics: "#1957d2",
  nexa: "#a67c2e",
};

/** Release gate for the current storefront families. An older API manifest
 * must never put retired templates back into creation or redesign. */
export const CURRENT_DESIGN_KEYS = new Set(["basic", "beauty", "fashion", "electronics", "nexa"]);

export function isCurrentDesignKey(key: string): boolean {
  return CURRENT_DESIGN_KEYS.has(key);
}

export function currentDesigns<T extends { key: string }>(designs: T[]): T[] {
  return designs.filter((design) => isCurrentDesignKey(design.key));
}

export const DEFAULT_ACCENT = "#6366f1";

export function getAccent(key: string): string {
  return ACCENTS[key] || DEFAULT_ACCENT;
}

export function isPremium(design: Design): boolean {
  return design.tier === "premium";
}

export function isReady(design: Design): boolean {
  return design.status === "ready";
}

export const FEATURE_INFO: Record<string, { label: string; description: string }> = {
  accountDashboard: { label: "Account workspace", description: "A dedicated customer area exposing only the capabilities enabled by the design." },
  bundles: { label: "Bundle builder", description: "Customers can choose a coordinated set of products and add it to the cart in one step." },
  compare: { label: "Product comparison", description: "Side-by-side prices, ratings, availability, and catalog-defined specifications." },
  expressCheckout: { label: "Direct buy now", description: "Adds the selected product and opens the real checkout flow immediately." },
  facetedSearch: { label: "Attribute filters", description: "Filters are generated from each retail catalog's configured product attributes." },
  infiniteScroll: { label: "Progressive catalog", description: "Large catalogs load in controlled batches without overwhelming the page." },
  instantSearch: { label: "Instant product search", description: "Live name and reference search opens matching products in quick view." },
  lookbook: { label: "Shoppable lookbook", description: "Editorial product imagery includes hotspots that open real catalog products." },
  quickView: { label: "Quick view", description: "Inspect variants, stock, pricing, and add to cart without leaving the listing." },
  quoteBuilder: { label: "Quote builder", description: "Business buyers assemble quantities and generate a reviewable quote summary." },
  recommendations: { label: "Catalog-aware picks", description: "Recommendations use viewed categories, ratings, and review counts from the live catalog." },
  savedAddresses: { label: "Saved buyer details", description: "Shipping details persist locally in this browser for the storefront." },
  socialProof: { label: "Customer rating highlights", description: "Shows only rating and review-count data supplied by the live catalog, without claiming verified purchases." },
  tieredPricing: { label: "Tier pricing tables", description: "Concrete per-product unit prices are calculated for increasing quantities." },
  wishlist: { label: "Wishlist", description: "Customers can save catalog products and revisit them from their account workspace." },
};

export function featureLabel(key: string): string {
  return FEATURE_INFO[key]?.label ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function featureDescription(key: string): string {
  return FEATURE_INFO[key]?.description ?? "A family-specific capability connected to the live store catalog.";
}
