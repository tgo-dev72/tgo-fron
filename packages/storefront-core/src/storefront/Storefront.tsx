import { isValidElement, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ProductReviews } from "./ProductReviews";
import { StoreNav } from "./StoreNavigation";
import { Slideshow } from "./Slideshow";
import type { StorefrontSlide } from "../config";
import { api } from "../api/client";
import { trackStorefrontEvent } from "../api/analytics";
import type { CatalogSection, Product } from "../api/types";
import { brandColor, themeFeatureSettings, type StoreConfig, type StorefrontHomepageSection } from "../config";
import { LocaleProvider, dir, locales, sectionLabel, t } from "../i18n";
import type { Locale } from "../i18n";
import { Container } from "../system/primitives";
import { StoreConfigProvider } from "./context";
import { AuthProvider } from "./auth";
import { CartProvider, useCart } from "./cart";
const AccountPage = lazy(() => import("./account").then((module) => ({ default: module.AccountPage })));
const CheckoutFlow = lazy(() => import("../checkout/Checkout").then((module) => ({ default: module.CheckoutFlow })));
import { createCheckoutService } from "../checkout/service";
import "./storefront.css";
import {
  CatalogToolbar,
  AnnouncementBar,
  CatalogFilters,
  CartDrawer,
  CollectionHighlights,
  ContactPage,
  findVariant,
  Gallery,
  Hero,
  HeroCatalogVisual,
  IconClose,
  IconArrow,
  IconStar,
  initialSelection,
  Newsletter,
  Price,
  ProductCard,
  ProductFacts,
  RichText,
  SaveBadge,
  salePrice,
  StoreFooter,
  TrustStrip,
  VariantPicker,
} from "./components";
import type { Selection } from "./components";
import { OptimizedImage } from "../media/image";
import { applyCatalogFacets, buildCatalogFacets, filterAndSortProducts, isCatalogPath, productFacts, selectHomepageProducts, selectRelatedProducts, type CatalogFacet, type CatalogFacetSelection, type CatalogSort, type HomepageProductSource } from "./catalog";
import { setAccountSeo, setCollectionSeo, setProductSeo, setStorefrontSeo } from "./seo";
import { storefrontThemePalette } from "../themes/palettes";

/**
 * Generic ecommerce storefront. Renders whatever the catalog API returns:
 * any number of sections, products with 0..n images and 0..n variants,
 * every attribute type, promo percentages and loyalty points. A design
 * system theme wraps this in <SystemRoot> and layers its own flavor.
 */

function maxAvailable(product: Product): number {
  if (product.variants.length === 0) return 0;
  if (product.track_inventory === false) return Infinity;
  return Math.max(0, ...product.variants.map((v) => v.available_quantity));
}

type CatalogStockFilter = "all" | "in-stock" | "out-of-stock";

function productInStock(product: Product): boolean {
  return product.track_inventory === false || product.variants.some((variant) => variant.available_quantity > 0);
}

function localeStorageKey(config: StoreConfig): string {
  return `sf-locale:${config.slug ?? config.domain ?? "store"}`;
}

function pickInitialLocale(config: StoreConfig): Locale {
  if (typeof window === "undefined") return config.defaultLocale ?? "ar";
  try {
    const saved = window.localStorage.getItem(localeStorageKey(config));
    if ((locales as readonly string[]).includes(saved ?? "")) return saved as Locale;
  } catch {
    /* storage unavailable — fall through */
  }
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if ((locales as readonly string[]).includes(fromUrl ?? "")) return fromUrl as Locale;
  return config.defaultLocale ?? "ar";
}

export type StorefrontHero = { eyebrow?: string; title?: string; subtitle?: string; cta?: string } | ReactNode;
export type StorefrontCatalogContext = { products: Product[]; sections: CatalogSection[]; locale: Locale; config: StoreConfig };
export type StorefrontSectionRenderer = (context: StorefrontCatalogContext) => ReactNode;
export type StorefrontProductRenderer = (product: Product, context: StorefrontCatalogContext) => ReactNode;

export type NavLink = { label: string; href: string; targetId?: string };

function sectionText(section: StorefrontHomepageSection, key: string, locale: Locale): string {
  const value = section.settings[key];
  if (!value || typeof value !== "object") return "";
  const localized = value as Record<string, string>;
  return localized[locale]?.trim() || localized.en?.trim() || localized.fr?.trim() || localized.ar?.trim() || "";
}

function PromotionalBanner({ section, locale }: { section: StorefrontHomepageSection; locale: Locale }) {
  const imageUrl = String(section.settings.image_url || "");
  const title = sectionText(section, "title", locale);
  const body = sectionText(section, "body", locale);
  const ctaLabel = sectionText(section, "cta_label", locale);
  const ctaUrl = String(section.settings.cta_url || "");
  const safeLink = /^(https:\/\/|\/(?!\/)|#)/.test(ctaUrl) && !/[\\\u0000-\u0020]/.test(ctaUrl);
  const width = section.settings.width === "contained" ? "contained" : "full";
  const height = ["compact", "standard", "tall"].includes(String(section.settings.height)) ? String(section.settings.height) : "standard";
  return (
    <section className={`sf-promo-banner sf-banner-fade is-${width} is-${height}`} aria-label={title || ctaLabel || undefined}>
      <div className="sf-promo-banner-inner">
        {imageUrl ? <OptimizedImage className="sf-promo-banner-image" src={imageUrl} widthHint={1800} widths={[640, 960, 1280, 1600, 2000]} sizes={width === "contained" ? "min(1320px, 100vw)" : "100vw"} alt="" /> : <span className="sf-promo-banner-placeholder" aria-hidden="true" />}
        {(title || body || (ctaLabel && safeLink)) && <div className="sf-promo-banner-copy"><div>{title && <h2>{title}</h2>}{body && <RichText html={body} className="sf-promo-banner-body" />}{ctaLabel && safeLink && <a className="ds-btn ds-btn-primary" href={ctaUrl}>{ctaLabel}</a>}</div></div>}
      </div>
    </section>
  );
}

const FONT_PRESETS = {
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  modern: 'Inter, "Segoe UI", Arial, sans-serif',
  humanist: '"Trebuchet MS", "Segoe UI", sans-serif',
  editorial: 'Georgia, "Times New Roman", serif',
  arabic: 'Tajawal, Cairo, "Noto Sans Arabic", "Segoe UI", sans-serif',
} as const;

function storefrontBrandStyle(config: StoreConfig): CSSProperties {
  const configuredBrand = brandColor(config);
  if (!configuredBrand) return {};
  // Older stores persisted TijaraGO's generic teal before theme-specific
  // defaults existed. Treat that legacy value as unset for NEXA so a newly
  // selected electronics theme opens with its intended blue identity. Any
  // merchant-selected non-default brand continues to override the theme.
  const brand = config.design === "nexa" && configuredBrand.toUpperCase() === "#1F8A8C"
    ? "#1264D8"
    : configuredBrand;
  const rgb = /^#([0-9a-f]{6})$/i.exec(brand);
  const channel = (hex: string) => {
    const value = parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = rgb ? 0.2126 * channel(rgb[1].slice(0, 2)) + 0.7152 * channel(rgb[1].slice(2, 4)) + 0.0722 * channel(rgb[1].slice(4, 6)) : 0;
  const premiumGoldCanvas = config.design === "fashion";
  const brandedCanvas = premiumGoldCanvas
    ? "#fffdf8"
    : config.design === "nexa" && configuredBrand.toUpperCase() === "#1F8A8C"
      ? "#ffffff"
    : config.palette?.brandLight2 ?? `color-mix(in srgb, ${brand} 7%, white)`;
  return { "--sf-brand": brand, "--ds-color-accent": brand,
    "--sf-bg-page": brandedCanvas,
    "--sf-bg-section": brandedCanvas,
    "--sf-bg-card": "#ffffff",
    "--sf-bg-footer": "#090a0c",
    "--sf-bg-footer-ink": "#f7f7f4",
    ...(premiumGoldCanvas ? {
      "--sf-bg-newsletter": "#0d0d0c",
      "--sf-bg-newsletter-ink": "#fffaf0",
    } : {}),
    "--ds-color-canvas": brandedCanvas,
    "--ds-color-accent-hover": `color-mix(in srgb, ${brand} 82%, black)`,
    "--ds-color-accent-ink": luminance > 0.179 ? "#142019" : "#ffffff" } as CSSProperties;
}

function storefrontThemeSurfaceStyle(config: StoreConfig): CSSProperties {
  const defaults = storefrontThemePalette(config.design);
  return {
    "--ds-color-canvas": defaults.canvas,
    "--ds-color-surface": defaults.surface,
    "--ds-color-surface-2": defaults.surface2,
    "--ds-color-surface-3": defaults.surface3,
    "--ds-color-ink": defaults.ink,
    "--ds-color-ink-2": defaults.ink2,
    "--ds-color-ink-3": defaults.ink3,
    "--ds-color-border": defaults.border,
    "--ds-color-border-strong": defaults.borderStrong,
    "--ds-color-band": defaults.band,
    "--ds-color-band-ink": defaults.bandInk,
    "--ds-color-band-ink-2": defaults.bandInk2,
    "--sf-bg-page": defaults.canvas,
    "--sf-bg-section": defaults.surface,
    "--sf-bg-header": defaults.header,
    "--sf-bg-header-ink": defaults.headerInk,
    "--sf-bg-navigation": defaults.navigation,
    "--sf-navigation-ink": defaults.navigationInk,
    "--sf-bg-card": defaults.card,
    "--sf-bg-discount_badge": defaults.badge,
    "--sf-discount-badge-ink": defaults.badgeInk,
    "--sf-bg-newsletter": defaults.newsletter,
    "--sf-bg-newsletter-ink": defaults.newsletterInk,
    "--sf-bg-footer": defaults.footer,
    "--sf-bg-footer-ink": defaults.footerInk,
  } as CSSProperties;
}

export function storefrontAppearanceStyle(config: StoreConfig): CSSProperties {
  const appearance = config.appearance;
  if (!appearance) return { ...storefrontBrandStyle(config), ...storefrontThemeSurfaceStyle(config) };
  const baseSize = { small: "15px", medium: "16px", large: "17px" }[appearance.typography.base_size];
  const buttonRadius = { square: "2px", rounded: "8px", pill: "9999px" }[appearance.style.button_shape];
  const cardRadius = { square: "2px", rounded: "12px", soft: "22px" }[appearance.style.card_shape];
  const radii = {
    square: ["2px", "2px", "2px", "2px"],
    rounded: ["6px", "8px", "12px", "18px"],
    soft: ["10px", "16px", "22px", "30px"],
  }[appearance.style.card_shape];
  const contentWidth = { compact: "1040px", standard: "1140px", wide: "1320px" }[appearance.style.content_width];
  const cardPadding = { none: "0px", compact: "8px", comfortable: "12px" }[appearance.style.card_padding ?? "comfortable"];
  const cardAlignment = appearance.style.card_alignment ?? "center";
  const cardHover = appearance.style.card_hover ?? "shadow";
  const backgroundVariables: Record<string, string> = {};
  for (const [component, color] of Object.entries(appearance.colors ?? {})) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) continue;
    backgroundVariables[`--sf-bg-${component}`] = color;
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    backgroundVariables[`--sf-bg-${component}-ink`] =
      (red * 299 + green * 587 + blue * 114) / 1000 >= 150 ? "#161616" : "#ffffff";
  }
  if (/^#[0-9a-f]{6}$/i.test(appearance.colors?.header_text ?? "")) {
    backgroundVariables["--sf-header-ink"] = appearance.colors.header_text;
  }
  if (/^#[0-9a-f]{6}$/i.test(appearance.colors?.navigation_text ?? "")) {
    backgroundVariables["--sf-navigation-ink"] = appearance.colors.navigation_text;
  }
  if (/^#[0-9a-f]{6}$/i.test(appearance.colors?.discount_badge_text ?? "")) {
    backgroundVariables["--sf-discount-badge-ink"] = appearance.colors.discount_badge_text;
  }
  return {
    ...storefrontBrandStyle(config),
    ...storefrontThemeSurfaceStyle(config),
    ...backgroundVariables,
    "--ds-font-body": FONT_PRESETS[appearance.typography.body_font],
    "--ds-font-display": FONT_PRESETS[appearance.typography.heading_font],
    "--sf-base-size": baseSize,
    "--sf-button-radius": buttonRadius,
    "--sf-card-radius": cardRadius,
    "--sf-content-width": contentWidth,
    "--sf-card-padding": cardPadding,
    "--sf-card-align": cardAlignment,
    "--sf-card-items": cardAlignment === "center" ? "center" : "stretch",
    "--sf-card-justify": cardAlignment === "center" ? "center" : "flex-start",
    "--sf-card-hover-shadow": cardHover === "none" ? "none" : cardHover === "lift" ? "0 18px 42px rgb(15 23 42 / 18%)" : "0 12px 30px rgb(15 23 42 / 14%)",
    "--sf-card-hover-lift": cardHover === "lift" ? "-3px" : "0px",
    "--ds-r-sm": radii[0],
    "--ds-r-md": radii[1],
    "--ds-r-lg": radii[2],
    "--ds-r-xl": radii[3],
  } as CSSProperties;
}

export function Storefront({
  config,
  initialLocale,
  hero,
  heroChildren,
  announcement,
  navLinks,
  extraBand,
  themeSection,
  productExtras,
  newsletter,
  footer,
  children,
  showProducts = true,
  page,
}: {
  config: StoreConfig;
  initialLocale?: Locale;
  hero?: StorefrontHero | StorefrontSectionRenderer;
  heroChildren?: ReactNode;
  /** Optional thin bar rendered above the sticky header (Shopify-style announcement).
   *  May be a function of the current locale so designs can localize their copy. */
  announcement?: ReactNode | ((locale: Locale) => ReactNode);
  /** Optional nav links rendered in the header (Shopify-style navigation).
   *  May be a function of the current locale so designs can localize their labels. */
  navLinks?: NavLink[] | ((locale: Locale) => NavLink[]);
  extraBand?: ReactNode | StorefrontSectionRenderer;
  themeSection?: (section: StorefrontHomepageSection, context: StorefrontCatalogContext) => ReactNode;
  productExtras?: StorefrontProductRenderer;
  newsletter?: StorefrontSectionRenderer;
  footer?: StorefrontSectionRenderer;
  /** Extra overlay UI (modals, widgets) rendered after the main sections. */
  children?: ReactNode;
  /** When true (default) the catalog product grid renders. Set false for dedicated pages. */
  showProducts?: boolean;
  /** Rendered in place of the catalog grid when `showProducts` is false (e.g. account). */
  page?: ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? (() => pickInitialLocale(config)));
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [catalogCount, setCatalogCount] = useState(0);
  const [loadedOffset, setLoadedOffset] = useState(0);
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [productMissing, setProductMissing] = useState(false);
  const requestGeneration = useRef(0);
  const pendingProduct = useRef("");
  const catalogRouteRetry = useRef("");
  const [reloadKey, setReloadKey] = useState(0);
  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return "all";
    const match = /^\/collections\/([^/]+)/.exec(window.location.pathname);
    return match ? decodeURIComponent(match[1]) : "all";
  });
  const [query, setQuery] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("search") ?? "");
  const [sort, setSort] = useState<CatalogSort>(() => {
    if (typeof window === "undefined") return "featured";
    const requested = new URLSearchParams(window.location.search).get("sort");
    return requested && ["newest", "price-low", "price-high", "rating"].includes(requested) ? requested as CatalogSort : "featured";
  });
  const [facetSelection, setFacetSelection] = useState<CatalogFacetSelection>({});
  const [stockFilter, setStockFilter] = useState<CatalogStockFilter>("all");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [pdp, setPdp] = useState<Product | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [hash, setHash] = useState<string>(() => (typeof window === "undefined" ? "" : window.location.hash));
  const [routePath, setRoutePath] = useState<string>(() => (typeof window === "undefined" ? "/" : window.location.pathname));

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function changeLocale(next: Locale) {
    setLocale(next);
    try {
      window.localStorage.setItem(localeStorageKey(config), next);
    } catch {
      /* storage unavailable — keep in-memory locale */
    }
  }

  const service = useMemo(() => createCheckoutService(), []);

  useEffect(() => {
    let current = true;
    requestGeneration.current += 1;
    setLoading(true);
    setError(false);
    setFullyLoaded(false);
    setLoadedOffset(0);
    setCatalogCount(0);
    const section = active === "all" ? undefined : active;
    const homeSources = active === "all"
      ? [...new Set([
          config.homepage?.productSource,
          ...(config.pages?.home?.sections ?? []).filter((item) => item.type === "products" && item.enabled).map((item) => String(item.settings.source)),
        ].filter((source): source is "featured" | "newest" | "discounted" | "top_rated" =>
          source === "newest" || source === "discounted" || source === "top_rated"))]
      : [];
    Promise.all([
      api.getSections(locale).catch(() => [] as CatalogSection[]),
      api.getProductsPage({ section, lang: locale }),
      Promise.all(homeSources.map((source) => api.getProductsPage({ source, limit: 24, lang: locale }).catch(() => null))),
    ])
      .then(([nextSections, firstPage, optionalMerchandisingPages]) => {
        if (!current) return;
        setSections(nextSections);
        const merged = new Map<number, Product>();
        const merchandisingProducts = optionalMerchandisingPages.flatMap((page) => page?.results ?? []);
        for (const product of [...firstPage.results, ...merchandisingProducts]) merged.set(product.id, product);
        setProducts([...merged.values()]);
        setCatalogCount(firstPage.count);
        setLoadedOffset(firstPage.results.length);
        setFullyLoaded(firstPage.results.length >= firstPage.count);
      })
      .catch(() => { if (current) setError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [active, config, locale, reloadKey]);

  useEffect(() => {
    if (!isCatalogPath(routePath)) {
      catalogRouteRetry.current = "";
      return;
    }
    if (!error || catalogRouteRetry.current === routePath) return;
    catalogRouteRetry.current = routePath;
    setReloadKey((value) => value + 1);
  }, [error, routePath]);

  const hasMore = !fullyLoaded && loadedOffset < catalogCount;
  const advancedCatalog = isCatalogPath(routePath) || Boolean(query.trim()) || sort !== "featured"
    || stockFilter !== "all" || priceRange !== null
    || Object.values(facetSelection).some((values) => values.length > 0);
  useEffect(() => {
    if (!advancedCatalog || !hasMore || loading || error) return;
    let current = true;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    api.getProducts(active === "all" ? undefined : active, locale)
      .then((all) => {
        if (!current || generation !== requestGeneration.current) return;
        setProducts(all);
        setLoadedOffset(all.length);
        setCatalogCount(all.length);
        setFullyLoaded(true);
      })
      .catch(() => { if (current) setError(true); })
      .finally(() => { if (current) setLoadingMore(false); });
    return () => { current = false; };
  }, [active, advancedCatalog, error, hasMore, loading, locale]);

  async function loadMoreProducts() {
    if (!hasMore || loadingMore) return;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    try {
      const page = await api.getProductsPage({
        section: active === "all" ? undefined : active, offset: loadedOffset, lang: locale,
      });
      if (generation !== requestGeneration.current) return;
      setProducts((current) => {
        const merged = new Map(current.map((product) => [product.id, product]));
        page.results.forEach((product) => merged.set(product.id, product));
        return [...merged.values()];
      });
      setLoadedOffset((offset) => offset + page.results.length);
      setFullyLoaded(page.results.length === 0 || loadedOffset + page.results.length >= page.count);
      setCatalogCount(page.count);
    } catch { if (generation === requestGeneration.current) setError(true); }
    finally { if (generation === requestGeneration.current) setLoadingMore(false); }
  }

  useEffect(() => {
    if (routePath !== "/" && !/^\/collections\//.test(routePath) && routePath !== "/products") return;
    if (routePath === "/" && hash.startsWith("#/account")) return;
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("search", query.trim());
    else url.searchParams.delete("search");
    if (sort !== "featured") url.searchParams.set("sort", sort);
    else url.searchParams.delete("sort");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [hash, query, routePath, sort]);

  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const visible = useMemo(() => {
    if (active === "all") return products;
    const section = sections.find((s) => s.key === active);
    return section
      ? products.filter((product) => product.section === section.id || product.categories?.some((category) => category.id === section.id))
      : products;
  }, [products, sections, active]);
  const catalogFacets = useMemo(() => fullyLoaded ? buildCatalogFacets(visible, sections) : [], [fullyLoaded, sections, visible]);
  const premiumCatalog = config.design !== "basic";
  const priceBounds = useMemo<[number, number]>(() => {
    const prices = visible.map(salePrice).filter(Number.isFinite);
    return prices.length ? [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))] : [0, 0];
  }, [visible]);
  const stockCounts = useMemo(() => ({
    inStock: visible.filter(productInStock).length,
    outOfStock: visible.filter((product) => !productInStock(product)).length,
  }), [visible]);
  const commerceFiltered = useMemo(() => {
    if (!premiumCatalog) return visible;
    const [minimum, maximum] = priceRange ?? priceBounds;
    return visible.filter((product) => {
      const available = productInStock(product);
      const matchesStock = stockFilter === "all" || (stockFilter === "in-stock" ? available : !available);
      const price = salePrice(product);
      return matchesStock && price >= minimum && price <= maximum;
    });
  }, [premiumCatalog, priceBounds, priceRange, stockFilter, visible]);
  const discovered = useMemo(
    () => filterAndSortProducts(applyCatalogFacets(commerceFiltered, facetSelection), sections, query, sort),
    [commerceFiltered, facetSelection, query, sections, sort],
  );

  useEffect(() => { setFacetSelection({}); setStockFilter("all"); setPriceRange(null); }, [active]);

  const activeLabel =
    active === "all" ? t(locale, "nav.all") : sectionLabel(locale, sections.find((s) => s.key === active)?.label ?? active);

  function openProduct(product: Product) {
    setPdp(product);
    setSelection(initialSelection(product, sections));
  }

  function openProductPage(product: Product) {
    setPdp(product);
    setSelection((current) => product === pdp ? current : initialSelection(product, sections));
    const path = `/products/${encodeURIComponent(product.slug || String(product.id))}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", `${path}${window.location.search}${window.location.hash}`);
      setRoutePath(path);
    }
    window.scrollTo({ top: 0 });
  }

  function closeProduct() {
    setPdp(null);
  }

  function selectSection(key: string) {
    setActive(key);
    setPdp(null);
    const path = key === "all" ? "/" : `/collections/${encodeURIComponent(key)}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", `${path}${window.location.search}${window.location.hash}`);
      setRoutePath(path);
    }
  }

  useEffect(() => {
    const syncFromPath = () => {
      setRoutePath(window.location.pathname);
      // Static gallery capture opens the quick-view from CartConsumer. Do not
      // let the path synchronizer close it during StrictMode's effect replay.
      if (new URLSearchParams(window.location.search).get("gallery") === "product") return;
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts[0] === "products" && parts[1]) {
        const identifier = decodeURIComponent(parts[1]);
        const product = products.find((item) => item.slug === identifier || String(item.id) === identifier);
        if (product) {
          setPdp(product);
          setSelection(initialSelection(product, sections));
          setProductMissing(false);
        } else if (pendingProduct.current !== identifier) {
          pendingProduct.current = identifier;
          setProductMissing(false);
          api.getProduct(identifier).then((found) => {
            if (window.location.pathname !== `/products/${encodeURIComponent(identifier)}`) return;
            setPdp(found);
            setSelection(initialSelection(found, sections));
            setProductMissing(false);
          }).catch(() => {
            if (window.location.pathname === `/products/${encodeURIComponent(identifier)}`) setProductMissing(true);
          }).finally(() => { pendingProduct.current = ""; });
        }
        return;
      }
      setPdp(null);
      if (parts[0] === "collections" && parts[1]) {
        const key = decodeURIComponent(parts[1]);
        setActive(key);
      } else {
        setActive("all");
      }
    };
    const followStorefrontLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || !/^https?:$/.test(destination.protocol)) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash && !destination.hash.startsWith("#/")) {
        const anchor = document.querySelector(destination.hash);
        if (!anchor) return;
        event.preventDefault();
        window.history.pushState(null, "", `${destination.pathname}${destination.search}${destination.hash}`);
        anchor.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return;
      }
      event.preventDefault();
      window.history.pushState(null, "", `${destination.pathname}${destination.search}${destination.hash}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      window.scrollTo({ top: 0, behavior: "auto" });
      if (event.detail === 0) window.requestAnimationFrame(() => {
        const main = document.querySelector<HTMLElement>(".sf-root main, .sf-root section");
        if (!main) return;
        main.tabIndex = -1;
        main.focus({ preventScroll: true });
      });
    };
    syncFromPath();
    window.addEventListener("popstate", syncFromPath);
    window.addEventListener("click", followStorefrontLink);
    return () => {
      window.removeEventListener("popstate", syncFromPath);
      window.removeEventListener("click", followStorefrontLink);
    };
  }, [products, sections]);

  useEffect(() => {
    if (routePath.replace(/\/$/, "") === "/account" || (routePath === "/" && hash.startsWith("#/account"))) {
      setAccountSeo(config, locale);
      return;
    }
    if (pdp) {
      setProductSeo(config, locale, pdp, salePrice(pdp));
      return;
    }
    const section = sections.find((item) => item.key === active);
    if (section) setCollectionSeo(config, locale, section.key, sectionLabel(locale, section.label));
    else setStorefrontSeo(config, locale);
  }, [active, config, hash, locale, pdp, routePath, sections]);

  const pdpSection = pdp ? sectionById.get(pdp.section) : undefined;
  const selectedPdpVariant = pdp ? findVariant(pdp, selection) : undefined;
  const pdpMax = selectedPdpVariant
    ? pdp?.track_inventory === false ? Infinity : selectedPdpVariant.available_quantity
    : pdp ? maxAvailable(pdp) : 0;
  const pdpInStock = pdpMax > 0;
  const pdpAddable = pdp ? Boolean(selectedPdpVariant) : false;

  /* Designs without their own router get a built-in /account fallback so the
     header account button works on every template. Routed designs pass `page`
     explicitly, which takes precedence. */
  const showAccountFallback = !page && (routePath.replace(/\/$/, "") === "/account" || (routePath === "/" && hash.startsWith("#/account")));

  return (
    <StoreConfigProvider value={config}>
      <LocaleProvider value={{ locale, setLocale: changeLocale }}>
        <AuthProvider slug={config.slug ?? config.domain ?? "store"}>
          <CartProvider key={config.slug ?? config.domain} storeKey={config.slug ?? config.domain} sections={sections} locale={locale}>
            <CartConsumer
              config={config}
              locale={locale}
              sections={sections}
              allProducts={products}
              visible={discovered}
              catalogTotal={fullyLoaded ? visible.length : catalogCount}
              activeLabel={activeLabel}
              error={error}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMoreProducts}
              productMissing={productMissing}
              retryCatalog={() => setReloadKey((value) => value + 1)}
              active={active}
              setActive={selectSection}
              query={query}
              setQuery={setQuery}
              sort={sort}
              setSort={setSort}
              catalogFacets={catalogFacets}
              facetSelection={facetSelection}
              setFacetSelection={setFacetSelection}
              premiumCatalog={premiumCatalog}
              stockFilter={stockFilter}
              setStockFilter={setStockFilter}
              stockCounts={stockCounts}
              priceBounds={priceBounds}
              priceRange={priceRange ?? priceBounds}
              setPriceRange={setPriceRange}
              pdp={pdp}
              closeProduct={closeProduct}
              selection={selection}
              setSelection={setSelection}
              pdpSection={pdpSection}
              pdpMax={pdpMax}
              pdpInStock={pdpInStock}
              pdpAddable={pdpAddable}
              selectedPdpVariant={selectedPdpVariant}
              hero={hero}
              heroChildren={heroChildren}
              announcement={announcement}
              navLinks={navLinks}
              extraBand={extraBand}
              themeSection={themeSection}
              productExtras={productExtras}
              newsletter={newsletter}
              footer={footer}
              children={children}
              service={service}
              openProduct={openProduct}
              openProductPage={openProductPage}
              showProducts={showProducts}
              page={page}
              showAccountFallback={showAccountFallback}
              storefrontHash={hash}
              storefrontPath={routePath}
            />
          </CartProvider>
        </AuthProvider>
      </LocaleProvider>
    </StoreConfigProvider>
  );
}

function CartConsumer({
  config,
  locale,
  sections,
  allProducts,
  visible,
  catalogTotal,
  activeLabel,
  error,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  productMissing,
  retryCatalog,
  active,
  setActive,
  query,
  setQuery,
  sort,
  setSort,
  catalogFacets,
  facetSelection,
  setFacetSelection,
  premiumCatalog,
  stockFilter,
  setStockFilter,
  stockCounts,
  priceBounds,
  priceRange,
  setPriceRange,
  pdp,
  closeProduct,
  selection,
  setSelection,
  pdpSection,
  pdpMax,
  pdpInStock,
  pdpAddable,
  selectedPdpVariant,
  hero,
  heroChildren,
  announcement,
  navLinks,
  extraBand,
  themeSection,
  productExtras,
  newsletter,
  footer,
  children,
  service,
  openProduct,
  openProductPage,
  showProducts,
  page,
  showAccountFallback,
  storefrontHash,
  storefrontPath,
}: {
  config: StoreConfig;
  locale: Locale;
  sections: CatalogSection[];
  allProducts: Product[];
  visible: Product[];
  catalogTotal: number;
  activeLabel: string;
  error: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  productMissing: boolean;
  retryCatalog: () => void;
  active: string;
  setActive: (key: string) => void;
  query: string;
  setQuery: (value: string) => void;
  sort: CatalogSort;
  setSort: (value: CatalogSort) => void;
  catalogFacets: CatalogFacet[];
  facetSelection: CatalogFacetSelection;
  setFacetSelection: (value: CatalogFacetSelection | ((current: CatalogFacetSelection) => CatalogFacetSelection)) => void;
  premiumCatalog: boolean;
  stockFilter: CatalogStockFilter;
  setStockFilter: (value: CatalogStockFilter) => void;
  stockCounts: { inStock: number; outOfStock: number };
  priceBounds: [number, number];
  priceRange: [number, number];
  setPriceRange: (value: [number, number] | null) => void;
  pdp: Product | null;
  closeProduct: () => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  pdpSection: CatalogSection | undefined;
  pdpMax: number;
  pdpInStock: boolean;
  pdpAddable: boolean;
  selectedPdpVariant: ReturnType<typeof findVariant>;
  hero: StorefrontHero | StorefrontSectionRenderer;
  heroChildren: ReactNode;
  announcement?: ReactNode | ((locale: Locale) => ReactNode);
  navLinks?: NavLink[] | ((locale: Locale) => NavLink[]);
  extraBand: ReactNode | StorefrontSectionRenderer;
  themeSection?: (section: StorefrontHomepageSection, context: StorefrontCatalogContext) => ReactNode;
  productExtras?: StorefrontProductRenderer;
  newsletter?: StorefrontSectionRenderer;
  footer?: StorefrontSectionRenderer;
  children: ReactNode;
  service: ReturnType<typeof createCheckoutService>;
  openProduct: (p: Product) => void;
  openProductPage: (p: Product) => void;
  showProducts: boolean;
  page: ReactNode;
  showAccountFallback: boolean;
  storefrontHash: string;
  storefrontPath: string;
}) {
  const {
    cart,
    cartCount,
    drawerOpen,
    checkoutOpen,
    toast,
    addToCart,
    setQty,
    removeItem,
    openCart,
    closeCart,
    openCheckout,
    closeCheckout,
    clearCart,
  } = useCart();
  const galleryStateRef = useRef<"" | "added" | "opened">("");
  const lastTrackedPageRef = useRef("");
  const lastTrackedProductRef = useRef<number | null>(null);
  const lastTrackedSearchRef = useRef("");
  const [pdpQuantity, setPdpQuantity] = useState(1);
  const [pdpAdding, setPdpAdding] = useState(false);
  const [buyNowPending, setBuyNowPending] = useState(false);
  const [showStickyPurchaseBar, setShowStickyPurchaseBar] = useState(false);
  const [quickAddClosing, setQuickAddClosing] = useState(false);
  const [showRouteProgress, setShowRouteProgress] = useState(false);
  const [demoPromptOpen, setDemoPromptOpen] = useState(false);
  const pdpAddingRef = useRef(false);
  const pdpPurchaseActionsRef = useRef<HTMLDivElement>(null);
  const stickyPurchaseBarRef = useRef<HTMLDivElement>(null);
  const quickAddModalRef = useRef<HTMLDivElement>(null);
  const quickAddOpenerRef = useRef<HTMLElement | null>(null);
  const requestCheckout = () => {
    if (config.demo?.enabled) {
      closeCart();
      setDemoPromptOpen(true);
      return;
    }
    openCheckout();
  };

  useEffect(() => { setPdpQuantity(1); }, [pdp?.id, selectedPdpVariant?.id]);
  useEffect(() => {
    if (!buyNowPending) return;
    setBuyNowPending(false);
    requestCheckout();
  }, [buyNowPending]);

  // Static-gallery capture mode. Any design using Storefront automatically
  // supports ?gallery=product, ?gallery=cart and ?gallery=checkout.
  useEffect(() => {
    const gallery = new URLSearchParams(window.location.search).get("gallery");
    const product = visible[0];
    if (!gallery || !product || galleryStateRef.current === "opened") return;
    if (gallery === "product") {
      openProductPage(product);
      galleryStateRef.current = "opened";
      return;
    }
    if ((gallery === "cart" || gallery === "checkout") && galleryStateRef.current === "") {
      addToCart(product, initialSelection(product, sections));
      galleryStateRef.current = "added";
      return;
    }
    if (galleryStateRef.current === "added" && cartCount > 0) {
      if (gallery === "cart") openCart();
      if (gallery === "checkout") requestCheckout();
      galleryStateRef.current = "opened";
    }
  }, [addToCart, cartCount, openCart, openCheckout, openProduct, sections, visible]);

  const resolvedAnnouncement = typeof announcement === "function" ? announcement(locale) : announcement;
  const configuredPages = Object.entries(config.pages ?? {});
  const homeSections = config.pages?.home?.sections ?? [];
  const hasConfiguredPages = configuredPages.length > 0;
  const hashRoute = storefrontHash.replace(/^#\/?/, "").split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "");
  const currentPath = storefrontPath;
  const pathRoute = currentPath.replace(/^\/+|\/+$/g, "");
  const requestedRoute = currentPath === "/" ? hashRoute : pathRoute;
  const configuredPageEntry = configuredPages.find(([, configuredPage]) => configuredPage.route === requestedRoute);
  const configuredPageKey = configuredPageEntry?.[0] ?? "";
  const configuredSections = configuredPageEntry?.[1].sections ?? [];
  const catalogPageActive = isCatalogPath(currentPath);
  // Collection routes do not necessarily equal the protected catalog page's
  // canonical `/products` route. They must still inherit its published visual
  // sections (especially the merchant-uploaded banner).
  const catalogSections = configuredPageKey === "catalog"
    ? configuredSections
    : config.pages?.catalog?.sections ?? [];
  // The protected catalog document supplies navigation metadata, but its
  // route must use the commerce catalog with filters rather than CMS sections.
  const configuredPageActive = Boolean(configuredPageEntry) && !catalogPageActive;
  const contactPageActive = configuredPageActive && (configuredPageKey === "contact" || /^contact(?:-us)?$/i.test(requestedRoute));
  const productPageActive = currentPath.startsWith("/products/") && Boolean(pdp);
  useEffect(() => {
    if (!productPageActive || !pdp) {
      setShowStickyPurchaseBar(false);
      return;
    }
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const actions = pdpPurchaseActionsRef.current;
        const bar = stickyPurchaseBarRef.current;
        const nav = document.querySelector<HTMLElement>(".sf-nav");
        if (!actions || !bar) return;
        const headerBottom = Math.max(0, nav?.getBoundingClientRect().bottom ?? 0);
        bar.style.setProperty("--sf-purchase-bar-top", `${Math.round(headerBottom)}px`);
        setShowStickyPurchaseBar(actions.getBoundingClientRect().bottom <= headerBottom + 1);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const nav = document.querySelector<HTMLElement>(".sf-nav");
    if (nav) resizeObserver?.observe(nav);
    if (pdpPurchaseActionsRef.current) resizeObserver?.observe(pdpPurchaseActionsRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
    };
  }, [pdp?.id, productPageActive]);
  const quickAddOpen = Boolean(pdp) && !productPageActive;
  const requestQuickAddClose = () => {
    if (quickAddClosing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { closeProduct(); return; }
    setQuickAddClosing(true);
    window.setTimeout(() => { setQuickAddClosing(false); closeProduct(); }, 180);
  };
  useEffect(() => {
    if (!quickAddOpen) return;
    quickAddOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => quickAddModalRef.current?.querySelector<HTMLButtonElement>(".sf-pdp-close")?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestQuickAddClose();
        return;
      }
      if (event.key !== "Tab" || !quickAddModalRef.current) return;
      const focusable = Array.from(quickAddModalRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      quickAddOpenerRef.current?.focus();
      quickAddOpenerRef.current = null;
    };
  }, [quickAddOpen]);
  const featuredHome = !catalogPageActive && active === "all" && !query.trim() && Object.values(facetSelection).every((values) => values.length === 0);
  const displayedProducts = featuredHome ? visible.slice(0, Math.max(1, config.homepage?.productLimit ?? 8)) : visible;
  const routePending = loading || (currentPath.startsWith("/products/") && !pdp && !productMissing);
  useEffect(() => {
    if (!routePending) { setShowRouteProgress(false); return; }
    const timer = window.setTimeout(() => setShowRouteProgress(true), 160);
    return () => window.clearTimeout(timer);
  }, [routePending]);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sf-root");
    const content = root?.querySelector<HTMLElement>(":scope > main, :scope > section:not(.sf-announce), :scope > .sf-hero");
    if (!content || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    content.classList.remove("sf-page-enter", "sf-banner-page-enter");
    const containsBanner = content.matches(".sf-hero, .sf-slideshow") || Boolean(content.querySelector(".sf-hero, .sf-slideshow"));
    const frame = window.requestAnimationFrame(() => content.classList.add(containsBanner ? "sf-banner-page-enter" : "sf-page-enter"));
    return () => window.cancelAnimationFrame(frame);
  }, [currentPath, storefrontHash]);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sf-root");
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>([
      ".sf-collections-grid .sf-collection-card",
      ".sf-products .sf-card",
      ".sf-home-products .sf-card",
      ".sf-related-products .sf-card",
      ".sf-image-text-inner",
      ".theme-section-head",
      ".sf-newsletter-inner",
    ].join(","))).filter((element) => !element.classList.contains("is-revealed"));
    if (targets.length === 0) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targets.forEach((element, index) => {
      element.classList.add("sf-reveal-item");
      element.style.setProperty("--sf-reveal-delay", `${Math.min(index, 2) * 40}ms`);
      if (reducedMotion || element.getBoundingClientRect().top < window.innerHeight * .96) element.classList.add("is-revealed");
    });
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      targets.forEach((element) => element.classList.add("is-revealed"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
    targets.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [currentPath, loading, displayedProducts.length, sections.length]);
  useEffect(() => {
    const path = `${currentPath}${storefrontHash}`;
    if (lastTrackedPageRef.current === path) return;
    lastTrackedPageRef.current = path;
    trackStorefrontEvent({ eventType: "page_view", properties: { path } });
  }, [currentPath, storefrontHash]);
  useEffect(() => {
    if (!pdp || lastTrackedProductRef.current === pdp.id) return;
    lastTrackedProductRef.current = pdp.id;
    trackStorefrontEvent({
      eventType: "product_view",
      productId: pdp.id,
      properties: { path: currentPath },
    });
  }, [currentPath, pdp]);
  useEffect(() => {
    const normalized = query.trim();
    if (!normalized || loading || error) return;
    const signature = `${normalized.toLocaleLowerCase()}:${visible.length}`;
    const timeout = window.setTimeout(() => {
      if (lastTrackedSearchRef.current === signature) return;
      lastTrackedSearchRef.current = signature;
      trackStorefrontEvent({
        eventType: "search",
        properties: { query: normalized, results_count: visible.length },
      });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [error, loading, query, visible.length]);
  const configuredProductSections = config.pages?.product?.sections ?? [];
  const productPageSections: StorefrontHomepageSection[] = configuredProductSections.length > 0
    ? configuredProductSections
    : [
        { id: "product-main", type: "product_main", enabled: true, settings: { show_reference: true, show_rating: true, show_description: true, show_stock: true, show_quantity: true, show_facts: true } },
        { id: "product-assurances", type: "product_assurances", enabled: true, settings: { first: { en: "", fr: "", ar: "" }, second: { en: "", fr: "", ar: "" } } },
        { id: "related-products", type: "related_products", enabled: true, settings: { title: { en: "", fr: "", ar: "" }, limit: 4 } },
      ];
  const productMain = productPageSections.find((section) => section.type === "product_main");
  const relatedProductSection = productPageSections.find((section) => section.type === "related_products" && section.enabled);
  const productSetting = (key: string) => productMain?.settings[key] !== false;
  const configuredAnnouncement = homeSections.find((section) => section.type === "announcement" && section.enabled);
  const announcementContent = homeSections.length > 0
    ? configuredAnnouncement
      ? <AnnouncementBar section={configuredAnnouncement} locale={locale} />
      : null
    : resolvedAnnouncement;
  const templateNavLinks = typeof navLinks === "function" ? navLinks(locale) : navLinks;
  const configuredNavLinks = configuredPages
    .filter(([, configuredPage]) => configuredPage.showInNavigation)
    .map(([pageKey, configuredPage]) => ({
      label: configuredPage.title[locale]?.trim() || configuredPage.title.en?.trim() || pageKey,
      href: configuredPage.route ? `/${configuredPage.route}` : "/",
    }))
    .filter((link) => link.label);
  // Published content pages must not hide a family's buying tools. Keep
  // their distinct routes while letting merchant titles win for shared URLs.
  const familyCommerceLinks = (templateNavLinks ?? []).filter((link) =>
    /\/(shop|catalog|collections|lookbook|edit|inspired|compare|quotes|bundles|rewards|wishlist)(?:$|[?#/])/.test(link.href)
    && !configuredNavLinks.some((configured) => configured.href === link.href),
  );
  const resolvedNavLinks = hasConfiguredPages
    ? [...configuredNavLinks, ...familyCommerceLinks]
    : templateNavLinks;
  const categoryTrail = (section?: CatalogSection) => {
    const trail: CatalogSection[] = [];
    const visited = new Set<number>();
    let current = section;
    while (current && !visited.has(current.id) && trail.length < 3) {
      visited.add(current.id);
      trail.unshift(current);
      current = sections.find((candidate) => candidate.id === current?.parent);
    }
    return trail;
  };
  const activeCategoryTrail = categoryTrail(sections.find((section) => section.key === active));
  const activeCategoryBanner = activeCategoryTrail[activeCategoryTrail.length - 1];
  const catalogHeroImage = String(catalogSections.find((section) => section.enabled && section.type === "hero")?.settings.image_url || "");
  const activeCategoryImage = activeCategoryBanner?.thumbnail || catalogHeroImage;
  const productCategoryTrail = categoryTrail(pdpSection);
  const relatedProducts = pdp?.show_related_products
    ? selectRelatedProducts(allProducts, pdp, Number(relatedProductSection?.settings.limit ?? 4))
    : [];
  const relatedFallback = config.design === "beauty"
    ? { en: "Complete your routine", fr: "Complétez votre routine", ar: "أكمل روتينك" }[locale]
    : config.design === "fashion"
      ? { en: "Complete the look", fr: "Complétez votre style", ar: "أكمل إطلالتك" }[locale]
      : config.design === "electronics"
        ? { en: "Explore related tech", fr: "Découvrez des produits associés", ar: "اكتشف منتجات مشابهة" }[locale]
        : t(locale, "product.relatedTitle");
  const pdpQuantityMax = selectedPdpVariant
    ? pdp?.track_inventory === false
      ? Number.MAX_SAFE_INTEGER
      : Math.max(1, selectedPdpVariant.available_quantity)
    : 1;
  const quickAddProduct = (product: Product) => {
    if (product.uses_variants !== false) {
      openProduct(product);
      return;
    }
    addToCart(product, initialSelection(product, sections));
  };
  const commitSelectedProduct = (checkout = false) => {
    if (!pdp || !pdpAddable || pdpAddingRef.current) return;
    pdpAddingRef.current = true;
    setPdpAdding(true);
    try {
      addToCart(pdp, selection, pdpQuantity);
      if (checkout) setBuyNowPending(true);
    }
    finally { window.setTimeout(() => { pdpAddingRef.current = false; setPdpAdding(false); }, 350); }
  };
  const addSelectedProduct = () => commitSelectedProduct(false);
  const buySelectedProduct = () => commitSelectedProduct(true);
  const themeProductDetails = pdp ? productExtras?.(pdp, { products: allProducts, sections, locale, config }) : null;
  const pdpFacts = pdp ? productFacts(pdp, pdpSection) : [];
  const productDetails = pdp ? (
    <div className="sf-pdp-layout">
      <div className="sf-pdp-media-column">
        <Gallery product={pdp} locale={locale} selectedImage={selectedPdpVariant?.image} />
        {productPageActive && productSetting("show_description") && pdp.description && <div className="sf-product-description"><RichText html={pdp.description} className="ds-body sf-pdp-desc" /></div>}
      </div>
      <div className="sf-pdp-copy">
        <div className="sf-pdp-heading">
          {productSetting("show_reference") && <span className="sf-pdp-ref">{pdp.ref}</span>}
          {pdpSection && <span className="sf-pdp-category">{sectionLabel(locale, pdpSection.label)}</span>}
        </div>
        <h1 className="ds-display-3" id="sf-quick-add-title">{pdp.name}</h1>
        {productSetting("show_rating") && pdp.reviews_count > 0 && (
          <span
            className="sf-card-rating sf-pdp-rating"
            aria-label={`${pdp.rating.toFixed(1)} · ${t(locale, "product.reviews", pdp.reviews_count)}`}
          >
            <IconStar />
            {pdp.rating.toFixed(1)}
            <em>{t(locale, "product.reviews", pdp.reviews_count)}</em>
          </span>
        )}
        <div className="sf-pdp-price">
          <Price product={{ price: selectedPdpVariant?.effective_price ?? selectedPdpVariant?.price ?? pdp.price, promo: pdp.promo, compare_at_price: selectedPdpVariant?.effective_compare_at_price ?? pdp.compare_at_price }} locale={locale} />
          <SaveBadge product={pdp} locale={locale} />
        </div>
        {productSetting("show_stock") && <div className="sf-pdp-meta">
          <span className={`sf-pdp-stock ${!pdpInStock ? "is-none" : pdpMax <= 3 ? "is-low" : ""}`}>
            {pdpInStock
              ? pdpMax <= 3
                ? t(locale, "product.lowStock", pdpMax === Infinity ? 1 : pdpMax)
                : t(locale, "product.inStock")
              : t(locale, "product.outOfStock")}
          </span>
        </div>}
        {(pdp.variant_options?.length || pdpSection) && (
          <VariantPicker
            product={pdp}
            section={pdpSection}
            selection={selection}
            onChange={setSelection}
            locale={locale}
          />
        )}
        <div className="sf-pdp-actions" ref={productPageActive ? pdpPurchaseActionsRef : undefined}>
          {productSetting("show_quantity") && <span className="sf-pdp-actions-label">{t(locale, "product.quantity")}</span>}
          <div className="sf-pdp-controls">
            {productSetting("show_quantity") && <div className="sf-pdp-quantity" aria-label={t(locale, "product.quantity")}>
              <button type="button" disabled={pdpQuantity <= 1} onClick={() => setPdpQuantity((value) => Math.max(1, value - 1))} aria-label={t(locale, "product.decreaseQuantity")}>−</button><output>{pdpQuantity}</output><button type="button" disabled={!pdpAddable || pdpQuantity >= pdpQuantityMax} onClick={() => setPdpQuantity((value) => Math.min(pdpQuantityMax, value + 1))} aria-label={t(locale, "product.increaseQuantity")}>+</button>
            </div>}
            <div className="sf-pdp-purchase-actions">
              <button
                className="ds-btn ds-btn-primary sf-pdp-add"
                disabled={!pdpAddable || pdpAdding}
                aria-busy={pdpAdding || undefined}
                onClick={addSelectedProduct}
              >
                {pdpAdding ? { en: "Adding…", fr: "Ajout…", ar: "جارٍ الإضافة…" }[locale] : t(locale, "product.addToCart")}
              </button>
              <button
                className="ds-btn ds-btn-secondary sf-pdp-buy-now"
                disabled={!pdpAddable || pdpAdding}
                onClick={buySelectedProduct}
              >
                {t(locale, "product.buyNow")}
              </button>
            </div>
          </div>
          {!productPageActive && (
            <button type="button" className="sf-pdp-full" onClick={() => openProductPage(pdp)}>
              {t(locale, "product.fullDetails")}
            </button>
          )}
        </div>
        {pdp.loyalty_points > 0 && <p className="sf-loyalty">{t(locale, "product.loyalty", pdp.loyalty_points)}</p>}
      </div>
    </div>
  ) : null;

  const dedicatedAccount = showAccountFallback || (configuredPageActive && (configuredPageKey === "account" || configuredPageKey === "login"));

  return (
    <div
      className="sf-root"
      dir={dir(locale)}
      data-header-layout={config.appearance?.header.layout ?? "logo_center"}
      data-header-sticky={config.appearance?.header.sticky ?? "always"}
      data-heading-scale={config.appearance?.typography.heading_scale ?? "medium"}
      data-design={config.design ?? "basic"}
      style={storefrontAppearanceStyle(config)}
    >
      {announcementContent && <div className="sf-announce">{announcementContent}</div>}
      <StoreNav cartCount={cartCount} onOpenCart={openCart} navLinks={resolvedNavLinks} sections={sections} products={allProducts} pathname={currentPath} hash={storefrontHash} searchQuery={query} />
      {productPageActive && pdp && <div
        ref={stickyPurchaseBarRef}
        className={`sf-sticky-purchase-bar ${showStickyPurchaseBar ? "is-visible" : ""}`}
        aria-hidden={!showStickyPurchaseBar}
      >
        <Container>
          <div className="sf-sticky-purchase-product">
            {(selectedPdpVariant?.image?.image || pdp.images[0]?.image) && <OptimizedImage src={selectedPdpVariant?.image?.image || pdp.images[0].image} widthHint={96} widths={[64, 96, 128]} sizes="56px" alt="" />}
            <div><strong>{pdp.name}</strong><Price product={{ price: selectedPdpVariant?.effective_price ?? selectedPdpVariant?.price ?? pdp.price, promo: pdp.promo, compare_at_price: selectedPdpVariant?.effective_compare_at_price ?? pdp.compare_at_price }} locale={locale} /></div>
          </div>
          <button type="button" className="ds-btn ds-btn-primary" tabIndex={showStickyPurchaseBar ? 0 : -1} disabled={!pdpAddable || pdpAdding} aria-busy={pdpAdding || undefined} onClick={addSelectedProduct}>{pdpAdding ? { en: "Adding…", fr: "Ajout…", ar: "جارٍ الإضافة…" }[locale] : t(locale, "product.addToCart")}</button>
        </Container>
      </div>}
      {showRouteProgress && <div className="sf-route-progress" role="progressbar" aria-label={t(locale, "catalog.loading")}><span /></div>}
      {dedicatedAccount ? (
        <main className="sf-page sf-customer-page" id="customer-account"><Container><Suspense fallback={<div className="sf-catalog-state" role="status">{t(locale, "catalog.loading")}</div>}><AccountPage key={`${currentPath}${window.location.search}${storefrontHash}`} initialMode="signin" /></Suspense></Container></main>
      ) : productPageActive ? (
        <main className="sf-pdp sf-product-page">
          <Container>
            <nav className="sf-pdp-breadcrumb" aria-label={t(locale, "product.details")}>
              <a href="/">{{ en: "Home", fr: "Accueil", ar: "الرئيسية" }[locale]}</a>
              {productCategoryTrail.map((section) => <a key={section.id} href={`/collections/${encodeURIComponent(section.key)}`}>{sectionLabel(locale, section.label)}</a>)}
              <span aria-current="page">{pdp?.name}</span>
            </nav>
            {productPageSections.filter((section) => section.enabled).map((section) => {
              if (section.type === "product_main") return <div className="sf-product-main-section" key={section.id}>{productDetails}{pdp && productSetting("show_facts") && (themeProductDetails || pdpFacts.length > 0) && <section className="sf-product-information">{themeProductDetails || <ProductFacts facts={pdpFacts} locale={locale} />}</section>}</div>;
              if (section.type === "product_assurances") return <section key={section.id} className="sf-product-assurance-band"><span>{sectionText(section, "first", locale) || t(locale, "trust.support")}</span><span>{sectionText(section, "second", locale) || t(locale, "trust.returns")}</span></section>;
              if (section.type === "related_products" && relatedProducts.length > 0) return <section key={section.id} className="sf-related-products" aria-labelledby={`sf-related-title-${section.id}`}><div className="sf-related-head"><span className="sf-products-kicker">{t(locale, "product.relatedEyebrow")}</span><h2 className="ds-display-3" id={`sf-related-title-${section.id}`}>{sectionText(section, "title", locale) || relatedFallback}</h2></div><div className="sf-grid">{relatedProducts.map((product) => <ProductCard key={product.id} product={product} locale={locale} section={sections.find((catalogSection) => catalogSection.id === product.section)} onOpen={openProductPage} onQuickAdd={quickAddProduct} />)}</div></section>;
              return null;
            })}
            {pdp?.slug && productSetting("show_rating") && <ProductReviews key={pdp.id} slug={pdp.slug} locale={locale} readOnly={config.demo?.enabled} />}
          </Container>
        </main>
      ) : currentPath.startsWith("/products/") ? (
        <main className="sf-page"><Container><div className="sf-catalog-state" role="status"><strong>{productMissing ? { en: "Product unavailable", fr: "Produit indisponible", ar: "المنتج غير متاح" }[locale] : t(locale, "catalog.loading")}</strong>{productMissing && <a className="ds-btn" href="/collections/all">{t(locale, "catalog.shopAll")}</a>}</div></Container></main>
      ) : catalogPageActive ? (
        <>
          {active !== "all" ? (
            <Hero
              locale={locale}
              eyebrow={activeCategoryTrail.slice(0, -1).map((section) => sectionLabel(locale, section.label)).join(" · ")}
              title={activeLabel}
              subtitle={activeCategoryBanner?.description || ""}
              cta=""
              mediaMode="banner"
            >
              {activeCategoryImage
                ? <OptimizedImage className="sf-configured-hero-image sf-category-banner-image" src={activeCategoryImage} widthHint={1600} widths={[640, 960, 1280, 1600, 2000]} sizes="100vw" alt={activeLabel} priority />
                : <span className="sf-category-banner-fallback" aria-hidden="true" />}
            </Hero>
          ) : catalogSections.filter((section) => section.enabled && (section.type === "hero" || section.type === "slideshow")).map((section) => {
            if (section.type === "slideshow") return <Slideshow key={section.id} slides={section.settings.slides as StorefrontSlide[]} locale={locale} autoplay={section.settings.autoplay === true} interval={Number(section.settings.interval)} />;
            const imageUrl = String(section.settings.image_url || "");
            return (
              <Hero
                key={section.id}
                locale={locale}
                eyebrow={sectionText(section, "eyebrow", locale)}
                title={sectionText(section, "title", locale) || config.storeName}
                subtitle={sectionText(section, "subtitle", locale)}
                cta={sectionText(section, "cta_label", locale)}
                ctaHref={String(section.settings.cta_url || "#products")}
                mediaMode={imageUrl ? "banner" : "split"}
              >
                {imageUrl ? <OptimizedImage className="sf-configured-hero-image" src={imageUrl} widthHint={1600} widths={[640, 960, 1280, 1600, 2000]} sizes="100vw" alt={sectionText(section, "title", locale) || config.storeName} priority /> : null}
              </Hero>
            );
          })}
          {catalogSections.filter((section) => section.enabled && section.type === "promotional_banner").map((section) => <PromotionalBanner key={section.id} section={section} locale={locale} />)}
        </>
      ) : contactPageActive ? (
        <ContactPage locale={locale} />
      ) : configuredPageActive ? (
        <>
          {configuredSections.filter((section) => section.enabled && section.type !== "announcement").map((section) => {
            if (section.type === "slideshow") return <Slideshow key={section.id} slides={section.settings.slides as StorefrontSlide[]} locale={locale} autoplay={section.settings.autoplay === true} interval={Number(section.settings.interval)} />;
            if (section.type === "hero") {
              const imageUrl = String(section.settings.image_url || "");
              return (
                <Hero
                  key={section.id}
                  locale={locale}
                  eyebrow={sectionText(section, "eyebrow", locale)}
                  title={sectionText(section, "title", locale) || config.storeName}
                  subtitle={sectionText(section, "subtitle", locale)}
                  cta={sectionText(section, "cta_label", locale)}
                  ctaHref={String(section.settings.cta_url || "#products")}
                  mediaMode={imageUrl ? "banner" : "split"}
                >
                  {imageUrl
                    ? <OptimizedImage className="sf-configured-hero-image" src={imageUrl} widthHint={1600} widths={[640, 960, 1280, 1600, 2000]} sizes="100vw" alt={sectionText(section, "title", locale) || config.storeName} priority />
                    : configuredPageKey === "home"
                      ? <HeroCatalogVisual products={allProducts} locale={locale} />
                      : null}
                </Hero>
              );
            }
            if (section.type === "promotional_banner") return <PromotionalBanner key={section.id} section={section} locale={locale} />;
            if (section.type === "collections") {
              return (
                <CollectionHighlights
                  key={section.id}
                  id="collections"
                  sections={sections}
                  products={allProducts}
                  locale={locale}
                  onSelect={setActive}
                  title={sectionText(section, "title", locale)}
                  limit={Number(section.settings.limit) || 6}
                />
              );
            }
            if (section.type === "products") {
              const selectedProducts = selectHomepageProducts(
                allProducts,
                String(section.settings.source || "featured") as HomepageProductSource,
                Number(section.settings.limit) || 8,
              );
              return (
                <section key={section.id} className={`sf-products sf-home-products is-${String(section.settings.layout || "grid")}`} id="products">
                  <Container>
                    <div className="sf-products-head">
                      <h2 className="ds-display-3">{sectionText(section, "title", locale)}</h2>
                      <span className="sf-count">{selectedProducts.length}</span>
                    </div>
                    {error && <div className="sf-catalog-state"><strong>{t(locale, "catalog.unavailable")}</strong><span>{t(locale, "catalog.unavailableDetail")}</span><button type="button" className="ds-btn" onClick={retryCatalog}>{t(locale, "catalog.retry")}</button></div>}
                    {loading && <div className="sf-grid sf-grid-loading" aria-label={t(locale, "catalog.loading")}>{Array.from({ length: 4 }, (_, index) => <div className="sf-card-skeleton" key={index}><span /><i /><i /></div>)}</div>}
                    {!loading && !error && selectedProducts.length === 0 && <div className="sf-catalog-state"><strong>{t(locale, "misc.emptySection")}</strong></div>}
                    {!loading && <div className="sf-grid">
                      {selectedProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          locale={locale}
                          section={sections.find((catalogSection) => catalogSection.id === product.section)}
                          onOpen={openProductPage}
                          onQuickAdd={quickAddProduct}
                        />
                      ))}
                    </div>}
                  </Container>
                </section>
              );
            }
            if (section.type === "theme_feature") {
              const settings = themeFeatureSettings(section, config.design);
              if (!themeSection || !settings) return null;
              const safeSection = { ...section, settings: { ...section.settings, ...settings } };
              return <div key={section.id}>{themeSection(safeSection, { products: allProducts, sections, locale, config })}</div>;
            }
            if (section.type === "image_text") {
              const imageUrl = String(section.settings.image_url || "");
              const ctaLabel = sectionText(section, "cta_label", locale);
              return (
                <section key={section.id} className={`sf-image-text is-${String(section.settings.alignment || "image_first")}`}>
                  <Container className="sf-image-text-inner">
                    <div className="sf-image-text-media">{imageUrl ? <OptimizedImage src={imageUrl} widthHint={1200} widths={[480, 720, 960, 1200]} sizes="(max-width: 760px) 100vw, 50vw" alt="" /> : <span aria-hidden="true" />}</div>
                    <div className="sf-image-text-copy">
                      <h2 className="ds-display-3">{sectionText(section, "title", locale)}</h2>
                      <RichText html={sectionText(section, "body", locale)} className="ds-body" />
                      {ctaLabel && <a className="ds-btn ds-btn-primary" href={String(section.settings.cta_url || "#products")}>{ctaLabel}</a>}
                    </div>
                  </Container>
                </section>
              );
            }
            if (section.type === "newsletter") return config.demo?.enabled ? null : <div key={section.id}>{newsletter ? newsletter({ products: allProducts, sections, locale, config }) : <Newsletter locale={locale} title={sectionText(section, "title", locale)} subtitle={sectionText(section, "body", locale)} />}</div>;
            return null;
          })}
        </>
      ) : typeof hero === "function" ? (
        <section id="top" className="sf-hero sf-hero-custom sf-banner-fade">{(hero as StorefrontSectionRenderer)({ products: allProducts, sections, locale, config })}</section>
      ) : isValidElement(hero) ? (
        <section id="top" className="sf-hero sf-hero-custom sf-banner-fade">
          <Container>
            {hero}
            {heroChildren}
          </Container>
        </section>
      ) : (
        <Hero locale={locale} {...(hero as { eyebrow?: string; title?: string; subtitle?: string; cta?: string })}>
          {heroChildren ?? <HeroCatalogVisual products={allProducts} locale={locale} />}
        </Hero>
      )}
      {!dedicatedAccount && !productPageActive && !configuredPageActive && !catalogPageActive && <TrustStrip locale={locale} />}
      {!dedicatedAccount && !productPageActive && !configuredPageActive && !catalogPageActive && showProducts && <CollectionHighlights sections={sections} products={allProducts} locale={locale} onSelect={setActive} />}

      {dedicatedAccount || productPageActive || configuredPageActive ? null : showProducts || catalogPageActive ? (
        <section className="sf-products" id="products">
          <Container>
            {catalogPageActive && <nav className="sf-collection-breadcrumb" aria-label={t(locale, "nav.all")}><a href="/">{{ en: "Home", fr: "Accueil", ar: "الرئيسية" }[locale]}</a>{activeCategoryTrail.map((section, index) => <span key={section.id} className="sf-breadcrumb-step"><span aria-hidden="true">/</span>{index < activeCategoryTrail.length - 1 ? <a href={`/collections/${encodeURIComponent(section.key)}`}>{sectionLabel(locale, section.label)}</a> : <span aria-current="page">{sectionLabel(locale, section.label)}</span>}</span>)}{activeCategoryTrail.length === 0 && <span className="sf-breadcrumb-step"><span aria-hidden="true">/</span><span aria-current="page">{query.trim() ? `${t(locale, "catalog.search")}: ${query.trim()}` : t(locale, "catalog.shopAll")}</span></span>}</nav>}
            <div className="sf-products-head">
              <div><span className="sf-products-kicker">{t(locale, "catalog.discover")}</span><h2 className="ds-display-3">{activeLabel}</h2></div>
              <span className="sf-count">{catalogTotal}</span>
            </div>
            <CatalogToolbar locale={locale} query={query} sort={sort} count={visible.length} onQuery={setQuery} onSort={setSort} suggestions={query.trim() ? visible.slice(0, 5) : []} onSelectSuggestion={openProductPage} />
            <div className={`sf-catalog-layout${sections.length > 0 || catalogFacets.length > 0 || premiumCatalog ? " has-filters" : ""}`}>
              <CatalogFilters locale={locale} categories={sections.map((section) => ({ key: section.key, label: sectionLabel(locale, section.label) }))} categoryTotal={catalogTotal} activeCategory={active} onCategory={setActive} facets={catalogFacets} selection={facetSelection} showCommerce={premiumCatalog} stock={stockFilter} stockCounts={stockCounts} priceBounds={priceBounds} priceRange={priceRange} onStock={setStockFilter} onPriceRange={setPriceRange} onClear={() => { setActive("all"); setFacetSelection({}); setStockFilter("all"); setPriceRange(null); }} onToggle={(key, value) => setFacetSelection((current) => { const values = current[key] ?? []; const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; return { ...current, [key]: next }; })} />
              <div className="sf-catalog-result-panel">
                {error && <div className="sf-catalog-state"><strong>{t(locale, "catalog.unavailable")}</strong><span>{t(locale, "catalog.unavailableDetail")}</span><button type="button" className="ds-btn" onClick={retryCatalog}>{t(locale, "catalog.retry")}</button></div>}
                {loading && <div className="sf-grid sf-grid-loading" aria-label={t(locale, "catalog.loading")}>{Array.from({ length: 8 }, (_, index) => <div className="sf-card-skeleton" key={index}><span /><i /><i /></div>)}</div>}
                {visible.length === 0 && !error && !loading && <div className="sf-catalog-state"><strong>{query ? t(locale, "catalog.noResults") : t(locale, "catalog.noFilterResults")}</strong><button type="button" className="ds-btn" onClick={() => { setQuery(""); setFacetSelection({}); setStockFilter("all"); setPriceRange(null); }}>{t(locale, "catalog.clearFilters")}</button></div>}
                {!loading && <div className="sf-grid">
                  {displayedProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      locale={locale}
                      section={sections.find((section) => section.id === p.section)}
                      onOpen={openProductPage}
                      onQuickAdd={quickAddProduct}
                    />
                  ))}
                </div>}
                {hasMore && !featuredHome && !loading && !error && <button type="button" className="ds-btn sf-load-more" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? t(locale, "catalog.loading") : t(locale, "catalog.loadMore")}</button>}
                {loadingMore && <span className="sf-load-status" role="status">{t(locale, "catalog.loading")}</span>}
                {featuredHome && (displayedProducts.length < visible.length || hasMore) && <a className="sf-shop-all" href="/collections/all">{t(locale, "catalog.shopAll")} <IconArrow rtl={dir(locale) === "rtl"} /></a>}
              </div>
            </div>
          </Container>
        </section>
      ) : (
        <section className="sf-page" id="products">
          <Container>{page}</Container>
        </section>
      )}

      {!dedicatedAccount && !productPageActive && !configuredPageActive && !catalogPageActive && !homeSections.some((section) => Boolean(themeFeatureSettings(section, config.design))) && (typeof extraBand === "function"
        ? (extraBand as StorefrontSectionRenderer)({ products: allProducts, sections, locale, config })
        : extraBand)}

      {!config.demo?.enabled && !dedicatedAccount && !productPageActive && !configuredPageActive && (newsletter ? newsletter({ products: allProducts, sections, locale, config }) : <Newsletter locale={locale} />)}
      {footer ? footer({ products: allProducts, sections, locale, config }) : <StoreFooter locale={locale} sections={sections} />}

      {pdp && !productPageActive && (
        <div className={`sf-pdp-overlay${quickAddClosing ? " is-closing" : ""}`} onClick={requestQuickAddClose}>
          <div ref={quickAddModalRef} className="sf-pdp-modal" role="dialog" aria-modal="true" aria-labelledby="sf-quick-add-title" onClick={(e) => e.stopPropagation()}>
            <button className="sf-icon-btn sf-pdp-close" onClick={requestQuickAddClose} aria-label={{ en: "Close", fr: "Fermer", ar: "إغلاق" }[locale]}>
              <IconClose />
            </button>
            {productDetails}
          </div>
        </div>
      )}

      <CartDrawer
        open={drawerOpen}
        onClose={closeCart}
        items={cart}
        locale={locale}
        onQty={setQty}
        onRemove={removeItem}
        onCheckout={requestCheckout}
      />

      {checkoutOpen && <Suspense fallback={<div className="sf-checkout-loading" role="status">{t(locale, "catalog.loading")}</div>}><CheckoutFlow
        open={checkoutOpen}
        onClose={closeCheckout}
        items={cart}
        locale={locale}
        service={service}
        onOrderComplete={clearCart}
      /></Suspense>}

      {demoPromptOpen && <div className="sf-demo-gate" role="presentation" onClick={() => setDemoPromptOpen(false)}>
        <section className="sf-demo-gate-card" role="dialog" aria-modal="true" aria-labelledby="sf-demo-gate-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="sf-icon-btn sf-demo-gate-close" onClick={() => setDemoPromptOpen(false)} aria-label={{ en: "Close", fr: "Fermer", ar: "إغلاق" }[locale]}><IconClose /></button>
          <span className="sf-demo-gate-kicker">TijaraGO</span>
          <h2 id="sf-demo-gate-title">{{ en: "This is a demonstration store", fr: "Ceci est une boutique de démonstration", ar: "هذا متجر تجريبي" }[locale]}</h2>
          <p>{{ en: "Explore the full shopping experience, then create your own store when you are ready to sell.", fr: "Explorez toute l’expérience, puis créez votre boutique lorsque vous êtes prêt à vendre.", ar: "استكشف تجربة التسوق كاملة، ثم أنشئ متجرك عندما تصبح جاهزاً للبيع." }[locale]}</p>
          <a className="ds-btn ds-btn-primary" href={config.demo?.signupUrl} target="_top">{{ en: "Create your store", fr: "Créer votre boutique", ar: "أنشئ متجرك" }[locale]}</a>
        </section>
      </div>}

      {children}

      {toast && <div className="sf-toast" role="status">{toast}</div>}
    </div>
  );
}
