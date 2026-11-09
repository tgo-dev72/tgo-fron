import type { CatalogSection, Product } from "../api/types";
import type { StoreConfig } from "../config";
import { sectionLabel, t, type Locale } from "../i18n";

export interface StoreMenuItem {
  id: string;
  label: string;
  href: string;
  children?: StoreMenuItem[];
  targetId?: string;
  type?: "page" | "category" | "collection" | "product" | "custom" | "group";
  description?: string;
  imageUrl?: string;
  badge?: string;
}

export type HeaderPreset = "compact" | "refined" | "editorial" | "search-first";
export function headerPreset(config: StoreConfig): HeaderPreset {
  const configured = config.navigation?.headerPreset;
  if (configured) return configured;
  if (!config.appearance?.header?.layout || config.appearance.header.layout === "logo_center") return "refined";
  return ({ beauty: "editorial", fashion: "editorial", electronics: "editorial", atelier: "editorial", nexa: "editorial" } as Record<string, HeaderPreset>)[config.design ?? ""] ?? "compact";
}

export interface MenuLink { label: string; href: string; targetId?: string }

const safeHref = (href: string) => /^(?:\/(?!\/)|#\/|#(?:[a-z][\w-]*$)|https:\/\/)/i.test(href);
/** Older published menus used hash routes; serve those pages at normal paths. */
export function pageHref(route: string): string {
  return route ? `/${route.replace(/^\/+|\/+$/g, "")}` : "/";
}

function normalizeMenuItem(item: StoreMenuItem): StoreMenuItem {
  return {
    ...item,
    href: item.href.startsWith("#/") ? pageHref(item.href.slice(2)) : item.href,
    ...(item.children ? { children: item.children.filter((child) => safeHref(child.href)).map(normalizeMenuItem) } : {}),
  };
}

function pageKind(item: Pick<StoreMenuItem, "id" | "href">): "about" | "contact" | null {
  const value = `${item.id} ${item.href}`.toLocaleLowerCase();
  if (/(?:^|[\s/-])about(?:$|[\s/?#-])/.test(value)) return "about";
  if (/(?:^|[\s/-])contact(?:$|[\s/?#-])/.test(value)) return "contact";
  return null;
}

const sectionHref = (key: string) => `/collections/${encodeURIComponent(key)}`;

function categoryItems(sections: CatalogSection[], locale: Locale): StoreMenuItem[] {
  const visible = sections.filter((section) => section.is_visible !== false);
  const ids = new Set(visible.map((section) => section.id));
  const seen = new Set<number>();
  const children = (parent: number | null, depth: number): StoreMenuItem[] => visible
    .filter((section) => parent === null ? !section.parent || !ids.has(section.parent) : section.parent === parent)
    .filter((section) => !seen.has(section.id))
    .map((section) => {
      seen.add(section.id);
      return {
        id: `category-${section.id}`,
        label: sectionLabel(locale, section.label),
        href: sectionHref(section.key), type: "category" as const,
        ...(depth < 3 ? { children: children(section.id, depth + 1) } : {}),
      };
    });
  const roots = children(null, 1);
  // Malformed parent chains must not make a real category disappear.
  return [...roots, ...visible.filter((section) => !seen.has(section.id)).map((section) => ({
    id: `category-${section.id}`, label: sectionLabel(locale, section.label), href: sectionHref(section.key), type: "category" as const,
  }))];
}

/** Published store data is authoritative. Theme presets only choose presentation and ordering. */
export function buildStoreMenu(config: StoreConfig, sections: CatalogSection[], locale: Locale, templateLinks: MenuLink[] = [], products: Product[] = []): StoreMenuItem[] {
  const header = config.appearance?.header;
  const showTopLevelCategories = header?.show_categories === true;
  const showAbout = header?.show_about !== false;
  const showContact = header?.show_contact !== false;
  const visibleInHeader = (item: StoreMenuItem) => {
    const kind = pageKind(item);
    return (kind !== "about" || showAbout) && (kind !== "contact" || showContact);
  };
  const configured = config.navigation?.main;
  if (configured?.length) return configured.filter((item) => safeHref(item.href)).slice(0, 16).map(normalizeMenuItem).filter(visibleInHeader);
  const pages = Object.entries(config.pages ?? {})
    .filter(([, page]) => page.showInNavigation && page.route !== "product-template")
    .map(([id, page]) => ({ id: `page-${id}`, label: page.title[locale]?.trim() || page.title.en?.trim() || id, href: pageHref(page.route), type: "page" as const }));
  const home = pages.find((item) => item.href === "/") ?? { id: "home", label: { en: "Home", fr: "Accueil", ar: "الرئيسية" }[locale], href: "/", type: "page" as const };
  const catalog = pages.find((item) => /^\/(products|catalog|shop)$/.test(item.href));
  const categories = categoryItems(sections, locale);
  const preset = headerPreset(config);
  const shopChildren: StoreMenuItem[] = [...categories];
  if (preset === "refined") {
    const facetGroups = [
      { key: "concern", title: { en: "Shop by concern", fr: "Par besoin", ar: "حسب الاحتياج" }[locale] },
      { key: "ingredients", title: { en: "Shop by ingredient", fr: "Par ingrédient", ar: "حسب المكوّن" }[locale] },
    ];
    for (const group of facetGroups) {
      const values = [...new Set(products.map((product) => product.attributes?.[group.key]).filter((value): value is string => typeof value === "string" && !!value.trim()))].slice(0, 6);
      if (values.length) shopChildren.push({ id: `facet-${group.key}`, label: group.title, href: "/collections/all", type: "group", children: values.map((value) => ({ id: `${group.key}-${value}`, label: value, href: `/collections/all?search=${encodeURIComponent(value)}`, type: "collection" })) });
    }
  }
  const shop: StoreMenuItem = { id: "shop", label: catalog?.label || t(locale, "catalog.shopAll"), href: catalog?.href || "/collections/all", type: "collection", children: shopChildren };
  const used = new Set([home.href, shop.href]);
  const extraPages = pages.filter((item) => !used.has(item.href));
  const extras = templateLinks.filter((item) => safeHref(item.href) && !used.has(item.href) && !pages.some((page) => page.href === item.href))
    .map((item, index) => normalizeMenuItem({ id: `template-${index}`, type: "custom" as const, ...item }));
  // Keep the premium header editorial and calm. Categories remain discoverable
  // inside Shop and the mobile drawer instead of charging the top-level rail.
  const visiblePages = extraPages.filter(visibleInHeader);
  const visibleExtras = extras.filter(visibleInHeader);
  const raw: StoreMenuItem[] = [home, shop, ...(showTopLevelCategories ? categories.slice(0, 8) : []), ...visiblePages, ...visibleExtras];
  const unique = new Set<string>();
  return raw.filter((item) => {
    if (!safeHref(item.href) || unique.has(item.href)) return false;
    unique.add(item.href);
    return true;
  });
}

export function isMenuItemActive(item: StoreMenuItem, pathname: string, hash: string): boolean {
  const href = item.href;
  const current = href.startsWith("#/") ? hash || "#/" : pathname;
  return (item.id === "shop" && /^\/(?:collections|products)\//.test(pathname))
    || ((href === "/" || href === "#/") ? pathname === "/" && (!hash || hash === "#/") : current === href || current.startsWith(`${href}/`))
    || Boolean(item.children?.some((child) => isMenuItemActive(child, pathname, hash)));
}
