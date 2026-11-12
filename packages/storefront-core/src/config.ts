import type { StoreMenuItem, HeaderPreset } from "./storefront/navigation";
import type { Locale } from "./i18n";
import { api } from "./api/client";

/**
 * Per-store configuration contract — loaded at RUNTIME from the platform's
 * /api/storefront/config/ endpoint (Option A). The generic storefront app
 * fetches this on boot; the same static bundle renders any store with zero
 * per-store env vars or build steps.
 */

/** Full brand palette derived by the factory from a single brand hex. */
export interface StorePalette {
  brand: string;
  brandDark: string;
  brandDeep: string;
  ink: string;
  brandLight: string;
  brandLight1: string;
  brandLight2: string;
}

export type StorefrontContentLocale = "en" | "fr" | "ar";
export type LocalizedStorefrontText = Record<StorefrontContentLocale, string>;
export type StorefrontHomepageSectionType = "announcement" | "hero" | "slideshow" | "promotional_banner" | "collections" | "products" | "image_text" | "newsletter" | "theme_feature" | "product_main" | "product_assurances" | "related_products";

export interface StorefrontSlide {
  id: string;
  title: LocalizedStorefrontText;
  body: LocalizedStorefrontText;
  cta_label: LocalizedStorefrontText;
  alt: LocalizedStorefrontText;
  cta_url: string;
  image_url: string;
  mobile_image_url: string;
}

export interface StorefrontAnnouncementItem {
  id: string;
  text: LocalizedStorefrontText;
  link_label: LocalizedStorefrontText;
  link_url: string;
}

export interface StorefrontHomepageSection {
  id: string;
  type: StorefrontHomepageSectionType;
  enabled: boolean;
  settings: Record<string, LocalizedStorefrontText | StorefrontSlide[] | StorefrontAnnouncementItem[] | string | number | boolean>;
}

export const THEME_FEATURE_DESIGNS = ["beauty", "fashion", "electronics", "atelier", "nexa"] as const;
export type ThemeFeatureDesign = (typeof THEME_FEATURE_DESIGNS)[number];

export interface ThemeFeatureSettings {
  kind: ThemeFeatureDesign;
  limit: number;
  title: LocalizedStorefrontText;
  body: LocalizedStorefrontText;
}

function localizedThemeFeatureText(value: unknown): LocalizedStorefrontText {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<Record<StorefrontContentLocale, unknown>>
    : {};
  return {
    en: typeof source.en === "string" ? source.en : "",
    fr: typeof source.fr === "string" ? source.fr : "",
    ar: typeof source.ar === "string" ? source.ar : "",
  };
}

/** Runtime contract for the family-specific homepage block. Persisted input is
 * accepted only for the active supported design, with bounded presentation data. */
export function themeFeatureSettings(
  section: StorefrontHomepageSection,
  activeDesign: string | undefined,
): ThemeFeatureSettings | null {
  const kind = String(section.settings.kind ?? "");
  if (section.type !== "theme_feature" || !section.enabled || kind !== activeDesign
    || !THEME_FEATURE_DESIGNS.includes(kind as ThemeFeatureDesign)) return null;
  const requestedLimit = Number(section.settings.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(8, Math.trunc(requestedLimit))) : 4;
  return {
    kind: kind as ThemeFeatureDesign,
    limit,
    title: localizedThemeFeatureText(section.settings.title),
    body: localizedThemeFeatureText(section.settings.body),
  };
}

export interface StorefrontPageDocument {
  type: "system" | "content" | "policy";
  route: string;
  title: LocalizedStorefrontText;
  showInNavigation: boolean;
  sections: StorefrontHomepageSection[];
  revision: number;
}

export type StorefrontFontPreset = "system" | "modern" | "humanist" | "editorial" | "arabic";
export interface StorefrontAppearance {
  schema_version: 1;
  typography: {
    body_font: StorefrontFontPreset;
    heading_font: StorefrontFontPreset;
    base_size: "small" | "medium" | "large";
    heading_scale: "compact" | "medium" | "large";
  };
  header: {
    layout: "theme" | "logo_start" | "logo_center";
    sticky: "none" | "always";
    width: "contained" | "full";
    logo_size: "compact" | "standard" | "large";
    nav_alignment: "start" | "center";
    show_search: boolean;
    show_account: boolean;
    show_language: boolean;
    show_cart: boolean;
    show_categories?: boolean;
    show_about?: boolean;
    show_contact?: boolean;
  };
  style: {
    button_shape: "square" | "rounded" | "pill";
    card_shape: "square" | "rounded" | "soft";
    card_padding: "none" | "compact" | "comfortable";
    card_alignment: "start" | "center";
    card_hover: "none" | "shadow" | "lift";
    content_width: "compact" | "standard" | "wide";
  };
  colors: {
    theme_primary?: string;
    theme_secondary?: string;
    theme_muted?: string;
    page: string;
    header: string;
    header_text: string;
    navigation: string;
    navigation_text: string;
    menu_dropdown?: string;
    announcement: string;
    hero: string;
    section: string;
    card: string;
    discount_badge: string;
    discount_badge_text: string;
    newsletter: string;
    footer: string;
  };
  footer: {
    show_contact: boolean;
    show_social_links: boolean;
    copyright: LocalizedStorefrontText;
  };
}

/** A catalog section/category entry, generated as `taxonomy.config.ts`. */
export interface TaxonomyCategory {
  /** Must match the backend catalog section slug exactly. */
  key: string;
  label: string;
  /** react-icons reference, e.g. "FaShirt:fa". */
  icon: string;
  /** Generated banner asset URL. */
  banner?: string;
}

export interface StoreConfig {
  /** Backend-derived effective attribution state; defaults to visible for older APIs. */
  showPlatformAttribution?: boolean;
  /** Human-readable store name (nav wordmark, footer, title). */
  storeName: string;
  /** Storefront URL, e.g. "https://mine.example.com". */
  domain: string;
  /** Backend-authoritative SEO origin; never derived from the visited host. */
  canonicalOrigin?: string;
  /** Effective server policy after publication, domain and merchant checks. */
  indexingAllowed?: boolean;
  seo?: { title?: string; description?: string; socialImage?: string };
  /** Verified aliases only; used for safe secondary-to-primary redirects. */
  publicDomains?: Array<{ hostname: string; primary: boolean }>;
  /** Tenant slug (used to scope client-side state such as auth sessions). */
  slug?: string;
  /** Business-family key supplied by the runtime storefront config. */
  design?: string;
  /** Public support email (footer + mailto links). */
  contactEmail: string;
  /** Optional phone shown in the footer. */
  phone?: string;
  /** Optional WhatsApp support number in E.164 format. */
  whatsappPhone?: string;
  /** Merchant-provided public social profiles. */
  socialLinks?: Partial<Record<"facebook" | "instagram" | "linkedin" | "pinterest" | "tiktok" | "x" | "youtube", string>>;
  /** Public store logo supplied by the merchant. */
  logoUrl?: string | null;
  /** ISO 4217 currency code, e.g. MAD, EUR, USD. */
  currency: string;
  /** Accent color applied as --sf-brand; designs may opt in to it. */
  brandColor?: string;
  /** Derived 7-color palette written by the factory; supersedes brandColor. */
  palette?: StorePalette;
  /** Optional free-delivery offer. Null/absent means flat-rate shipping. */
  freeShippingThreshold?: number | null;
  /** Flat delivery fee; waived only by an explicit free-shipping offer. */
  shippingFee?: number;
  /** Cities the store ships to (checkout city dropdown; free text if empty). */
  serviceableCities?: string[];
  /** Storefront language on first visit (en/fr/ar). */
  defaultLocale?: Locale;
  homepage?: {
    productSource: "featured" | "newest" | "discounted" | "top_rated";
    productLimit: number;
  };
  /** Published, merchant-controlled page content. Drafts are never exposed here. */
  pages?: Record<string, StorefrontPageDocument>;
  /** Optional published menu configuration; falls back to real pages and catalog sections. */
  navigation?: { headerPreset?: HeaderPreset; transparentOnHero?: boolean; showSearch?: boolean; showAccount?: boolean; showCart?: boolean; showLocale?: boolean; main?: StoreMenuItem[] };
  /** Validated global appearance controls shared by every design system. */
  appearance?: StorefrontAppearance;
  payment?: {
    /** Whether cash on delivery is enabled for this store. Defaults to true for older configs. */
    cod?: boolean;
    /** Whether online (card) payment is enabled for this store. */
    online: boolean;
    /** Card brands advertised at checkout. */
    acceptedCards: string[];
  };
  /** Present only for platform-owned, immutable theme demonstration tenants. */
  demo?: {
    enabled: boolean;
    signupUrl: string;
  } | null;
  /** Active curated preset, present only for an official read-only demo. */
  demoPreset?: string;
}

/** Catalog section summary returned inside the runtime storefront config. */
export interface StorefrontSection {
  key: string;
  label: string;
  icon: string;
}

/** The runtime config payload from GET /api/storefront/config/. */
export interface StorefrontConfig extends StoreConfig {
  slug: string;
  /** Business-family key, e.g. "basic" — selects a complete selling experience. */
  design: string;
  sections: StorefrontSection[];
}

/** Fetch the runtime storefront config (store resolved server-side). */
export async function loadStoreConfig(): Promise<StorefrontConfig> {
  return api.getStoreConfig();
}

/** The brand accent the storefront should render, palette-first. */
export function brandColor(config: StoreConfig): string | undefined {
  return config.palette?.brand ?? config.brandColor;
}

export const DEFAULT_PALETTE = {};

/** A missing threshold must never turn a configured delivery fee into zero. */
export function shippingCharge(config: StoreConfig, subtotal: number): number {
  const threshold = config.freeShippingThreshold;
  if (threshold != null && subtotal > threshold) return 0;
  return Math.max(0, config.shippingFee ?? 0);
}
