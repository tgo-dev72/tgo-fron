import type { Product } from "../api/types";
import type { StoreConfig } from "../config";
import type { Locale } from "../i18n";

const SEO_JSON_ID = "storefront-structured-data";

function storeOrigin(config: StoreConfig): string {
  const candidate = config.canonicalOrigin?.trim() || config.domain?.trim();
  if (!candidate) return "";
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).origin;
  } catch {
    return "";
  }
}

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}

function setFavicon(logoUrl?: string | null) {
  if (!logoUrl) return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = logoUrl;
}

function setStructuredData(value: Record<string, unknown>) {
  let script = document.getElementById(SEO_JSON_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = SEO_JSON_ID;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(value);
}

function setDocumentBasics(locale: Locale, indexingAllowed = false) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  upsertMeta('meta[name="robots"]', "name", "robots", indexingAllowed ? "index, follow, max-image-preview:large" : "noindex, nofollow, noarchive");
}

function applyMetadata(title: string, description: string, canonical: string, image?: string) {
  document.title = title;
  upsertMeta('meta[name="description"]', "name", "description", description);
  upsertMeta('meta[property="og:title"]', "property", "og:title", title);
  upsertMeta('meta[property="og:description"]', "property", "og:description", description);
  upsertMeta('meta[property="og:type"]', "property", "og:type", image ? "product" : "website");
  upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
  upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", image ? "summary_large_image" : "summary");
  upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
  upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  if (image) {
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
  } else {
    document.head.querySelector('meta[property="og:image"]')?.remove();
    document.head.querySelector('meta[name="twitter:image"]')?.remove();
  }
  setCanonical(canonical);
}

const STORE_DESCRIPTIONS: Record<Locale, (name: string) => string> = {
  en: (name) => `Discover products and shop securely from ${name}.`,
  fr: (name) => `Découvrez les produits et achetez en toute confiance chez ${name}.`,
  ar: (name) => `اكتشف المنتجات وتسوق بثقة من ${name}.`,
};

export function setStorefrontSeo(config: StoreConfig, locale: Locale) {
  setDocumentBasics(locale, config.indexingAllowed);
  setFavicon(config.logoUrl);
  const canonical = `${storeOrigin(config)}/`;
  const description = config.seo?.description || STORE_DESCRIPTIONS[locale](config.storeName);
  applyMetadata(config.seo?.title || config.storeName, description, canonical, config.seo?.socialImage);
  setStructuredData({
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: config.storeName,
    url: canonical,
    email: config.contactEmail || undefined,
    telephone: config.phone || undefined,
  });
}

export function setCollectionSeo(config: StoreConfig, locale: Locale, key: string, label: string) {
  setDocumentBasics(locale, config.indexingAllowed);
  setFavicon(config.logoUrl);
  const canonical = `${storeOrigin(config)}/collections/${encodeURIComponent(key)}`;
  const title = `${label} | ${config.storeName}`;
  const description = STORE_DESCRIPTIONS[locale](config.storeName);
  applyMetadata(title, description, canonical);
  setStructuredData({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: label,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: config.storeName, url: `${storeOrigin(config)}/` },
  });
}

export function setProductSeo(config: StoreConfig, locale: Locale, product: Product, price: number) {
  setDocumentBasics(locale, config.indexingAllowed);
  setFavicon(config.logoUrl);
  const canonical = `${storeOrigin(config)}/products/${encodeURIComponent(product.slug || String(product.id))}`;
  const title = product.seo_title || `${product.name} | ${config.storeName}`;
  const description = (product.seo_description || product.description || STORE_DESCRIPTIONS[locale](config.storeName)).slice(0, 200);
  const image = product.images[0]?.image;
  applyMetadata(title, description, canonical, image);
  setStructuredData({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    image: product.images.map((item) => item.image).filter(Boolean),
    sku: product.ref || undefined,
    aggregateRating:
      product.reviews_count > 0
        ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviews_count }
        : undefined,
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: config.currency,
      price,
      availability:
        product.track_inventory === false || product.variants.some((variant) => variant.available_quantity > 0)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  });
}


export function setAccountSeo(config: StoreConfig, locale: Locale) {
  setDocumentBasics(locale, false);
  setFavicon(config.logoUrl);
  const label = { en: "Customer account", fr: "Compte client", ar: "حساب العميل" }[locale];
  applyMetadata(`${label} | ${config.storeName}`, label, `${storeOrigin(config)}/`);
  upsertMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow");
  document.getElementById(SEO_JSON_ID)?.remove();
}
