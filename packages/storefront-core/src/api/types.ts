/**
 * Backend contract — mirrors the store-platform catalog API
 * (GET /api/catalog/sections/, GET /api/catalog/products/, stock endpoint).
 * A design renders exactly what these endpoints return; it never hardcodes
 * a vertical or a fixed set of fields.
 */

export type AttributeType = "select" | "multi" | "color" | "text" | "number" | "boolean" | "date";
export type AttributeLevel = "product" | "variant";

/** A selectable attribute option: `value` is the canonical key, `label` is localized per request. */
export interface AttributeOption {
  value: string;
  label: string;
  swatch?: string;
}

export interface AttributeDef {
  id: number;
  key: string;
  label: string;
  type: AttributeType;
  level: AttributeLevel;
  options: AttributeOption[];
  required: boolean;
  sort_order: number;
}

export interface CatalogSection {
  id: number;
  key: string;
  label: string;
  label_translations?: Partial<Record<"en" | "fr" | "ar", string>>;
  description?: string;
  thumbnail?: string;
  is_visible?: boolean;
  parent?: number | null;
  sort_mode?: "manual" | "newest" | "price_asc" | "price_desc" | "name_asc";
  icon: string;
  sort_order: number;
  attribute_defs: AttributeDef[];
}

export interface Variant {
  id: number;
  attributes: Record<string, string | string[] | number>;
  price: number | null;
  compare_at_price?: number | null;
  effective_price?: number;
  effective_compare_at_price?: number | null;
  is_active?: boolean;
  sku?: string;
  barcode?: string;
  weight?: number | null;
  image?: ProductImage | null;
  quantity: number;
  reserved: number;
  available_quantity: number;
  extra: Record<string, unknown>;
}

export interface ProductImage {
  id: number;
  image: string;
  media_type?: "image" | "external_video";
  external_url?: string;
  alt_text?: string;
  is_primary: boolean;
  order: number;
}

export interface ProductVariantOption {
  id?: number;
  key: string;
  label: string;
  kind?: "color" | "size_numeric" | "size_alpha" | "text";
  type: "select" | "color" | "text";
  presentation?: "swatches" | "buttons" | "dropdown";
  values: Array<string | { value: string; label: string; swatch?: string }>;
}

export interface Product {
  id: number;
  section: number;
  categories?: CatalogSection[];
  slug?: string;
  ref: string;
  name: string;
  description: string;
  seo_title?: string;
  seo_description?: string;
  tags?: string[];
  vendors?: Array<{ id: number; name: string; slug: string }>;
  related_product_ids?: number[];
  price: number;
  compare_at_price?: number | null;
  promo: number;
  loyalty_points: number;
  rating: number;
  reviews_count: number;
  is_featured?: boolean;
  uses_variants?: boolean;
  show_related_products?: boolean;
  track_inventory?: boolean;
  /** Available sellable quantity aggregated by the API. Null means stock is not tracked. */
  inventory?: number | null;
  inventory_ready?: boolean;
  merchandising_order?: number;
  extra: Record<string, unknown>;
  attributes: Record<string, unknown>;
  variant_options?: ProductVariantOption[];
  images: ProductImage[];
  variants: Variant[];
  created_at: string;
}

/** Section key as given by GET /api/catalog/sections/ */
export type SectionKey = string;
