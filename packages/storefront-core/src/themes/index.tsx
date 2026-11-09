import type { ReactNode } from "react";
import type { CatalogSection, Product } from "../api/types";
import type { Locale } from "../i18n";
import { formatPrice } from "../i18n";
import type { StorefrontCatalogContext } from "../storefront/Storefront";
import { RichText } from "../storefront/components";
import { OptimizedImage } from "../media/image";
import "./themes.css";

export type ThemeId = "basic" | "beauty" | "fashion" | "electronics" | "atelier" | "nexa";
export type ThemeSetting = { key: string; type: "color" | "select" | "boolean"; options?: string[] };
export type ThemeDefinition = {
  id: ThemeId;
  tier: "standard" | "premium";
  category: string;
  sections: readonly string[];
  settings: readonly ThemeSetting[];
};

/** Small, serializable definitions for the future merchant theme editor. */
export const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  basic: { id: "basic", tier: "standard", category: "general", sections: ["hero", "collections", "products", "newsletter"], settings: [{ key: "accent", type: "color" }, { key: "hero_visible", type: "boolean" }] },
  beauty: { id: "beauty", tier: "premium", category: "beauty", sections: ["hero", "concerns", "ingredients", "products", "routine", "newsletter"], settings: [{ key: "accent", type: "color" }, { key: "hero_visible", type: "boolean" }, { key: "card_style", type: "select", options: ["soft", "editorial"] }] },
  fashion: { id: "fashion", tier: "premium", category: "fashion", sections: ["campaign", "collections", "products", "editorial", "newsletter"], settings: [{ key: "accent", type: "color" }, { key: "hero_visible", type: "boolean" }, { key: "card_style", type: "select", options: ["minimal", "framed"] }] },
  atelier: { id: "atelier", tier: "premium", category: "lifestyle", sections: ["hero", "collections", "products", "image_text", "newsletter"], settings: [{ key: "accent", type: "color" }, { key: "hero_visible", type: "boolean" }, { key: "card_style", type: "select", options: ["minimal", "framed"] }] },
  nexa: { id: "nexa", tier: "premium", category: "modern-luxury", sections: ["campaign", "collections", "products", "image_text", "newsletter"], settings: [{ key: "accent", type: "color" }, { key: "hero_visible", type: "boolean" }, { key: "card_style", type: "select", options: ["minimal", "framed"] }] },
  electronics: { id: "electronics", tier: "premium", category: "electronics", sections: ["hero", "categories", "deals", "products", "comparison", "newsletter"], settings: [{ key: "accent", type: "color" }, { key: "hero_visible", type: "boolean" }, { key: "card_style", type: "select", options: ["dense", "spacious"] }] },
};

const COPY = {
  en: {
    shop: "Shop the collection", discover: "Explore products", concern: "Shop by concern", ingredient: "Know what is inside", routine: "Build your routine", details: "Product details", beauty: "Care, made considered.", beautySub: "Discover products through their ingredients, benefits and place in your routine.", fashion: "Wear the moment.", fashionSub: "An edit of pieces worth reaching for, season after season.", editorial: "The collection, your way", atelier: "A considered collection.", atelierSub: "Explore the pieces selected by this store.", atelierEdit: "The edit", dimensions: "Dimensions", origin: "Origin", electronics: "Technology that fits your life.", electronicsSub: "Compare the details. Choose with confidence.", nexa: "Objects for considered spaces.", nexaSub: "Sculptural light and technology, selected for quieter, better rooms.", compare: "Compare the details", spec: "Technical details", noClaims: "Explore the products and details provided by this store.", material: "Material & care", range: "Discover the range", browse: "Browse all", stock: "In stock", from: "From the collection", benefits: "Why it works", howTo: "How to use", suitable: "Suitable for", ingredients: "Ingredients", warranty: "Warranty", connectivity: "Connectivity", capacity: "Capacity", display: "Display", storage: "Storage", ram: "Memory", brand: "Brand", featured: "Featured products", choose: "Choose your next favorite", edit: "The current edit", compareIntro: "Specifications come from each product, so you can compare what matters.", noSpecs: "Product specifications will appear when the store adds them.", noConcern: "Shop the full range while the store prepares its concern guide.", noIngredient: "Ingredient information will appear when the store adds it.", new: "New arrivals" },
  fr: {
    shop: "Voir la collection", discover: "Explorer les produits", concern: "Acheter par besoin", ingredient: "Connaître la composition", routine: "Composer sa routine", details: "Détails du produit", beauty: "Le soin, avec intention.", beautySub: "Découvrez les produits par leurs ingrédients, bienfaits et place dans votre routine.", fashion: "Vivez le moment.", fashionSub: "Des pièces à retrouver, saison après saison.", editorial: "La collection, à votre façon", atelier: "Une collection pensée avec soin.", atelierSub: "Découvrez les pièces choisies par cette boutique.", atelierEdit: "La sélection", dimensions: "Dimensions", origin: "Origine", electronics: "La technologie pour vous.", electronicsSub: "Comparez les détails. Choisissez en confiance.", nexa: "Des objets pour des espaces choisis.", nexaSub: "Lumière sculpturale et technologie pour des intérieurs plus calmes.", compare: "Comparer les détails", spec: "Caractéristiques techniques", noClaims: "Explorez les produits et les détails fournis par cette boutique.", material: "Matières et entretien", range: "Découvrir la gamme", browse: "Voir tout", stock: "En stock", from: "Dans la collection", benefits: "Ses avantages", howTo: "Mode d'emploi", suitable: "Convient à", ingredients: "Ingrédients", warranty: "Garantie", connectivity: "Connectivité", capacity: "Capacité", display: "Écran", storage: "Stockage", ram: "Mémoire", brand: "Marque", featured: "À la une", choose: "Votre prochain favori", edit: "La sélection actuelle", compareIntro: "Les caractéristiques proviennent des produits pour comparer l'essentiel.", noSpecs: "Les caractéristiques apparaîtront quand la boutique les ajoutera.", noConcern: "Explorez la gamme pendant que la boutique prépare son guide.", noIngredient: "La composition apparaîtra quand la boutique l'ajoutera.", new: "Nouveautés" },
  ar: {
    shop: "تسوق المجموعة", discover: "اكتشف المنتجات", concern: "تسوق حسب الحاجة", ingredient: "تعرّف على المكونات", routine: "كوّن روتينك", details: "تفاصيل المنتج", beauty: "عناية باهتمام.", beautySub: "اكتشف المنتجات من خلال مكوناتها وفوائدها ومكانها في روتينك.", fashion: "عِش اللحظة.", fashionSub: "قطع تعود إليها موسماً بعد موسم.", editorial: "المجموعة على طريقتك", atelier: "مجموعة مختارة بعناية.", atelierSub: "اكتشف القطع التي اختارها هذا المتجر.", atelierEdit: "المختارات", dimensions: "الأبعاد", origin: "المنشأ", electronics: "تقنية تناسب حياتك.", electronicsSub: "قارن التفاصيل واختر بثقة.", nexa: "قطع مختارة لمساحات مدروسة.", nexaSub: "إضاءة نحتية وتقنيات تضفي هدوءًا وأناقة على المكان.", compare: "قارن التفاصيل", spec: "المواصفات التقنية", noClaims: "اكتشف المنتجات والتفاصيل التي يقدمها المتجر.", material: "الخامة والعناية", range: "اكتشف التشكيلة", browse: "عرض الكل", stock: "متوفر", from: "من المجموعة", benefits: "الفوائد", howTo: "طريقة الاستخدام", suitable: "مناسب لـ", ingredients: "المكونات", warranty: "الضمان", connectivity: "الاتصال", capacity: "السعة", display: "الشاشة", storage: "التخزين", ram: "الذاكرة", brand: "العلامة", featured: "مميز", choose: "اختر ما يناسبك", edit: "المختارات الحالية", compareIntro: "المواصفات مأخوذة من بيانات المنتج لتقارن ما يهمك.", noSpecs: "ستظهر المواصفات عندما يضيفها المتجر.", noConcern: "تصفح المنتجات بينما يعد المتجر دليل الاحتياجات.", noIngredient: "ستظهر المكونات عندما يضيفها المتجر.", new: "وصل حديثاً" },
} as const;

function copy(locale: Locale) { return COPY[locale] ?? COPY.en; }
function value(product: Product, key: string): string {
  const raw = product.attributes[key] ?? product.extra[key];
  if (raw == null || raw === "") return "";
  if (Array.isArray(raw)) return raw.filter((entry) => typeof entry === "string" || typeof entry === "number").join(", ");
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
}
function picture(product?: Product): string | undefined {
  const image = product?.images.find((item) => item.is_primary) ?? product?.images[0];
  return image?.image;
}
function sectionName(sections: CatalogSection[], product: Product): string {
  return sections.find((section) => section.id === product.section)?.label ?? "";
}

export function ThemeHero({ theme, context }: { theme: Exclude<ThemeId, "basic">; context: StorefrontCatalogContext }) {
  const c = copy(context.locale);
  const primary = context.products.find((product) => product.images.length > 0);
  const title = theme === "beauty" ? c.beauty : theme === "fashion" ? c.fashion : theme === "atelier" ? c.atelier : theme === "nexa" ? c.nexa : c.electronics;
  const subtitle = theme === "beauty" ? c.beautySub : theme === "fashion" ? c.fashionSub : theme === "atelier" ? c.atelierSub : theme === "nexa" ? c.nexaSub : c.electronicsSub;
  return <div className={`theme-hero theme-hero-${theme}`}>
    <div className="theme-hero-copy"><span className="theme-overline">{context.config.storeName} / {c.edit}</span><h1>{title}</h1><p>{subtitle}</p><a className="theme-hero-cta" href="#products">{c.shop}<span aria-hidden="true">&#8599;</span></a></div>
    <div className="theme-hero-media">{primary && picture(primary) ? <OptimizedImage src={picture(primary)!} widthHint={1400} widths={[640, 960, 1200, 1400]} sizes="(max-width: 760px) 100vw, 55vw" alt={primary.name} priority /> : <div className="theme-photo-empty" aria-hidden="true" />}{primary && <span className="theme-hero-caption">{primary.name}</span>}</div>
  </div>;
}

function Head({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return <header className="theme-section-head"><span className="theme-overline">{eyebrow}</span><h2>{title}</h2>{intro && <RichText html={intro} />}</header>;
}

function AttributeLinks({ products, field, title, empty }: { products: Product[]; field: string; title: string; empty: string }) {
  const values = [...new Set(products.flatMap((product) => value(product, field).split(",").map((part) => part.trim()).filter(Boolean)))].slice(0, 8);
  return <section className="theme-attribute-block"><h3>{title}</h3>{values.length > 0 ? <div className="theme-chip-list">{values.map((item) => <a href={`/?search=${encodeURIComponent(item)}#products`} key={item}>{item}</a>)}</div> : <p>{empty}</p>}</section>;
}

function ProductTile({ product, context }: { product: Product; context: StorefrontCatalogContext }) {
  const c = copy(context.locale);
  return <a className="theme-product-tile" href={`/products/${encodeURIComponent(product.slug || String(product.id))}`}>
    <div className="theme-product-image">{picture(product) && <OptimizedImage src={picture(product)!} widthHint={720} widths={[320, 480, 720]} sizes="(max-width: 680px) 80vw, 30vw" alt={product.name} />}</div>
    <span className="theme-overline">{sectionName(context.sections, product) || c.from}</span><strong>{product.name}</strong><span>{formatPrice(product.price, context.locale, context.config.currency)}</span>
  </a>;
}

function BeautySections({ context, title, intro, limit = 4 }: { context: StorefrontCatalogContext; title?: string; intro?: string; limit?: number }) {
  const c = copy(context.locale);
  const products = context.products;
  const labels: Record<Locale, Record<string, string>> = {
    en: { Cleanse: "Cleanse", Treat: "Treat", Moisturize: "Moisturize", Protect: "Protect" },
    fr: { Cleanse: "Nettoyer", Treat: "Traiter", Moisturize: "Hydrater", Protect: "Protéger" },
    ar: { Cleanse: "تنظيف", Treat: "علاج", Moisturize: "ترطيب", Protect: "حماية" },
  };
  const routine = ["Cleanse", "Treat", "Moisturize", "Protect"]
    .map((step) => ({ step, product: products.find((product) => value(product, "routine_step") === step) }))
    .filter((entry): entry is { step: string; product: Product } => Boolean(entry.product));
  return <div className="theme-extra theme-extra-beauty"><div className="theme-extra-inner">
    <Head eyebrow={c.range} title={title || c.concern} intro={intro || c.noClaims} />
    <div className="theme-beauty-discovery"><AttributeLinks products={products} field="concern" title={c.concern} empty={c.noConcern} /><AttributeLinks products={products} field="ingredients" title={c.ingredient} empty={c.noIngredient} /></div>
    <Head eyebrow={c.featured} title={c.routine} />{routine.length > 0
      ? <ol className="theme-routine-grid">{routine.slice(0, limit).map(({ step, product }, index) => <li key={step}><span className="theme-routine-step">{String(index + 1).padStart(2, "0")} / {labels[context.locale][step]}</span><ProductTile product={product} context={context} /></li>)}</ol>
      : <div className="theme-tile-grid">{products.slice(0, limit).map((product) => <ProductTile product={product} context={context} key={product.id} />)}</div>}
  </div></div>;
}

function FashionSections({ context, title, limit = 3 }: { context: StorefrontCatalogContext; title?: string; limit?: number }) {
  const c = copy(context.locale);
  const products = context.products;
  return <div className="theme-extra theme-extra-fashion"><div className="theme-extra-inner"><Head eyebrow={c.new} title={title || c.editorial} /><div className="theme-fashion-editorial">{products.slice(0, limit).map((product, index) => <a href={`/products/${encodeURIComponent(product.slug || String(product.id))}`} key={product.id} className={`theme-fashion-frame theme-fashion-frame-${index}`}><div>{picture(product) && <OptimizedImage src={picture(product)!} widthHint={960} widths={[480, 720, 960]} sizes="(max-width: 760px) 90vw, 32vw" alt={product.name} />}</div><span>{String(index + 1).padStart(2, "0")} / {product.name}</span></a>)}</div></div></div>;
}

function AtelierSections({ context, title, intro, limit = 4 }: { context: StorefrontCatalogContext; title?: string; intro?: string; limit?: number }) {
  const c = copy(context.locale);
  if (!context.products.length) return null;
  const campaign = context.products.slice(0, limit).find((product) => picture(product)) ?? context.products.find((product) => picture(product));
  const labels = {
    en: { eyebrow: "A fresh chapter", heading: "The New Season Edit", text: "Discover a fresh perspective on timeless essentials.", action: "Explore new arrivals", values: [["Thoughtful Design", "Every detail has a purpose."], ["Everyday Quality", "Beautiful things, made to be lived with."], ["Timeless Style", "Beyond seasons. Always relevant."]] },
    fr: { eyebrow: "Un nouveau chapitre", heading: "La sélection de saison", text: "Découvrez un nouveau regard sur des essentiels intemporels.", action: "Découvrir les nouveautés", values: [["Design réfléchi", "Chaque détail a une raison d’être."], ["Qualité quotidienne", "De beaux objets conçus pour être vécus."], ["Style intemporel", "Au-delà des saisons, toujours pertinent."]] },
    ar: { eyebrow: "فصل جديد", heading: "مختارات الموسم الجديد", text: "اكتشف منظورًا جديدًا لقطع أساسية خالدة.", action: "اكتشف الجديد", values: [["تصميم مدروس", "لكل تفصيل غاية."], ["جودة يومية", "أشياء جميلة صُممت لتعيش معك."], ["أسلوب خالد", "يتجاوز المواسم ويبقى حاضرًا."]] },
  }[context.locale];
  return <div className="theme-extra theme-extra-atelier">
    <section className="atelier-season-live">
      {campaign && picture(campaign) && <OptimizedImage src={picture(campaign)!} widthHint={1400} widths={[640, 960, 1200, 1400]} sizes="(max-width: 760px) 100vw, 55vw" alt={campaign.name} />}
      <div><span className="theme-overline">{labels.eyebrow}</span><h2>{title || labels.heading}</h2>{intro ? <RichText html={intro} /> : <p>{labels.text}</p>}<a href="/collections/all">{labels.action}</a></div>
    </section>
    <section className="atelier-values-live" aria-label={c.atelierEdit}>{labels.values.map(([heading, text], index) => <div key={heading}><i aria-hidden="true" data-mark={index} /><h3>{heading}</h3><p>{text}</p></div>)}</section>
  </div>;
}

function ElectronicsSections({ context, title, intro, limit = 3 }: { context: StorefrontCatalogContext; title?: string; intro?: string; limit?: number }) {
  const c = copy(context.locale);
  const products = context.products.slice(0, limit);
  const specKeys = [...new Set(products.flatMap((product) => Object.keys(product.attributes)))].filter((key) => products.some((product) => value(product, key))).slice(0, 6);
  return <div className="theme-extra theme-extra-electronics"><div className="theme-extra-inner"><Head eyebrow={c.details} title={title || c.compare} intro={intro || c.compareIntro} /><div className="theme-compare-scroll"><table className="theme-compare"><thead><tr><th scope="col">{c.spec}</th>{products.map((product) => <th scope="col" key={product.id}><a href={`/products/${encodeURIComponent(product.slug || String(product.id))}`}>{picture(product) && <OptimizedImage src={picture(product)!} widthHint={320} widths={[160, 240, 320]} sizes="180px" alt="" />}<span>{product.name}</span></a></th>)}</tr></thead><tbody><tr><th scope="row">{c.details}</th>{products.map((product) => <td key={product.id}>{formatPrice(product.price, context.locale, context.config.currency)}</td>)}</tr>{specKeys.map((key) => <tr key={key}><th scope="row">{key.replace(/_/g, " ")}</th>{products.map((product) => <td key={product.id}>{value(product, key) || "—"}</td>)}</tr>)}</tbody></table></div>{specKeys.length === 0 && <p className="theme-empty-note">{c.noSpecs}</p>}</div></div>;
}

export function renderThemeSections(theme: Exclude<ThemeId, "basic">, context: StorefrontCatalogContext, options: { title?: string; body?: string; limit?: number } = {}): ReactNode {
  const limit = Math.max(1, Math.min(8, options.limit ?? (theme === "beauty" ? 4 : 3)));
  if (theme === "beauty") return <BeautySections context={context} title={options.title} intro={options.body} limit={limit} />;
  if (theme === "fashion") return <FashionSections context={context} title={options.title} limit={limit} />;
  if (theme === "atelier") return <AtelierSections context={context} title={options.title} intro={options.body} limit={limit} />;
  if (theme === "nexa") return <ElectronicsSections context={context} title={options.title} intro={options.body} limit={limit} />;
  return <ElectronicsSections context={context} title={options.title} intro={options.body} limit={limit} />;
}

export function renderThemeProduct(theme: Exclude<ThemeId, "basic">, product: Product, context: StorefrontCatalogContext): ReactNode {
  const c = copy(context.locale);
  const fields = theme === "beauty"
    ? [["benefits", c.benefits], ["ingredients", c.ingredients], ["usage", c.howTo], ["suitable_for", c.suitable]]
    : theme === "fashion"
      ? [["material", c.material], ["care", c.howTo], ["fit", c.details], ["size_guide", c.details]]
      : theme === "atelier"
        ? [["material", c.material], ["care", c.howTo], ["dimensions", c.dimensions], ["origin", c.origin], ["brand", c.brand]]
        : [["brand", c.brand], ["storage", c.storage], ["ram", c.ram], ["display", c.display], ["connectivity", c.connectivity], ["capacity", c.capacity], ["warranty", c.warranty]];
  const available = fields.map(([key, label]) => ({ key, label, text: value(product, key) })).filter((field) => field.text);
  if (available.length === 0) return null;
  return <section className={`theme-product-extra theme-product-extra-${theme}`} aria-label={theme === "electronics" ? c.spec : c.details}><h2>{theme === "electronics" ? c.spec : c.details}</h2><dl>{available.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.text}</dd></div>)}</dl></section>;
}
export { premiumThemeSystem } from "./tokens";
export { STOREFRONT_THEME_PALETTES, storefrontThemePalette } from "./palettes";
export type { StorefrontThemePalette } from "./palettes";
