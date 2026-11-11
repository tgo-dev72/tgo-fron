import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { AttributeDef, AttributeOption, CatalogSection, Product, Variant } from "../api/types";
import { api } from "../api/client";
import { brandColor, shippingCharge, type StoreConfig, type StorefrontAnnouncementItem, type StorefrontHomepageSection } from "../config";
import { dir, formatPrice, sectionLabel, t } from "../i18n";
import type { Locale } from "../i18n";
import { useStoreConfig } from "./context";
import { Container, Eyebrow } from "../system/primitives";
import type { CatalogFacet, CatalogFacetSelection, CatalogSort, ProductFact } from "./catalog";
import { OptimizedImage, optimizedImageSrcSet, optimizedImageUrl } from "../media/image";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

export const imgUrl = (url: string, width?: number) => optimizedImageUrl(url, { width });
export const imgSrcSet = (url: string, widths?: number[]) => optimizedImageSrcSet(url, widths);

export function AnnouncementBar({ section, locale }: { section: StorefrontHomepageSection; locale: Locale }) {
  const configured = Array.isArray(section.settings.items) ? section.settings.items as StorefrontAnnouncementItem[] : [];
  const legacy: StorefrontAnnouncementItem[] = configured.length ? [] : [{ id: section.id, text: section.settings.text as Record<Locale, string> ?? { en: "", fr: "", ar: "" }, link_label: section.settings.link_label as Record<Locale, string> ?? { en: "", fr: "", ar: "" }, link_url: String(section.settings.link_url || "") }];
  const items = (configured.length ? configured : legacy).filter((item) => item.text?.[locale]?.trim() || item.text?.en?.trim());
  const renderItems = (suffix = "") => items.map((item) => {
    const text = item.text[locale]?.trim() || item.text.en?.trim();
    const label = item.link_label[locale]?.trim() || item.link_label.en?.trim();
    const content = <><span>{text}</span>{label && <strong>{label}</strong>}</>;
    return item.link_url ? <a key={`${item.id}${suffix}`} className="sf-announcement-item" href={item.link_url.replace(/^#\//, "/")}>{content}</a> : <span key={`${item.id}${suffix}`} className="sf-announcement-item">{content}</span>;
  });
  if (!items.length) return null;
  if (items.length === 1) return <div className="sf-announcement-static">{renderItems()}</div>;
  return <div className="sf-announcement-marquee" aria-label={items.map((item) => item.text[locale] || item.text.en).join(" · ")}><div className="sf-announcement-track">{renderItems("-a")}{renderItems("-b")}</div></div>;
}

// Storefronts are deployed as isolated theme bundles, so assets from sibling
// applications are not available in their output. Keep the platform mark on
// the canonical showroom origin shared by every generated storefront.
const TIJARAGO_WHITE_LOGO = "https://www.tijarago.com/brand/logos/tyjara-go-white.svg";

export function TijaraGoPoweredBy({ locale }: { locale: Locale }) {
  return (
    <aside className="sf-tijarago-signature" aria-label={`${t(locale, "footer.poweredBy")} TijaraGO`}>
      <a className={locale === "ar" ? "is-rtl" : undefined} href="https://www.tijarago.com" target="_blank" rel="noopener noreferrer">
        <span dir={locale === "ar" ? "rtl" : "ltr"}>{t(locale, "footer.poweredBy")}</span>
        <span className="sf-tijarago-signature-brand" dir="ltr">
          <img className="sf-tijarago-signature-logo" src={TIJARAGO_WHITE_LOGO} alt="" />
          <strong>TijaraGO</strong>
        </span>
      </a>
    </aside>
  );
}

const RICH_TEXT_TAGS = new Set(["A", "B", "BLOCKQUOTE", "BR", "EM", "H2", "H3", "I", "LI", "OL", "P", "S", "STRIKE", "STRONG", "U", "UL", "MARK"]);
const RICH_TEXT_DROP_TAGS = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG"]);
const RICH_TEXT_MARKUP = /<(?:a|b|blockquote|br|em|h2|h3|i|li|mark|ol|p|s|strike|strong|u|ul)(?:\s|>|\/)/i;

function escapeRichText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function richTextHref(value: string): string {
  const href = value.trim();
  return /^(?:https?:|mailto:|tel:|\/(?!\/)|#)/i.test(href) && !/[\u0000-\u0020\\]/.test(href) ? href : "";
}

/** Defense-in-depth for descriptions received from the API. The API applies
 * the same allow-list, but storefronts never trust persisted HTML blindly. */
export function sanitizeRichTextHtml(value: string): string {
  if (!value) return "";
  if (!RICH_TEXT_MARKUP.test(value)) return escapeRichText(value).replace(/\r?\n/g, "<br>");
  if (typeof document === "undefined") return escapeRichText(value);

  const source = document.createElement("template");
  source.innerHTML = value;
  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (!(node instanceof HTMLElement) || RICH_TEXT_DROP_TAGS.has(node.tagName)) return null;
    const children = document.createDocumentFragment();
    for (const child of Array.from(node.childNodes)) {
      const cleanChild = cleanNode(child);
      if (cleanChild) children.appendChild(cleanChild);
    }
    if (!RICH_TEXT_TAGS.has(node.tagName)) return children;
    const element = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === "A") {
      const href = richTextHref(node.getAttribute("href") ?? "");
      if (href) {
        element.setAttribute("href", href);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (["P", "H2", "H3"].includes(node.tagName)) {
      const align = /^\s*text-align:\s*(left|center|right|justify)\s*;?\s*$/i.exec(node.getAttribute("style") ?? "");
      if (align) element.setAttribute("style", `text-align: ${align[1].toLowerCase()}`);
    }
    element.appendChild(children);
    return element;
  };

  const output = document.createElement("div");
  for (const child of Array.from(source.content.childNodes)) {
    const cleanChild = cleanNode(child);
    if (cleanChild) output.appendChild(cleanChild);
  }
  return output.innerHTML;
}

export function RichText({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`sf-rich-text ${className}`.trim()} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }} />;
}

export function salePrice(p: Pick<Product, "price" | "promo" | "compare_at_price">): number {
  if (p.compare_at_price != null && p.compare_at_price > p.price) return p.price;
  return p.promo > 0 ? Math.round(p.price * (1 - p.promo / 100) * 100) / 100 : p.price;
}

export function discountPercent(p: Pick<Product, "price" | "promo" | "compare_at_price">): number {
  if (p.compare_at_price != null && p.compare_at_price > p.price) {
    return Math.round((1 - p.price / p.compare_at_price) * 100);
  }
  return p.promo;
}

export function hasStock(variants: Variant[], trackInventory = true): boolean {
  if (!trackInventory) return variants.length > 0;
  return variants.some((v) => v.available_quantity > 0);
}

/** Product-aware stock check. Simple products expose product-level inventory;
 * configurable products are available when at least one real combination is. */
export function productHasStock(product: Product): boolean {
  if (product.track_inventory === false) return true;
  if (product.uses_variants === false) {
    const fallback = product.variants.find((variant) => Object.keys(variant.attributes ?? {}).length === 0);
    return Number(product.inventory ?? fallback?.available_quantity ?? 0) > 0;
  }
  return hasStock(product.variants, true);
}

/** Public delivery copy follows the configured shipping policy. */
export function shippingText(config: StoreConfig, locale: Locale): string {
  const threshold = config.freeShippingThreshold;
  if (shippingCharge(config, 0) === 0) return t(locale, "trust.freeShipping");
  return threshold != null
    ? t(locale, "trust.shipping", formatPrice(threshold, locale, config.currency))
    : t(locale, "trust.shippingFee", formatPrice(shippingCharge(config, 0), locale, config.currency));
}

export type Selection = Record<string, string | string[]>;

function selectionMatches(selection: Selection, v: Variant): boolean {
  for (const [k, sel] of Object.entries(selection)) {
    if (sel === undefined || sel === null || sel === "" || sel.length === 0) continue;
    const vval = v.attributes[k];
    if (Array.isArray(sel)) {
      if (Array.isArray(vval)) {
        if (!sel.every((s) => vval.includes(s))) return false;
      } else if (sel[0] !== undefined && String(vval ?? "") !== sel[0]) return false;
    } else if (Array.isArray(vval)) {
      if (!vval.includes(sel)) return false;
    } else if (vval === undefined || String(vval) !== sel) return false;
  }
  return true;
}

/** Availability for a picker option only depends on choices made at this
 * level and earlier levels. Later choices are cleared when an earlier option
 * changes, allowing shoppers to move from e.g. Red/S to Blue/M. */
export function variantOptionAvailable(
  product: Product,
  definitions: AttributeDef[],
  definitionIndex: number,
  selection: Selection,
  optionValue: string,
): boolean {
  const definition = definitions[definitionIndex];
  if (!definition) return false;
  const candidate: Selection = {};
  definitions.slice(0, definitionIndex).forEach((earlier) => {
    const value = selection[earlier.key];
    if (value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0)) candidate[earlier.key] = value;
  });
  if (definition.type === "multi") {
    const current = selection[definition.key];
    const values = Array.isArray(current) ? current : current ? [String(current)] : [];
    candidate[definition.key] = values.includes(optionValue) ? values : [...values, optionValue];
  } else candidate[definition.key] = optionValue;
  return product.variants.some((variant) => (product.track_inventory === false || variant.available_quantity > 0) && selectionMatches(candidate, variant));
}

export function findVariant(product: Product, selection: Selection): Variant | undefined {
  return product.variants.find((variant) => {
    if (product.track_inventory !== false && variant.available_quantity <= 0) return false;
    // Partial matching is useful for option availability, but adding a SKU
    // requires every one of that SKU's axes to have a visible selection.
    const complete = Object.keys(variant.attributes).every((key) => {
      const value = selection[key];
      return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
    });
    return complete && selectionMatches(selection, variant);
  });
}

/** The default selection contains SKU-defining values only. Product facts must
 * never participate in variant matching. */
export function initialSelection(product: Product, sections: CatalogSection[]): Selection {
  const section = sections.find((s) => s.id === product.section);
  const sel: Selection = {};
  const firstAvailableVariant = product.track_inventory === false
    ? product.variants[0]
    : product.variants.find((variant) => variant.available_quantity > 0) ?? product.variants[0];
  // Product-owned definitions are authoritative for imported/custom choices
  // such as Fragrance or Material. Category definitions are only a legacy
  // fallback and may not contain those axes at all.
  for (const def of orderedVariantDefinitions(product, section)) {
    const val = firstAvailableVariant?.attributes[def.key];
    if (val !== undefined && val !== null) sel[def.key] = Array.isArray(val) ? [...val] : String(val);
  }
  return sel;
}

/** Options actually configured on this product's variants. The retail schema
 * may contain a much larger catalogue of possible values; those are editor
 * suggestions and must not leak onto an individual product page. */
export function productVariantOptions(product: Product, definition: AttributeDef): AttributeOption[] {
  const configuredOptions = new Map(definition.options.map((option) => [String(option.value), option]));
  const values = product.variants.flatMap((variant) => {
    const value = variant.attributes[definition.key];
    if (value === undefined || value === null || value === "") return [];
    return (Array.isArray(value) ? value : [value]).map(String);
  });
  return [...new Set(values)].map((value) => {
    const configured = configuredOptions.get(value);
    const result: AttributeOption = { value, label: configured?.label ?? value };
    if (configured?.swatch) result.swatch = configured.swatch;
    return result;
  });
}

/** Commerce-first option order. Colour establishes the visual SKU first,
 * size narrows that choice second, and every other attribute keeps the
 * merchant's configured order. */
export function orderedVariantDefinitions(product: Product, section?: CatalogSection): AttributeDef[] {
  const priority = (definition: AttributeDef) => {
    const key = definition.key.toLocaleLowerCase();
    if (definition.type === "color" || ["color", "colour", "couleur", "coloris"].includes(key)) return 0;
    if (key === "size" || key.endsWith("_size") || key.startsWith("size_")) return 1;
    return 2;
  };
  const definitions: AttributeDef[] = product.variant_options?.length
    ? product.variant_options.map((option, index) => ({
        id: -(index + 1),
        key: option.key,
        label: option.label,
        type: option.type,
        level: "variant",
        options: option.values.map((optionValue) => typeof optionValue === "string"
          ? { value: optionValue, label: optionValue }
          : {
              value: optionValue.value,
              label: optionValue.label || optionValue.value,
              ...(optionValue.swatch ? { swatch: optionValue.swatch } : {}),
            }),
        required: true,
        sort_order: index,
      }))
    : section?.attribute_defs ?? [];
  return definitions
    .filter((definition) =>
      definition.level === "variant"
        && ["select", "color", "multi", "number", "text"].includes(definition.type)
        && productVariantOptions(product, definition).length > 0,
    )
    .sort((left, right) => priority(left) - priority(right) || left.sort_order - right.sort_order || left.id - right.id);
}

const NAMED_SWATCHES: Record<string, string> = {
  bordeaux: "#6d071a",
  blush: "#de5d83",
  camel: "#c19a6b",
  coral: "#ff7f50",
  ivory: "#fffff0",
  lemon: "#fff44f",
  mint: "#98ff98",
  natural: "#d8c3a5",
  nude: "#e3bc9a",
  "rose gold": "#b76e79",
  sky: "#87ceeb",
  tan: "#d2b48c",
  walnut: "#773f1a",
};

function swatchColor(value: string): string {
  return NAMED_SWATCHES[value.trim().toLocaleLowerCase()] ?? value;
}

/** Localized, human-readable summary of a variant's attributes (e.g. "Navy · M"). */
export function variantLabel(product: Product, variant: Variant | undefined, sections: CatalogSection[]): string {
  if (!variant) return "";
  const section = sections.find((s) => s.id === product.section);
  const defs = orderedVariantDefinitions(product, section);
  const labelFor = (defKey: string, value: string): string => {
    const def = defs.find((d) => d.key === defKey);
    const opt = def?.options.find((o) => o.value === value);
    return opt ? opt.label : value;
  };
  return Object.entries(variant.attributes)
    .map(([k, v]) => {
      const parts = Array.isArray(v) ? v.map((x) => String(x)) : [String(v)];
      return parts.map((p) => labelFor(k, p)).join(" / ");
    })
    .join(" · ");
}

/* ------------------------------------------------------------------ */
/* icons (inline, zero deps)                                          */
/* ------------------------------------------------------------------ */

/**
 * One cohesive stroke family: 24px grid, 1.7px stroke, rounded caps/joins.
 * Every icon shares the same optical weight so chrome reads as a system,
 * not as copy-pasted snippets.
 */
function Svg({ children, size = 17, style }: { children: ReactNode; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Shopping bag with a folded rim and handle — the cart mark. */
export function IconCart() {
  return (
    <Svg size={19}>
      <path d="M5.6 7.6h12.8l-.85 11.4a2.1 2.1 0 0 1-2.1 1.9H8.55a2.1 2.1 0 0 1-2.1-1.9L5.6 7.6Z" />
      <path d="M8.9 10V6.9a3.1 3.1 0 0 1 6.2 0V10" />
      <path d="M8.9 13.4h6.2" />
    </Svg>
  );
}
export function IconClose() {
  return (
    <Svg>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}
export function IconSearch() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}
export function IconMenu() {
  return (
    <Svg>
      <path d="M4 7.5h16M4 12h16M4 16.5h10" />
    </Svg>
  );
}
export function IconArrow({ rtl = false }: { rtl?: boolean }) {
  return (
    <Svg>
      <path d={rtl ? "M19 12H5M10 7l-5 5 5 5" : "M5 12h14M14 7l5 5-5 5"} />
    </Svg>
  );
}
export function IconMail() {
  return (
    <Svg>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7.5 8.5 5.5 8.5-5.5" />
    </Svg>
  );
}
export function IconPhone() {
  return (
    <Svg>
      <path d="M7.2 3.8 10 7.1 8.4 9.5c1.2 2.5 3.2 4.5 5.7 5.7l2.4-1.6 3.3 2.8-.8 3.1c-.2.7-.9 1.2-1.7 1.1C9.9 19.7 4.3 14.1 3.4 6.7c-.1-.8.4-1.5 1.1-1.7l2.7-1.2Z" />
    </Svg>
  );
}
export function IconCheck() {
  return (
    <Svg>
      <path d="m5 12 5 5L20 7" />
    </Svg>
  );
}
export function IconTruck() {
  return (
    <Svg>
      <path d="M3 7.5h11v8.5H3z" />
      <path d="M14 10h3.2l2.3 3v3H14z" />
      <circle cx="7.2" cy="17.4" r="1.4" />
      <circle cx="16.8" cy="17.4" r="1.4" />
    </Svg>
  );
}
export function IconReturn() {
  return (
    <Svg>
      <path d="M4 7.5h13a4 4 0 0 1 0 8h-6" />
      <path d="m7.5 11-3.5 3.5L7.5 18" />
    </Svg>
  );
}
export function IconHeart() {
  return (
    <Svg>
      <path d="M12 19.8S4.4 16 4.4 10.6C4.4 8.1 6.2 6 8.7 6c1.4 0 2.7.7 3.3 1.9C12.6 6.7 13.9 6 15.3 6c2.5 0 4.3 2.1 4.3 4.6 0 5.4-7.6 9.2-7.6 9.2Z" />
    </Svg>
  );
}
/** Shield with a check — secure payments mark. */
export function IconShield() {
  return (
    <Svg>
      <path d="M12 3.5 5 6v5.4c0 4.3 3 7.4 7 9.1 4-1.7 7-4.8 7-9.1V6l-7-2.5Z" />
      <path d="m9 11.7 2.2 2.2 3.9-4.1" />
    </Svg>
  );
}
/** Filled star for ratings. */
export function IconStar({ filled = true }: { filled?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
    </svg>
  );
}
/** Globe with meridians — language switcher mark. */
export function IconGlobe() {
  return (
    <Svg size={15}>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M3.7 12h16.6" />
      <path d="M12 3.7c2.6 2.4 3.9 5.3 3.9 8.3s-1.3 5.9-3.9 8.3c-2.6-2.4-3.9-5.3-3.9-8.3s1.3-5.9 3.9-8.3Z" />
      <path d="M5.2 7.3a7.9 7.9 0 0 0 0 9.4M18.8 7.3a7.9 7.9 0 0 1 0 9.4" />
    </Svg>
  );
}
/** Head-and-shoulders — human support mark. */
export function IconUser() {
  return (
    <Svg>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.5 19.5c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5" />
    </Svg>
  );
}
/** Credit card — online payment mark. */
export function IconCard() {
  return (
    <Svg>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M6 14.5h4" />
    </Svg>
  );
}
/** Parcel — cash-on-delivery mark. */
export function IconPackage() {
  return (
    <Svg>
      <path d="m12 3 8 4v10l-8 4-8-4V7l8-4Z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </Svg>
  );
}

export type SocialChannel = NonNullable<StoreConfig["socialLinks"]> extends Partial<Record<infer Channel, string>>
  ? Channel & string
  : never;

export const socialChannelLabels: Record<SocialChannel | "whatsapp", string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
};

function contactPhoneLabel(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("212")) {
    return `+212 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return value.trim();
}

/** Compact brand marks for merchant-configured contact channels. */
export function SocialIcon({ channel }: { channel: SocialChannel | "whatsapp" }) {
  return (
    <svg className="sf-social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {channel === "whatsapp" && <path d="M12.04 2a9.84 9.84 0 0 0-8.46 14.85L2.05 22l5.28-1.49A9.95 9.95 0 1 0 12.04 2Zm0 17.93a8 8 0 0 1-4.08-1.12l-.29-.17-3.13.88.84-3.05-.19-.31a7.95 7.95 0 1 1 6.85 3.77Zm4.37-5.96c-.24-.12-1.41-.69-1.63-.77-.22-.08-.38-.12-.54.12-.16.24-.61.77-.75.93-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.19a7.2 7.2 0 0 1-1.33-1.65c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.73-1.78-.2-.47-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.41-.58 1.61-1.13.2-.56.2-1.03.14-1.13-.06-.1-.22-.16-.46-.28Z" />}
      {channel === "facebook" && <path d="M13.5 21v-8h2.75l.41-3.1H13.5V7.92c0-.9.25-1.51 1.58-1.51h1.69V3.64a22.7 22.7 0 0 0-2.46-.13c-2.44 0-4.11 1.49-4.11 4.22V9.9H7.44V13h2.76v8h3.3Z" />}
      {channel === "instagram" && <><path fillRule="evenodd" d="M7.1 2h9.8A5.1 5.1 0 0 1 22 7.1v9.8a5.1 5.1 0 0 1-5.1 5.1H7.1A5.1 5.1 0 0 1 2 16.9V7.1A5.1 5.1 0 0 1 7.1 2Zm-.18 2A2.92 2.92 0 0 0 4 6.92v10.16A2.92 2.92 0 0 0 6.92 20h10.16A2.92 2.92 0 0 0 20 17.08V6.92A2.92 2.92 0 0 0 17.08 4H6.92ZM12 7.1A4.9 4.9 0 1 1 12 16.9 4.9 4.9 0 0 1 12 7.1Zm0 2A2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" /><circle cx="17.45" cy="6.55" r="1.15" /></>}
      {channel === "linkedin" && <path d="M5.25 8.35H2.18V21h3.07V8.35ZM3.72 2A1.79 1.79 0 1 0 3.7 5.58 1.79 1.79 0 0 0 3.72 2ZM21.82 13.75c0-3.81-2.03-5.59-4.75-5.59a4.1 4.1 0 0 0-3.73 2.05V8.35h-3.07V21h3.07v-6.26c0-1.65.31-3.25 2.36-3.25 2.02 0 2.05 1.89 2.05 3.36V21h3.07v-7.25Z" />}
      {channel === "pinterest" && <path d="M12 2a10 10 0 0 0-3.64 19.31c-.09-.79-.17-2 .04-2.86l1.17-4.96s-.3-.6-.3-1.48c0-1.39.81-2.43 1.81-2.43.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.49 1.81 1.79 0 3.16-1.89 3.16-4.61 0-2.41-1.73-4.1-4.21-4.1-2.87 0-4.55 2.15-4.55 4.38 0 .87.33 1.8.75 2.3.08.1.09.18.07.29l-.28 1.13c-.05.18-.15.22-.35.13-1.3-.61-2.11-2.51-2.11-4.04 0-3.29 2.39-6.31 6.89-6.31 3.62 0 6.43 2.58 6.43 6.02 0 3.6-2.27 6.49-5.42 6.49-1.06 0-2.05-.55-2.39-1.2l-.65 2.47c-.23.91-.87 2.05-1.3 2.74.98.3 2.02.46 3.1.46A10 10 0 0 0 12 2Z" />}
      {channel === "tiktok" && <path d="M15.7 2c.17 1.49 1 2.83 2.28 3.61A6.1 6.1 0 0 0 21 6.5v3.15a9.18 9.18 0 0 1-5.23-1.62v7.3A6.68 6.68 0 1 1 10 8.72v3.2a3.5 3.5 0 1 0 2.58 3.38V2h3.12Z" />}
      {channel === "x" && <path d="M4.04 3h4.91l3.83 5.11L17.34 3h1.62l-5.43 6.26L20.57 21h-4.9l-4.4-5.87L6.17 21H4.55l5.97-7.03L4.04 3Zm3.85 1.4H6.83l9.78 15.2h1.06L7.89 4.4Z" />}
      {channel === "youtube" && <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77A26.05 26.05 0 0 0 2 12a26.05 26.05 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.05 26.05 0 0 0 22 12a26.05 26.05 0 0 0-.42-4.81ZM10 15V9l5.2 3L10 15Z" />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* price                                                              */
/* ------------------------------------------------------------------ */

export function Price({
  product,
  locale,
  className = "",
}: {
  product: Pick<Product, "price" | "promo" | "compare_at_price">;
  locale: Locale;
  className?: string;
}) {
  const config = useStoreConfig();
  const final = salePrice(product);
  return (
    <span className={`sf-price ${className}`}>
      {product.compare_at_price != null && product.compare_at_price > product.price
        ? <s className="sf-price-strike">{formatPrice(product.compare_at_price, locale, config.currency)}</s>
        : product.promo > 0 && <s className="sf-price-strike">{formatPrice(product.price, locale, config.currency)}</s>}
      <span className="sf-price-final">{formatPrice(final, locale, config.currency)}</span>
    </span>
  );
}

export function SaveBadge({ product, locale }: { product: Pick<Product, "price" | "promo" | "compare_at_price">; locale: Locale }) {
  const percentage = discountPercent(product);
  if (percentage <= 0) return null;
  return <span className="ds-badge sf-save-badge">{t(locale, "product.save", percentage)}</span>;
}

/* ------------------------------------------------------------------ */
/* nav / hero / sections                                              */
/* ------------------------------------------------------------------ */

export function Hero({
  locale,
  eyebrow,
  title,
  subtitle,
  cta,
  ctaHref = "#products",
  children,
  mediaMode = "split",
  showOverlay = true,
  showText = true,
  showButton = true,
}: {
  locale: Locale;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  ctaHref?: string;
  children?: ReactNode;
  mediaMode?: "split" | "banner";
  showOverlay?: boolean;
  showText?: boolean;
  showButton?: boolean;
}) {
  const isRtl = dir(locale) === "rtl";
  const ctaLabel = showButton ? (cta === undefined ? t(locale, "hero.cta") : cta.trim()) : "";
  const isBanner = Boolean(children) && mediaMode === "banner";
  return (
    <section id="top" className={`sf-hero sf-banner-fade ${children ? "has-media" : "is-copy-only"}${isBanner ? " is-banner" : ""}`}>
      {isBanner && <div className="sf-hero-media sf-hero-banner-media">{children}</div>}
      {isBanner && (showOverlay || (showText && (eyebrow || title || subtitle)) || ctaLabel) && <div className={`sf-hero-banner-overlay${showOverlay ? "" : " is-clear"}`}><div>
        {showText && eyebrow && <span className="sf-hero-banner-eyebrow">{eyebrow}</span>}
        {showText && title && <h1 className="sf-hero-banner-title">{title}</h1>}
        {showText && subtitle && <RichText html={subtitle} className="sf-hero-banner-subtitle" />}
        {ctaLabel && <a className="ds-btn sf-hero-banner-cta" href={ctaHref}>{ctaLabel} <IconArrow rtl={isRtl} /></a>}
      </div></div>}
      {!isBanner && <Container>
        <div className="sf-hero-layout">
          {(showText || ctaLabel) && <div className="sf-hero-copy">
            {showText && <>
            <Eyebrow>{eyebrow ?? t(locale, "hero.eyebrow")}</Eyebrow>
            <h1 className="ds-display-1 sf-hero-title">{title ?? t(locale, "hero.title")}</h1>
            <RichText html={subtitle ?? t(locale, "hero.subtitle")} className="ds-lead sf-hero-sub" />
            </>}
            {ctaLabel && <a
              className="ds-btn ds-btn-primary sf-hero-cta"
              href={ctaHref}
              onClick={(e) => {
                if (ctaHref.length > 1 && ctaHref.startsWith("#") && document.querySelector(ctaHref)) {
                  e.preventDefault();
                  document.querySelector(ctaHref)?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              {ctaLabel} <IconArrow rtl={isRtl} />
            </a>}
          </div>}
          {children && !isBanner && <div className="sf-hero-media">{children}</div>}
        </div>
      </Container>}
    </section>
  );
}

export function HeroCatalogVisual({ products, locale }: { products: Product[]; locale: Locale }) {
  const items = products.filter((product) => product.images.length > 0).slice(0, 3);
  return (
    <div className={`sf-hero-catalog ${items.length === 0 ? "is-placeholder" : ""}`} aria-label={t(locale, "catalog.preview")}>
      {(items.length > 0 ? items : products.slice(0, 3)).map((product, index) => {
        const image = product.images.find((item) => item.is_primary) ?? product.images[0];
        return (
          <div className={`sf-hero-catalog-card card-${index + 1}`} key={product.id}>
            {image ? <OptimizedImage src={image.image} widthHint={720} widths={[480, 720, 960]} sizes="(max-width: 760px) 72vw, 30vw" alt={t(locale, "misc.alt", product.name)} priority={index === 0} /> : <ArtPlaceholder label={product.ref} />}
            <span>{product.name}</span>
          </div>
        );
      })}
      {products.length === 0 && <><i /><i /><i /></>}
    </div>
  );
}

export function SectionTabs({
  sections,
  locale,
  active,
  onSelect,
}: {
  sections: CatalogSection[];
  locale: Locale;
  active: string;
  onSelect: (key: string) => void;
}) {
  const items = [
    { key: "all", label: t(locale, "nav.all") },
    ...sections.map((s) => ({ key: s.key, label: sectionLabel(locale, s.label) })),
  ];
  return (
    <div className="sf-tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={active === it.key}
          className={`sf-tab ${active === it.key ? "is-active" : ""}`}
          onClick={() => onSelect(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function CatalogToolbar({
  locale,
  query,
  sort,
  count,
  onQuery,
  onSort,
  suggestions = [],
  onSelectSuggestion,
}: {
  locale: Locale;
  query: string;
  sort: CatalogSort;
  count: number;
  onQuery: (value: string) => void;
  onSort: (value: CatalogSort) => void;
  suggestions?: Product[];
  onSelectSuggestion?: (product: Product) => void;
}) {
  return (
    <div className="sf-catalog-toolbar">
      <div className="sf-catalog-search">
        <span aria-hidden="true"><IconSearch /></span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t(locale, "catalog.search")}
          aria-label={t(locale, "catalog.search")}
        />
        {query && <button type="button" onClick={() => onQuery("")} aria-label={t(locale, "catalog.clear")}><IconClose /></button>}
        {query.trim() && suggestions.length > 0 && onSelectSuggestion && (
          <div className="sf-search-suggestions" role="listbox" aria-label={t(locale, "catalog.suggestions")}>
            <small>{t(locale, "catalog.suggestions")}</small>
            {suggestions.map((product) => {
              const image = product.images.find((item) => item.is_primary) ?? product.images[0];
              return <button type="button" role="option" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onQuery(""); onSelectSuggestion(product); }}>
                <div className="sf-search-suggestion-media">{image ? <OptimizedImage src={image.image} widthHint={160} widths={[96, 160, 240]} sizes="80px" alt="" /> : <ArtPlaceholder label={product.ref} />}</div>
                <div className="sf-search-suggestion-copy"><strong>{product.name}</strong><Price product={product} locale={locale} /></div>
                <IconArrow rtl={dir(locale) === "rtl"} />
              </button>;
            })}
          </div>
        )}
      </div>
      <div className="sf-catalog-controls">
        <span className="sf-catalog-results">{t(locale, count === 1 ? "catalog.result" : "catalog.results", count)}</span>
        <label className="sf-catalog-sort">
          <span>{t(locale, "catalog.sort")}</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as CatalogSort)}>
            <option value="featured">{t(locale, "catalog.featured")}</option>
            <option value="newest">{t(locale, "catalog.newest")}</option>
            <option value="price-low">{t(locale, "catalog.priceLow")}</option>
            <option value="price-high">{t(locale, "catalog.priceHigh")}</option>
            <option value="rating">{t(locale, "catalog.rating")}</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export function CatalogFilters({
  locale,
  categories = [],
  categoryTotal = 0,
  activeCategory = "all",
  onCategory,
  facets,
  selection,
  onToggle,
  onClear,
  showCommerce = false,
  stock = "all",
  stockCounts = { inStock: 0, outOfStock: 0 },
  priceBounds = [0, 0],
  priceRange = priceBounds,
  onStock,
  onPriceRange,
}: {
  locale: Locale;
  categories?: { key: string; label: string }[];
  categoryTotal?: number;
  activeCategory?: string;
  onCategory?: (key: string) => void;
  facets: CatalogFacet[];
  selection: CatalogFacetSelection;
  onToggle: (key: string, value: string) => void;
  onClear: () => void;
  showCommerce?: boolean;
  stock?: "all" | "in-stock" | "out-of-stock";
  stockCounts?: { inStock: number; outOfStock: number };
  priceBounds?: [number, number];
  priceRange?: [number, number];
  onStock?: (value: "all" | "in-stock" | "out-of-stock") => void;
  onPriceRange?: (value: [number, number] | null) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = useStoreConfig();
  if (categories.length === 0 && facets.length === 0 && !showCommerce) return null;
  const priceChanged = showCommerce && (priceRange[0] !== priceBounds[0] || priceRange[1] !== priceBounds[1]);
  const activeCount = Number(activeCategory !== "all")
    + Object.values(selection).reduce((count, values) => count + values.length, 0)
    + Number(stock !== "all") + Number(priceChanged);
  const clampRange = (minimum: number, maximum: number): [number, number] => [
    Math.max(priceBounds[0], Math.min(minimum, maximum)),
    Math.min(priceBounds[1], Math.max(maximum, minimum)),
  ];
  return (
    <aside className={`sf-catalog-filters${mobileOpen ? " is-mobile-open" : ""}`} aria-label={t(locale, "catalog.filters")}>
      <button type="button" className="sf-filter-mobile-toggle" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>{t(locale, "catalog.filters")}{activeCount > 0 ? ` (${activeCount})` : ""}<span aria-hidden="true">{mobileOpen ? "−" : "+"}</span></button>
      <div className="sf-filter-head">
        <strong>{t(locale, "catalog.filters")}</strong>
        {activeCount > 0 && <button type="button" onClick={onClear}>{t(locale, "catalog.clearFilters")} ({activeCount})</button>}
      </div>
      {categories.length > 0 && <details open>
        <summary>{t(locale, "catalog.categories")}<span>{activeCategory === "all" ? "" : "1"}</span></summary>
        <div className="sf-filter-options sf-category-options">
          <label className={activeCategory === "all" ? "is-selected" : ""}><input type="radio" name="catalog-category" checked={activeCategory === "all"} onChange={() => onCategory?.("all")} /><span>{t(locale, "nav.all")}</span><small>{categoryTotal}</small></label>
          {categories.map((category) => <label key={category.key} className={activeCategory === category.key ? "is-selected" : ""}>
            <input type="radio" name="catalog-category" checked={activeCategory === category.key} onChange={() => onCategory?.(category.key)} />
            <span>{category.label}</span>
          </label>)}
        </div>
      </details>}
      {showCommerce && <details open>
        <summary>{t(locale, "catalog.availability")}<span>{stock === "all" ? "" : "1"}</span></summary>
        <div className="sf-filter-options sf-stock-options">
          <label className={stock === "all" ? "is-selected" : ""}><input type="radio" name="catalog-stock" checked={stock === "all"} onChange={() => onStock?.("all")} /><span>{t(locale, "catalog.allAvailability")}</span><small>{stockCounts.inStock + stockCounts.outOfStock}</small></label>
          <label className={stock === "in-stock" ? "is-selected" : ""}><input type="radio" name="catalog-stock" checked={stock === "in-stock"} onChange={() => onStock?.("in-stock")} /><span>{t(locale, "product.inStock")}</span><small>{stockCounts.inStock}</small></label>
          <label className={stock === "out-of-stock" ? "is-selected" : ""}><input type="radio" name="catalog-stock" checked={stock === "out-of-stock"} onChange={() => onStock?.("out-of-stock")} /><span>{t(locale, "product.outOfStock")}</span><small>{stockCounts.outOfStock}</small></label>
        </div>
      </details>}
      {showCommerce && priceBounds[1] > priceBounds[0] && <details open>
        <summary>{t(locale, "catalog.price")}<span>{priceChanged ? "1" : ""}</span></summary>
        <div className="sf-price-filter">
          <div className="sf-price-filter-values"><output>{formatPrice(priceRange[0], locale, config.currency)}</output><span aria-hidden="true">—</span><output>{formatPrice(priceRange[1], locale, config.currency)}</output></div>
          <div className="sf-price-filter-sliders">
            <input type="range" min={priceBounds[0]} max={priceBounds[1]} step="1" value={priceRange[0]} aria-label={t(locale, "catalog.minimumPrice")} onChange={(event) => onPriceRange?.(clampRange(Number(event.target.value), priceRange[1]))} />
            <input type="range" min={priceBounds[0]} max={priceBounds[1]} step="1" value={priceRange[1]} aria-label={t(locale, "catalog.maximumPrice")} onChange={(event) => onPriceRange?.(clampRange(priceRange[0], Number(event.target.value)))} />
          </div>
        </div>
      </details>}
      {facets.map((facet) => (
        <details key={facet.key} open>
          <summary>{facet.label}<span>{selection[facet.key]?.length || ""}</span></summary>
          <div className={`sf-filter-options is-${facet.type}`}>
            {facet.options.map((option) => {
              const checked = selection[facet.key]?.includes(option.value) ?? false;
              const booleanLabel = facet.type === "boolean"
                ? t(locale, option.value === "true" ? "misc.yes" : "misc.no")
                : option.label;
              const swatch = option.swatch ?? (facet.type === "color" && /^#[0-9a-f]{3,8}$/i.test(option.value) ? option.value : undefined);
              return <label key={option.value} className={checked ? "is-selected" : ""}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(facet.key, option.value)} />
                {facet.type === "color" && <i style={swatch ? { backgroundColor: swatch } : undefined} aria-hidden="true" />}
                <span>{booleanLabel}</span>
                <small>{option.count}</small>
              </label>;
            })}
          </div>
        </details>
      ))}
    </aside>
  );
}

export function CollectionHighlights({
  sections,
  products,
  locale,
  onSelect,
  title,
  limit = 4,
  id,
}: {
  sections: CatalogSection[];
  products: Product[];
  locale: Locale;
  onSelect: (key: string) => void;
  title?: string;
  limit?: number;
  id?: string;
}) {
  if (sections.length < 2) return null;
  return (
    <section id={id} className="sf-collections" aria-label={t(locale, "catalog.categories")}>
      <Container>
        <div className="sf-collections-head">
          <span>{t(locale, "catalog.categories")}</span>
          <strong>{title || t(locale, "catalog.shopByCategory")}</strong>
        </div>
        <div className="sf-collections-grid">
          {sections.slice(0, Math.max(1, Math.min(24, limit))).map((section) => {
            const sectionProducts = products.filter((product) => product.section === section.id || product.categories?.some((category) => category.id === section.id));
            const featured = sectionProducts.find((product) => product.images.length > 0);
            const image = featured?.images.find((item) => item.is_primary) ?? featured?.images[0];
            return (
              <button
                type="button"
                className="sf-collection-card"
                key={section.id}
                onClick={() => {
                  onSelect(section.key);
                  window.setTimeout(() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }), 40);
                }}
              >
                <span className="sf-collection-media">{image ? <OptimizedImage src={image.image} widthHint={640} widths={[320, 480, 640]} sizes="(max-width: 680px) 80vw, 30vw" alt="" /> : <i aria-hidden="true" />}</span>
                <span className="sf-collection-copy">
                  <strong>{sectionLabel(locale, section.label)}</strong>
                  <small>{t(locale, sectionProducts.length === 1 ? "catalog.result" : "catalog.results", sectionProducts.length)}</small>
                </span>
                <IconArrow rtl={dir(locale) === "rtl"} />
              </button>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* product card + gallery                                             */
/* ------------------------------------------------------------------ */

function ArtPlaceholder({ label }: { label: string }) {
  return (
    <div className="sf-art-placeholder" aria-label={label}>
      <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="800" height="1000" fill="var(--ds-color-surface-2)" />
        <path d="M0 1000 800 0M0 800 800 -200M0 900 900 0M0 700 700 0" stroke="var(--ds-color-border-strong)" strokeWidth="1.5" />
        <text
          x="400"
          y="520"
          textAnchor="middle"
          fontSize="34"
          fontFamily="var(--ds-font-mono)"
          letterSpacing="4"
          fill="var(--ds-color-ink-3)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

export function Gallery({
  product,
  locale,
  thumbnails = true,
  selectedImage,
}: {
  product: Product;
  locale: Locale;
  thumbnails?: boolean;
  selectedImage?: Product["images"][number] | null;
}) {
  const [activeId, setActiveId] = useState<number>(product.images.find((i) => i.is_primary)?.id ?? product.images[0]?.id ?? 0);
  const [failedImage, setFailedImage] = useState("");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);
  const [interactionVersion, setInteractionVersion] = useState(0);
  const dragStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const thumbnailsRef = useRef<HTMLDivElement | null>(null);
  const images = useMemo(
    () => selectedImage && !product.images.some((image) => image.id === selectedImage.id)
      ? [...product.images, selectedImage] : product.images,
    [product.images, selectedImage],
  );
  const labels = {
    en: { previous: "Previous product image", next: "Next product image", image: "Product image" },
    fr: { previous: "Image précédente du produit", next: "Image suivante du produit", image: "Image du produit" },
    ar: { previous: "صورة المنتج السابقة", next: "صورة المنتج التالية", image: "صورة المنتج" },
  }[locale];
  useEffect(() => {
    if (selectedImage) setActiveId(selectedImage.id);
  }, [selectedImage?.id]);
  useEffect(() => {
    setActiveId(product.images.find((image) => image.is_primary)?.id ?? product.images[0]?.id ?? 0);
  }, [product.id]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    const updateVisibility = () => setPageHidden(document.hidden);
    updateMotion();
    updateVisibility();
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  const activeIndex = Math.max(0, images.findIndex((image) => image.id === activeId));
  const selectIndex = (nextIndex: number, interacted = true) => {
    if (images.length < 2) return;
    const normalized = (nextIndex + images.length) % images.length;
    setActiveId(images[normalized].id);
    if (interacted) setInteractionVersion((version) => version + 1);
  };
  useEffect(() => {
    if (images.length < 2 || hovered || focused || dragging || reducedMotion || pageHidden) return;
    const timer = window.setInterval(() => {
      setActiveId((currentId) => {
        const currentIndex = Math.max(0, images.findIndex((image) => image.id === currentId));
        return images[(currentIndex + 1) % images.length].id;
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [images, hovered, focused, dragging, reducedMotion, pageHidden, interactionVersion]);
  useEffect(() => {
    const activeThumbnail = thumbnailsRef.current?.querySelector<HTMLElement>(`[data-image-id="${activeId}"]`);
    activeThumbnail?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  }, [activeId, reducedMotion]);
  if (images.length === 0) {
    return <ArtPlaceholder label={product.ref} />;
  }
  return (
    <figure
      className="sf-gallery"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        className={`sf-gallery-main ${dragging ? "is-dragging" : ""}`}
        role="region"
        aria-roledescription="carousel"
        aria-label={t(locale, "misc.alt", product.name)}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerUp={(event) => {
          const start = dragStart.current;
          dragStart.current = null;
          setDragging(false);
          if (!start || start.pointerId !== event.pointerId) return;
          const deltaX = event.clientX - start.x;
          const deltaY = event.clientY - start.y;
          if (Math.abs(deltaX) >= 42 && Math.abs(deltaX) > Math.abs(deltaY)) {
            selectIndex(activeIndex + (deltaX < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => {
          dragStart.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => {
          dragStart.current = null;
          setDragging(false);
        }}
      >
        <div className="sf-gallery-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }} aria-live="off">
          {images.map((image, index) => {
            const imageUrl = imgUrl(image.image, 1280);
            return (
              <div className="sf-gallery-slide" key={image.id} aria-hidden={index !== activeIndex}>
                {failedImage === imageUrl
                  ? <ArtPlaceholder label={product.ref} />
                  : <OptimizedImage src={image.image} widthHint={1280} widths={[480, 720, 960, 1280, 1600]} sizes="(max-width: 760px) 100vw, 55vw" alt={index === activeIndex ? t(locale, "misc.alt", product.name) : ""} priority={index === 0} onError={() => setFailedImage(imageUrl)} />}
              </div>
            );
          })}
        </div>
        {images.length > 1 && <>
          <button type="button" className="sf-gallery-arrow sf-gallery-arrow--previous" aria-label={labels.previous} onClick={() => selectIndex(activeIndex - 1)}><span aria-hidden="true">‹</span></button>
          <button type="button" className="sf-gallery-arrow sf-gallery-arrow--next" aria-label={labels.next} onClick={() => selectIndex(activeIndex + 1)}><span aria-hidden="true">›</span></button>
          <span className="sf-gallery-count" aria-hidden="true">{activeIndex + 1} / {images.length}</span>
        </>}
      </div>
      {thumbnails && images.length > 1 && (
        <div className="sf-gallery-thumbs" ref={thumbnailsRef} aria-label={labels.image}>
          {images.map((img, index) => (
            <button
              key={img.id}
              className={`sf-gallery-thumb ${index === activeIndex ? "is-active" : ""}`}
              data-image-id={img.id}
              onClick={() => selectIndex(index)}
              aria-label={`${labels.image} ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              <OptimizedImage src={img.image} widthHint={160} widths={[96, 160, 240]} sizes="80px" alt="" />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}

export function ProductCard({
  product,
  locale,
  section,
  onOpen,
  onQuickAdd,
}: {
  product: Product;
  locale: Locale;
  section?: CatalogSection;
  onOpen: (p: Product) => void;
  onQuickAdd: (p: Product) => void;
}) {
  const stock = productHasStock(product);
  const theme = useStoreConfig().design;
  const primary = product.images.find((i) => i.is_primary) ?? product.images[0];
  const secondary = product.images.find((image) => image.id !== primary?.id);
  const [failedPrimary, setFailedPrimary] = useState(false);
  const [failedSecondary, setFailedSecondary] = useState(false);
  useEffect(() => { setFailedPrimary(false); setFailedSecondary(false); }, [primary?.image, secondary?.image]);
  const attribute = (key: string) => typeof product.attributes[key] === "string" ? String(product.attributes[key]) : "";
  const requiresOptions = product.uses_variants !== false && product.variants.length > 0;
  const fashionColors = theme === "fashion" ? [...new Set(product.variants.map((variant) => String(variant.attributes.color ?? "")).filter(Boolean))].slice(0, 5) : [];
  const techSpecs = theme === "electronics" ? [attribute("display"), attribute("ram"), attribute("storage"), attribute("connectivity")].filter((item) => item && item !== "—").slice(0, 2) : [];
  return (
    <article className={`sf-card sf-card-${theme}`}>
      <button className="sf-card-media" onClick={() => onOpen(product)} aria-label={product.name}>
        {primary && !failedPrimary ? (
          <OptimizedImage className={secondary && !failedSecondary ? "sf-card-image-primary" : undefined} src={primary.image} widthHint={640} widths={[320, 480, 640, 960]} sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 25vw" alt={t(locale, "misc.alt", product.name)} onError={() => setFailedPrimary(true)} />
        ) : (
          <ArtPlaceholder label={product.ref} />
        )}
        {secondary && !failedSecondary && <OptimizedImage className="sf-card-image-secondary" src={secondary.image} widthHint={640} widths={[320, 480, 640, 960]} sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 25vw" alt="" aria-hidden="true" onError={() => setFailedSecondary(true)} />}
        {!stock && <span className="sf-out-badge">{t(locale, "product.outOfStock")}</span>}
        <SaveBadge product={product} locale={locale} />
        {discountPercent(product) > 0 && <span className="sf-promo-dot" aria-hidden="true" />}
        <span className="sf-card-view">{t(locale, "product.viewDetails")}</span>
      </button>
      <div className="sf-card-body">
        {section && <span className="sf-card-section">{theme === "electronics" && attribute("brand") ? attribute("brand") : sectionLabel(locale, section.label)}</span>}
        <h3 className="sf-card-name">{product.name}</h3>
        {product.reviews_count > 0 && (
          <span className="sf-card-rating" aria-label={`${product.rating.toFixed(1)} · ${t(locale, "product.reviews", product.reviews_count)}`}>
            <IconStar />
            {product.rating.toFixed(1)}
            <em>{t(locale, "product.reviews", product.reviews_count)}</em>
          </span>
        )}
        {theme === "beauty" && attribute("benefits") && <span className="sf-card-benefit">{attribute("benefits")}</span>}
        {theme === "fashion" && fashionColors.length > 0 && <span className="sf-card-swatches" aria-label={fashionColors.join(", ")}>{fashionColors.map((color) => <i key={color} title={color} style={{ backgroundColor: swatchColor(color) }} />)}</span>}
        {techSpecs.length > 0 && <span className="sf-card-specs">{techSpecs.join(" · ")}</span>}
        <span className="sf-card-meta">
          {product.loyalty_points > 0 && t(locale, "product.loyalty", product.loyalty_points)}
          {product.promo > 0 && " · "}
          {product.promo > 0 && t(locale, "product.save", product.promo)}
        </span>
        <div className="sf-card-commerce">
          <Price product={product} locale={locale} />
          <button type="button" className={`sf-card-add ${requiresOptions ? "is-options" : ""}`} disabled={!stock} onClick={() => onQuickAdd(product)}>
            <span>{stock ? t(locale, requiresOptions ? "product.chooseOptions" : "product.quickAdd") : t(locale, "product.outOfStock")}</span>
            {stock && <span className="sf-card-add-icon" aria-hidden="true">{requiresOptions ? "→" : "+"}</span>}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductFacts({ facts, locale }: { facts: ProductFact[]; locale: Locale }) {
  if (facts.length === 0) return null;
  return (
    <section className="sf-pdp-facts" aria-label={t(locale, "product.details")}>
      <h2>{t(locale, "product.details")}</h2>
      <dl>
        {facts.map((fact) => (
          <div key={fact.key}>
            <dt>{fact.label}</dt>
            <dd>{fact.value === "true" ? t(locale, "misc.yes") : fact.value === "false" ? t(locale, "misc.no") : fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* variant picker                                                     */
/* ------------------------------------------------------------------ */

export function VariantPicker({
  product,
  section,
  selection,
  onChange,
  locale: _locale,
}: {
  product: Product;
  section?: CatalogSection;
  selection: Selection;
  onChange: (sel: Selection) => void;
  locale: Locale;
}) {
  if (product.uses_variants === false) return null;
  const defs = orderedVariantDefinitions(product, section);
  if (defs.length === 0 || product.variants.length === 0) return null;

  const toggle = (definitionIndex: number, defKey: string, isMulti: boolean, value: string) => {
    const cur = selection[defKey];
    const next: Selection = { ...selection };
    if (isMulti) {
      const arr = Array.isArray(cur) ? [...cur] : cur ? [String(cur)] : [];
      next[defKey] = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    } else {
      next[defKey] = cur === value ? "" : value;
    }
    defs.slice(definitionIndex + 1).forEach((later) => { delete next[later.key]; });
    onChange(next);
  };

  return (
    <div className="sf-picker">
      {defs.map((def, definitionIndex) => {
        const options = productVariantOptions(product, def);
        const isMulti = def.type === "multi";
        const cur = selection[def.key];
        const selected = Array.isArray(cur) ? cur : cur ? [cur] : [];
        return (
          <div key={def.key} className={`sf-picker-group ${def.key.toLocaleLowerCase().includes("size") ? "is-size" : ""}`}>
            <span className="sf-picker-label">
              {def.label}
              {def.required && <em className="sf-picker-required">*</em>}
            </span>
            <div className={`sf-picker-options sf-picker-${def.type}`} role={def.type === "multi" ? "group" : "radiogroup"}>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                const disabled = !variantOptionAvailable(product, defs, definitionIndex, selection, opt.value);
                const visualVariant = product.variants.find((variant) => {
                  const value = variant.attributes?.[def.key];
                  return (Array.isArray(value) ? value.map(String).includes(opt.value) : String(value ?? "") === opt.value) && variant.image;
                });
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`sf-opt ${isSelected ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
                    disabled={disabled}
                    onClick={() => toggle(definitionIndex, def.key, isMulti, opt.value)}
                    aria-pressed={isSelected}
                    role={isMulti ? "checkbox" : "radio"}
                    aria-checked={isSelected}
                  >
                    {visualVariant?.image?.image ? (
                      <><img className="sf-option-image" src={imgUrl(visualVariant.image.image, 96)} alt="" aria-hidden="true" /><span>{opt.label}</span></>
                    ) : def.type === "color" ? (
                      <><span className="sf-swatch" style={{ backgroundColor: opt.swatch ?? swatchColor(opt.value) }} aria-hidden="true" /><span>{opt.label}</span></>
                    ) : (
                      opt.label
                    )}
                    {isSelected && <IconCheck />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* cart drawer                                                        */
/* ------------------------------------------------------------------ */

export interface CartItem {
  key: string;
  product: Product;
  variantId: number | null;
  variantLabel: string;
  qty: number;
  unitPrice: number;
  maxQty: number;
}

export function CartDrawer({
  open,
  onClose,
  items,
  locale,
  onQty,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  locale: Locale;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
}) {
  const config = useStoreConfig();
  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const threshold = config.freeShippingThreshold;
  const free = shippingCharge(config, subtotal) === 0;
  const progress = free ? 1 : threshold != null && threshold > 0 ? Math.min(1, subtotal / threshold) : 0;
  const cartTitle = config.design === "atelier"
    ? ({ en: "Your shopping bag", fr: "Votre panier", ar: "حقيبة التسوق" } as const)[locale]
    : t(locale, "cart.title");
  return (
    <>
      <div className={`sf-overlay ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sf-cart ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="sf-cart-head">
          <h2 className="sf-cart-title">{cartTitle}</h2>
          <button className="sf-icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="sf-cart-empty">{t(locale, "cart.empty")}</p>
        ) : (
          <>
            <div className="sf-cart-items">
              {items.map((it) => (
                <div key={it.key} className="sf-cart-item">
                  <div className="sf-cart-item-img">
                    {it.product.images[0] ? (
                       <OptimizedImage src={it.product.images[0].image} widthHint={240} widths={[120, 180, 240]} sizes="96px" alt={it.product.name} />
                    ) : (
                      <ArtPlaceholder label={it.product.ref} />
                    )}
                  </div>
                  <div className="sf-cart-item-info">
                    <span className="sf-cart-item-name">{it.product.name}</span>
                    <span className="sf-cart-item-variant">{it.variantLabel}</span>
                    <div className="sf-qty">
                      <button onClick={() => onQty(it.key, it.qty - 1)} aria-label="Decrease">
                        −
                      </button>
                      <span>{it.qty}</span>
                      <button onClick={() => onQty(it.key, it.qty + 1)} aria-label="Increase">
                        +
                      </button>
                    </div>
                  </div>
                  <div className="sf-cart-item-side">
                    <span className="sf-cart-item-price">
                      {formatPrice(it.unitPrice * it.qty, locale, config.currency)}
                    </span>
                    <button className="sf-cart-remove" onClick={() => onRemove(it.key)} aria-label="Remove">
                      <IconClose />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="sf-cart-foot">
              {config.design === "atelier" && <h3 className="sf-cart-summary-title">{({ en: "Order summary", fr: "Récapitulatif", ar: "ملخص الطلب" } as const)[locale]}</h3>}
              <div className="sf-ship-progress">
                {(free || threshold != null) && <div className="sf-ship-bar">
                  <span style={{ width: `${progress * 100}%` }} />
                </div>}
                <span className="sf-ship-note">
                  {free
                    ? t(locale, "cart.freeShipping")
                    : threshold != null
                      ? t(locale, "cart.shippingNote", formatPrice(threshold, locale, config.currency))
                      : shippingText(config, locale)}
                </span>
              </div>
              <div className="sf-cart-subtotal">
                <span>{t(locale, "cart.subtotal")}</span>
                <strong>{formatPrice(subtotal, locale, config.currency)}</strong>
              </div>
              <button className="ds-btn ds-btn-primary sf-checkout" onClick={onCheckout}>
                {t(locale, "cart.checkout")}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* newsletter / trust / footer                                        */
/* ------------------------------------------------------------------ */

export function Newsletter({ locale, title, subtitle }: { locale: Locale; title?: string; subtitle?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  return (
    <section className="sf-newsletter ds-band">
      <Container>
        <div className="sf-newsletter-inner">
          <div>
            <Eyebrow>{t(locale, "newsletter.eyebrow")}</Eyebrow>
            <h2 className="ds-display-3">{title || t(locale, "newsletter.title")}</h2>
            <RichText html={subtitle || t(locale, "newsletter.subtitle")} className="ds-body" />
          </div>
          <div className="sf-newsletter-action">
          {state === "done" ? (
            <div className="sf-newsletter-done">
              <IconCheck />
              {t(locale, "newsletter.done")}
            </div>
          ) : (
            <form
              className="sf-newsletter-form"
              aria-busy={state === "submitting"}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email.trim() || state === "submitting") return;
                setState("submitting");
                try {
                  await api.subscribe(email.trim());
                  setState("done");
                } catch {
                  setState("error");
                }
              }}
            >
              <IconMail />
              <input
                type="email"
                name="email"
                autoComplete="email"
                dir="auto"
                aria-label={t(locale, "newsletter.placeholder")}
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setState("idle");
                }}
                placeholder={t(locale, "newsletter.placeholder")}
              />
              <button type="submit" className="ds-btn ds-btn-on-band" disabled={state === "submitting"}>
                {t(locale, "newsletter.submit")}
              </button>
            </form>
          )}
          <p className="sf-newsletter-feedback" role="status" aria-live="polite">{state === "error" ? t(locale, "newsletter.error") : ""}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function TrustStrip({ locale }: { locale: Locale }) {
  const config = useStoreConfig();
  return (
    <div className="sf-trust">
      <Container className="sf-trust-inner">
        <span>
          <IconTruck />
          {shippingText(config, locale)}
        </span>
        <span>
          <IconReturn />
          {t(locale, "trust.returns")}
        </span>
        <span>
          <IconUser />
          {t(locale, "trust.support")}
        </span>
      </Container>
    </div>
  );
}

export function StoreFooter({ locale, sections }: { locale: Locale; sections: CatalogSection[] }) {
  const config = useStoreConfig();
  const footer = config.appearance?.footer;
  const copyright = footer?.copyright?.[locale]?.trim() || footer?.copyright?.en?.trim();
  const configuredPages = Object.entries(config.pages ?? {});
  const pageLabel = (pageKey: string, title: Record<string, string>) =>
    title[locale]?.trim() || title.en?.trim() || pageKey;
  const contentPages = configuredPages.filter(([pageKey, page]) =>
    page.type === "content" && pageKey !== "contact" && !/^contact(?:-us)?$/i.test(page.route.replace(/^\/+|\/+$/g, "")),
  );
  const policyPages = configuredPages.filter(([, page]) => page.type === "policy");
  const contactPage = configuredPages.find(([pageKey, page]) => pageKey === "contact" || /^contact(?:-us)?$/i.test(page.route.replace(/^\/+|\/+$/g, "")));
  const socialLinks = Object.entries(config.socialLinks ?? {}).filter((entry): entry is [SocialChannel, string] => Boolean(entry[1]));
  const formattedPhone = config.phone ? contactPhoneLabel(config.phone) : "";
  return <>
    <footer className="ds-footer sf-footer">
      <Container>
        <div className="ds-footer-grid">
          <div>
            <a className={`ds-wordmark sf-footer-brand${config.logoUrl ? " has-logo" : ""}`} href="/" onClick={() => window.scrollTo({ top: 0 })} aria-label={config.storeName}>
              {config.logoUrl
                ? <span className="sf-footer-logo-frame"><OptimizedImage className="sf-store-logo sf-footer-logo" src={config.logoUrl} widthHint={480} widths={[240, 320, 480]} sizes="(max-width: 600px) 180px, 240px" alt="" /></span>
                : <><span className="ds-wordmark-mark" style={{ background: brandColor(config) }} />{config.storeName}</>}
            </a>
            <p className="sf-footer-blurb" style={{ marginTop: 12, maxWidth: 260 }}>
              {t(locale, "hero.subtitle")}
            </p>
          </div>
          <div>
            <div className="ds-footer-head">{t(locale, "footer.shop")}</div>
            {sections.map((s) => (
              <a key={s.key} className="ds-footer-link" href={`/collections/${encodeURIComponent(s.key)}`}>
                {sectionLabel(locale, s.label)}
              </a>
            ))}
          </div>
          <div>
            <div className="ds-footer-head">{t(locale, "footer.company")}</div>
            {contentPages.length > 0
              ? contentPages.map(([pageKey, configuredPage]) => (
                <a key={pageKey} className="ds-footer-link" href={`/${configuredPage.route}`}>
                  {pageLabel(pageKey, configuredPage.title)}
                </a>
              ))
              : <a className="ds-footer-link" href="/" onClick={() => window.scrollTo({ top: 0 })}>{config.storeName}</a>}
          </div>
          <div>
            <div className="ds-footer-head">{t(locale, "footer.support")}</div>
            {policyPages.map(([pageKey, configuredPage]) => (
              <a key={pageKey} className="ds-footer-link" href={`/${configuredPage.route}`}>
                {pageLabel(pageKey, configuredPage.title)}
              </a>
            ))}
          </div>
          {((footer?.show_contact ?? true) && Boolean(config.contactEmail || config.phone || config.whatsappPhone) || (footer?.show_social_links ?? true) && socialLinks.length > 0) && (
            <div className="sf-footer-contact-column">
              <div className="ds-footer-head">{t(locale, "footer.contact")}</div>
              {contactPage && <a className="ds-footer-link sf-footer-contact-page-link" href={`/${contactPage[1].route}`}>{pageLabel(contactPage[0], contactPage[1].title)} <span aria-hidden="true">→</span></a>}
              {(footer?.show_contact ?? true) && config.contactEmail && <a className="ds-footer-link sf-footer-contact-link sf-footer-email" href={`mailto:${config.contactEmail}`}><span className="sf-contact-mark"><IconMail /></span><span>{config.contactEmail}</span></a>}
              {(footer?.show_contact ?? true) && config.phone && <a className="ds-footer-link sf-footer-contact-link sf-footer-phone" href={`tel:${config.phone}`}><span className="sf-contact-mark"><IconPhone /></span><bdi dir="ltr">{formattedPhone}</bdi></a>}
              {(footer?.show_contact ?? true) && config.whatsappPhone && <a className="ds-footer-link sf-footer-contact-link sf-footer-whatsapp" href={`https://wa.me/${config.whatsappPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><span className="sf-social-mark"><SocialIcon channel="whatsapp" /></span><span>WhatsApp</span></a>}
              {(footer?.show_social_links ?? true) && socialLinks.length > 0 && <div className="sf-footer-socials" aria-label={locale === "ar" ? "وسائل التواصل الاجتماعي" : locale === "fr" ? "Réseaux sociaux" : "Social media"}>
                {socialLinks.map(([channel, url]) => (
                  <a key={channel} className={`ds-footer-link sf-footer-social-link sf-social-${channel}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={socialChannelLabels[channel]}>
                    <span className="sf-social-mark"><SocialIcon channel={channel} /></span>
                    <span className="sf-social-label">{socialChannelLabels[channel]}</span>
                  </a>
                ))}
              </div>}
            </div>
          )}
        </div>
        <div className="ds-footer-bottom">
          <span>{copyright || `© ${new Date().getFullYear()} ${config.storeName}`}</span>
          <span>{config.domain}</span>
        </div>
      </Container>
    </footer>
    {(config.showPlatformAttribution ?? true) && <TijaraGoPoweredBy locale={locale} />}
  </>;
}

export function ContactPage({ locale }: { locale: Locale }) {
  const config = useStoreConfig();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const copy = {
    en: { eyebrow: "Contact us", title: "We’re here to help.", body: "Choose the easiest way to reach us, or send your question below.", name: "Your name", email: "Email address", phone: "Phone number (optional)", subject: "Subject", message: "How can we help?", send: "Send inquiry", sending: "Sending…", sent: "Thank you — your message has been sent.", error: "We couldn’t send your message. Please try again.", details: "Contact details" },
    fr: { eyebrow: "Contactez-nous", title: "Nous sommes à votre écoute.", body: "Choisissez le moyen le plus simple de nous joindre ou envoyez votre question ci-dessous.", name: "Votre nom", email: "Adresse e-mail", phone: "Téléphone (facultatif)", subject: "Objet", message: "Comment pouvons-nous vous aider ?", send: "Envoyer la demande", sending: "Envoi…", sent: "Merci — votre message a bien été envoyé.", error: "Votre message n’a pas pu être envoyé. Réessayez.", details: "Coordonnées" },
    ar: { eyebrow: "اتصل بنا", title: "نحن هنا لمساعدتك.", body: "اختر الطريقة الأنسب للتواصل معنا، أو أرسل استفسارك أدناه.", name: "الاسم", email: "البريد الإلكتروني", phone: "رقم الهاتف (اختياري)", subject: "الموضوع", message: "كيف يمكننا مساعدتك؟", send: "إرسال الاستفسار", sending: "جارٍ الإرسال…", sent: "شكراً — تم إرسال رسالتك بنجاح.", error: "تعذر إرسال رسالتك. يرجى المحاولة مجدداً.", details: "معلومات التواصل" },
  }[locale];
  const socialLinks = Object.entries(config.socialLinks ?? {}).filter((entry): entry is [SocialChannel, string] => Boolean(entry[1]));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    try {
      await api.submitContactInquiry({
        name: String(data.get("name") || ""), email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""), subject: String(data.get("subject") || ""),
        message: String(data.get("message") || ""), website: String(data.get("website") || ""),
      });
      form.reset();
      setStatus("sent");
    } catch { setStatus("error"); }
  };
  return (
    <main className="sf-contact-page">
      <Container>
        <header className="sf-contact-hero"><Eyebrow>{copy.eyebrow}</Eyebrow><h1>{copy.title}</h1><p>{copy.body}</p></header>
        <div className="sf-contact-layout">
          <aside className="sf-contact-details" aria-label={copy.details}>
            <h2>{copy.details}</h2>
            {config.contactEmail && <a href={`mailto:${config.contactEmail}`}><span className="sf-contact-mark"><IconMail /></span><span>{config.contactEmail}</span></a>}
            {config.phone && <a href={`tel:${config.phone}`}><span className="sf-contact-mark"><IconPhone /></span><bdi dir="ltr">{contactPhoneLabel(config.phone)}</bdi></a>}
            {config.whatsappPhone && <a href={`https://wa.me/${config.whatsappPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><span className="sf-social-mark"><SocialIcon channel="whatsapp" /></span><span>WhatsApp</span></a>}
            {socialLinks.length > 0 && <div className="sf-contact-socials" aria-label={locale === "ar" ? "وسائل التواصل الاجتماعي" : locale === "fr" ? "Réseaux sociaux" : "Social media"}>{socialLinks.map(([channel, url]) => <a className={`sf-social-${channel}`} key={channel} href={url} target="_blank" rel="noopener noreferrer" aria-label={socialChannelLabels[channel]} title={socialChannelLabels[channel]}><span className="sf-social-mark"><SocialIcon channel={channel} /></span><span className="sf-social-label">{socialChannelLabels[channel]}</span></a>)}</div>}
          </aside>
          <form className="sf-contact-form" onSubmit={submit}>
            <div className="sf-contact-fields"><label><span>{copy.name}</span><input name="name" autoComplete="name" maxLength={160} required /></label><label><span>{copy.email}</span><input name="email" type="email" autoComplete="email" required /></label></div>
            <label><span>{copy.phone}</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} dir="ltr" /></label>
            <label><span>{copy.subject}</span><input name="subject" maxLength={180} required /></label>
            <label><span>{copy.message}</span><textarea name="message" rows={7} maxLength={5000} required /></label>
            <label className="sf-contact-honeypot" aria-hidden="true"><span>Website</span><input name="website" tabIndex={-1} autoComplete="off" /></label>
            <button className="ds-btn ds-btn-primary" type="submit" disabled={status === "sending"}>{status === "sending" ? copy.sending : copy.send}</button>
            {status === "sent" && <p className="sf-contact-status is-success" role="status">{copy.sent}</p>}
            {status === "error" && <p className="sf-contact-status is-error" role="alert">{copy.error}</p>}
          </form>
        </div>
      </Container>
    </main>
  );
}
