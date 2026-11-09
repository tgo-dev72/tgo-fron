import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  CatalogToolbar,
  buildCatalogFacets,
  filterAndSortProducts,
  findVariant,
  formatPrice,
  Gallery,
  productHasStock,
  initialSelection,
  IconClose,
  IconHeart,
  IconStar,
  Price,
  ProductFacts,
  RichText,
  selectHomepageProducts,
  productAttributeValues,
  productFacts,
  salePrice,
  SaveBadge,
  t,
  useCart,
  useLocale,
  useStoreConfig,
  VariantPicker,
} from "@storefront/core";
import type { CatalogSection, CatalogSort, HomepageProductSource, Locale, Product, Selection } from "@storefront/core";
import { useFeature, usePremiumStorefront } from "./context";
import { useCatalog } from "./catalog";
import type { CatalogData } from "./catalog";
import { useCompare, useFacets, useQuickView, useRecentlyViewed, useWishlist } from "./hooks";
import type { FacetSelections } from "./hooks";

/* ------------------------------------------------------------------ */
/* shared helpers                                                     */
/* ------------------------------------------------------------------ */

function openProductPage(product: Product) {
  const path = `/products/${encodeURIComponent(product.slug || String(product.id))}`;
  window.history.pushState(null, "", `${path}${window.location.search}${window.location.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function money(value: number, locale: Locale, currency: string): string {
  return formatPrice(value, locale, currency);
}

function subscriptionDiscount(intervalDays: number): number {
  if (intervalDays <= 30) return 15;
  if (intervalDays <= 60) return 10;
  return 5;
}

function bestsellers(products: Product[], n: number): Product[] {
  return [...products]
    .sort((a, b) => b.reviews_count - a.reviews_count || b.rating - a.rating)
    .slice(0, n);
}

function recommend(products: Product[], recentIds: number[], n: number): Product[] {
  if (products.length === 0) return [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const recent = recentIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  if (recent.length > 0) {
    const recentSections = new Set(recent.map((p) => p.section));
    const related = products.filter((p) => recentSections.has(p.section) && !recentIds.includes(p.id));
    if (related.length > 0) {
      return [...related].sort((a, b) => b.rating - a.rating || b.reviews_count - a.reviews_count).slice(0, n);
    }
  }
  return bestsellers(products, n);
}

function resolveProduct(productId: string | number | undefined, products: Product[]): Product | undefined {
  if (products.length === 0) return undefined;
  if (typeof productId === "number") {
    return products.find((p) => p.id === productId) ?? products[0];
  }
  if (productId && /^\d+$/.test(productId)) {
    const byId = products.find((p) => p.id === Number(productId));
    if (byId) return byId;
  }
  return bestsellers(products, 1)[0] ?? products[0];
}

function matchesFacets(p: Product, selections: FacetSelections): boolean {
  return Object.entries(selections).every(([attrKey, values]) => {
    if (values.length === 0) return true;
    return productAttributeValues(p, attrKey).some((value) => values.includes(value));
  });
}

interface FacetGroup {
  key: string;
  label: string;
  type: string;
  options: { value: string; label: string; count: number; swatch?: string }[];
}

function buildFacetGroups(data: CatalogData): FacetGroup[] {
  return buildCatalogFacets(data.products, data.sections, 12)
    .filter((facet) => ["select", "color", "multi"].includes(facet.type));
}

function productSpecs(product: Product, sections: CatalogSection[]): { label: string; value: string }[] {
  const section = sections.find((s) => s.id === product.section);
  return productFacts(product, section, 3).map(({ label, value }) => ({ label, value }));
}

function productOptionSwatch(product: Product, key: string, value: string): string {
  const option = product.variant_options?.find((candidate) => candidate.key === key);
  const configured = option?.values.find((candidate) => (
    typeof candidate === "string" ? candidate : candidate.value
  ) === value);
  return typeof configured === "object" && configured.swatch ? configured.swatch : value;
}

/* ------------------------------------------------------------------ */
/* premium product card                                               */
/* ------------------------------------------------------------------ */

interface PremiumCardProps {
  product: Product;
  sections: CatalogSection[];
  showQuickView?: boolean;
  showCompare?: boolean;
  showWishlist?: boolean;
  quickViewTrigger?: ComponentType<{ product: Product }>;
  showVariantOptions?: boolean;
  showStockSummary?: boolean;
}

function PremiumProductCard({
  product,
  showQuickView = false,
  showCompare = false,
  showWishlist = true,
  quickViewTrigger,
  showVariantOptions = false,
  showStockSummary = false,
}: PremiumCardProps) {
  const locale = useLocale();
  const { addToCart } = useCart();
  const compare = useCompare();
  const wishlist = useWishlist();
  const wishlistEnabled = useFeature("wishlist");
  const [added, setAdded] = useState(false);

  const primary = product.images.find((i) => i.is_primary) ?? product.images[0];
  const inStock = productHasStock(product);
  const Trigger = quickViewTrigger;
  const quickView = useQuickView();
  const quickViewEnabled = useFeature("quickView");
  const availableVariants = product.variants.filter((variant) => variant.available_quantity > 0);
  const variantOptions = (product.variant_options ?? []).map((option) => {
    const availableValues = new Set(
      availableVariants.flatMap((variant) => {
        const value = variant.attributes[option.key];
        return Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)];
      }),
    );
    return {
      ...option,
      values: option.values.filter((configured) => availableValues.has(
        typeof configured === "string" ? configured : configured.value,
      )),
    };
  }).filter((option) => option.values.length > 0);

  function quickAdd() {
    if (!findVariant(product, {})) {
      if (quickViewEnabled) quickView.open(product.id);
      else openProductPage(product);
      return;
    }
    addToCart(product, {});
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className="pc-card">
      <div className="pc-media">
        {primary ? (
          <img src={primary.image} alt={t(locale, "misc.alt", product.name)} loading="lazy" />
        ) : (
          <div className="pc-noimg" />
        )}
        {!inStock && <span className="pc-badge pc-badge-oos">{t(locale, "product.outOfStock")}</span>}
        {(product.compare_at_price != null && product.compare_at_price > product.price) || product.promo > 0
          ? <span className="pc-badge pc-badge-save">−{product.compare_at_price != null && product.compare_at_price > product.price ? Math.round((1 - product.price / product.compare_at_price) * 100) : product.promo}%</span>
          : null}
        <div className="pc-actions">
          {showQuickView && (Trigger ? <Trigger product={product} /> : <QuickViewTrigger product={product} />)}
          {showCompare && (
            <button
              type="button"
              className={`pc-action ${compare.inList(product.id) ? "is-active" : ""}`}
              aria-pressed={compare.inList(product.id)}
              onClick={() => compare.toggle(product.id)}
            >
              {compare.inList(product.id) ? "✓ Compare" : "Compare"}
            </button>
          )}
        </div>
        {showWishlist && wishlistEnabled && (
          <button
            type="button"
            className={`pc-wishlist ${wishlist.inList(product.id) ? "is-active" : ""}`}
            aria-pressed={wishlist.inList(product.id)}
            aria-label="Wishlist"
            onClick={() => wishlist.toggle(product.id)}
          >
            <IconHeart />
          </button>
        )}
      </div>
      <div className="pc-body">
        <h3 className="pc-name">{product.name}</h3>
        {product.reviews_count > 0 && (
          <span className="pc-rating">
            <IconStar />
            {product.rating.toFixed(1)} <em>({product.reviews_count})</em>
          </span>
        )}
        <div className="pc-price">
          <Price product={product} locale={locale} />
          <SaveBadge product={product} locale={locale} />
        </div>
        {showVariantOptions && variantOptions.length > 0 && (
          <div className="pc-card-options" aria-label="Available choices">
            {variantOptions.slice(0, 2).map((option) => (
              <div className="pc-card-option" key={option.key}>
                <span>{option.label}</span>
                <div>
                  {option.values.slice(0, 6).map((configured) => {
                    const value = typeof configured === "string" ? configured : configured.value;
                    const label = typeof configured === "string" ? configured : configured.label;
                    const swatch = typeof configured === "string" ? undefined : configured.swatch;
                    return option.type === "color" ? (
                      <i key={value} className="pc-card-swatch" style={{ background: swatch ?? value }} title={label} />
                    ) : <em key={value}>{label}</em>;
                  })}
                  {option.values.length > 6 && <small>+{option.values.length - 6}</small>}
                </div>
              </div>
            ))}
          </div>
        )}
        {showStockSummary && product.uses_variants && (
          <span className="pc-card-stock-summary">
            {availableVariants.length} available combination{availableVariants.length === 1 ? "" : "s"}
          </span>
        )}
        {product.loyalty_points > 0 && (
          <span className="pc-loyalty">{t(locale, "product.loyalty", product.loyalty_points)}</span>
        )}
        <button type="button" className="pc-add" disabled={!inStock} onClick={quickAdd}>
          {added ? "Added ✓" : t(locale, "product.addToCart")}
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Product Discovery                                                  */
/* ------------------------------------------------------------------ */

export function ProductDiscovery({
  mode = "default",
  showQuickView = false,
  infiniteScroll = false,
  showSpecs = false,
  showCompare = false,
  showTieredPricing = false,
  showBundleUpsell = false,
  showSubscriptionOption = false,
  productSource,
  productLimit,
  renderQuickViewTrigger,
  showVariantOptions = false,
  showStockSummary = false,
}: {
  mode?: string;
  showQuickView?: boolean;
  infiniteScroll?: boolean;
  showSpecs?: boolean;
  showCompare?: boolean;
  showTieredPricing?: boolean;
  showBundleUpsell?: boolean;
  showSubscriptionOption?: boolean;
  productSource?: HomepageProductSource;
  productLimit?: number;
  renderQuickViewTrigger?: ComponentType<{ product: Product }>;
  showVariantOptions?: boolean;
  showStockSummary?: boolean;
}) {
  const { data, loading, error } = useCatalog();
  const locale = useLocale();
  const facets = useFacets();
  const [visible, setVisible] = useState(8);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogSort>("featured");

  const facetedProducts = data ? data.products.filter((p) => matchesFacets(p, facets.selections)) : [];
  const discovered = data ? filterAndSortProducts(facetedProducts, data.sections, query, sort) : [];
  const products = productSource
    ? selectHomepageProducts(discovered, productSource, productLimit)
    : discovered;
  const shown = infiniteScroll ? products.slice(0, visible) : products;
  const hasMore = infiniteScroll && visible < products.length;

  return (
    <div className={`pc-discovery pc-discovery-${mode}`}>
      {(showBundleUpsell || showSubscriptionOption || showTieredPricing) && (
        <div className="pc-strip">
          {showBundleUpsell && <span className="pc-strip-item">Bundle builder — combine 2–4 catalog products</span>}
          {showSubscriptionOption && <span className="pc-strip-item">Flexible repeat-order options</span>}
          {showTieredPricing && <span className="pc-strip-item">Quantity options are shown when available</span>}
        </div>
      )}
      <CatalogToolbar locale={locale} query={query} sort={sort} count={products.length} onQuery={setQuery} onSort={setSort} />
      {error && <div className="sf-catalog-state pc-error"><strong>{t(locale, "catalog.unavailable")}</strong><span>{t(locale, "catalog.unavailableDetail")}</span></div>}
      {loading && <div className="sf-grid sf-grid-loading" aria-label={t(locale, "catalog.loading")}>{Array.from({ length: 8 }, (_, index) => <div className="sf-card-skeleton" key={index}><span /><i /><i /></div>)}</div>}
      {!loading && !error && shown.length === 0 && <div className="sf-catalog-state"><strong>{t(locale, "catalog.noResults")}</strong>{query && <button type="button" className="ds-btn" onClick={() => setQuery("")}>{t(locale, "catalog.clear")}</button>}</div>}
      <div className="pc-grid">
        {shown.map((p) => (
          <PremiumProductCard
            key={p.id}
            product={p}
            sections={data?.sections ?? []}
            showQuickView={showQuickView}
            showCompare={showCompare}
            quickViewTrigger={renderQuickViewTrigger}
            showVariantOptions={showVariantOptions}
            showStockSummary={showStockSummary}
          />
        ))}
      </div>
      {showSpecs && data && (
        <div className="pc-specs">
          {shown.map((p) => {
            const specs = productSpecs(p, data.sections);
            if (specs.length === 0) return null;
            return (
              <div key={p.id} className="pc-specs-row">
                <span className="pc-specs-name">{p.name}</span>
                {specs.map((s) => (
                  <span key={s.label} className="pc-specs-cell">
                    <em>{s.label}</em> {s.value}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {showTieredPricing && (
        <div className="pc-tiered-grid">
          {shown.slice(0, 3).map((product) => (
            <TieredPricing key={product.id} productId={product.id} />
          ))}
        </div>
      )}
      {hasMore && (
        <button type="button" className="pc-more" onClick={() => setVisible((v) => v + 8)}>
          Load more ({products.length - visible} remaining)
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick View                                                         */
/* ------------------------------------------------------------------ */

export function QuickViewTrigger({ product }: { product: Product }) {
  const enabled = useFeature("quickView");
  const quickView = useQuickView();
  if (!enabled) return null;
  return (
    <button type="button" className="pc-action pc-qv" aria-label="Quick view" onClick={() => quickView.open(product.id)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

export function QuickViewModal({ onClose }: { onClose?: () => void }) {
  const enabled = useFeature("quickView");
  const { productId, close } = useQuickView();
  const { data } = useCatalog();
  const locale = useLocale();
  const { addToCart, openCheckout } = useCart();
  const expressCheckoutEnabled = useFeature("expressCheckout");
  const compare = useCompare();
  const wishlist = useWishlist();
  const compareEnabled = useFeature("compare");
  const wishlistEnabled = useFeature("wishlist");
  const [selection, setSelection] = useState<Selection>({});
  const [added, setAdded] = useState(false);

  const product = productId !== null && data ? data.byId.get(productId) : undefined;
  const section = product && data ? data.sectionById.get(product.section) : undefined;
  const inStock = product ? productHasStock(product) : false;
  const addable = product ? Boolean(findVariant(product, selection)) : false;

  useEffect(() => {
    if (productId !== null && data) {
      const p = data.byId.get(productId);
      if (p) setSelection(initialSelection(p, data.sections));
    }
  }, [productId, data]);

  if (!enabled || !product) return null;

  function dismiss() {
    close();
    onClose?.();
  }

  function quickAdd() {
    if (!product || !addable) return;
    addToCart(product, selection);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className="pc-modal" role="dialog" aria-modal="true" onClick={dismiss}>
      <div className="pc-modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pc-modal-close" aria-label="Close" onClick={dismiss}>
          <IconClose />
        </button>
        <div className="pc-modal-grid">
          <Gallery product={product} locale={locale} />
          <div className="pc-modal-info">
            <span className="pc-modal-ref">{product.ref}</span>
            <h3 className="pc-modal-name">{product.name}</h3>
            {product.reviews_count > 0 && (
              <span className="pc-rating">
                <IconStar />
                {product.rating.toFixed(1)} <em>({product.reviews_count})</em>
              </span>
            )}
            <div className="pc-modal-price">
              <Price product={product} locale={locale} />
              <SaveBadge product={product} locale={locale} />
            </div>
            {product.description && <RichText html={product.description} className="pc-modal-desc" />}
            <span className={`pc-modal-stock ${!inStock ? "is-none" : ""}`}>
              {inStock ? t(locale, "product.inStock") : t(locale, "product.outOfStock")}
            </span>
            {section && (
              <VariantPicker product={product} section={section} selection={selection} onChange={setSelection} locale={locale} />
            )}
            <div className="pc-modal-actions">
              <button type="button" className="pc-add pc-add-lg" disabled={!addable} onClick={quickAdd}>
                {added ? "Added ✓" : t(locale, "product.addToCart")}
              </button>
              {expressCheckoutEnabled && (
                <button type="button" className="pc-add pc-add-lg" disabled={!addable} onClick={() => {
                  if (!addable) return;
                  addToCart(product, selection);
                  dismiss();
                  openCheckout();
                }}>
                  {locale === "ar" ? "اشتر الآن" : locale === "fr" ? "Acheter maintenant" : "Buy now"}
                </button>
              )}
              {compareEnabled && (
                <button
                  type="button"
                  className={`pc-action pc-action-lg ${compare.inList(product.id) ? "is-active" : ""}`}
                  aria-pressed={compare.inList(product.id)}
                  onClick={() => compare.toggle(product.id)}
                >
                  {compare.inList(product.id) ? "✓ Compare" : "Compare"}
                </button>
              )}
              {wishlistEnabled && (
                <button
                  type="button"
                  className={`pc-wishlist pc-wishlist-lg ${wishlist.inList(product.id) ? "is-active" : ""}`}
                  aria-pressed={wishlist.inList(product.id)}
                  aria-label="Wishlist"
                  onClick={() => wishlist.toggle(product.id)}
                >
                  <IconHeart />
                </button>
              )}
            </div>
            {product.loyalty_points > 0 && (
              <p className="pc-loyalty">{t(locale, "product.loyalty", product.loyalty_points)}</p>
              )}
            </div>
            <ProductFacts facts={productFacts(product, section)} locale={locale} />
          </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compare                                                            */
/* ------------------------------------------------------------------ */

export function CompareBar() {
  const enabled = useFeature("compare");
  const compare = useCompare();
  const { data } = useCatalog();
  const locale = useLocale();
  const config = useStoreConfig();
  const [open, setOpen] = useState(false);

  if (!enabled) return null;
  const items = compare.ids.map((id) => data?.byId.get(id)).filter((p): p is Product => Boolean(p));
  if (items.length === 0) return null;

  return (
    <div className={`pc-compare-bar ${open ? "is-open" : ""}`}>
      <div className="pc-compare-inner">
        <span className="pc-compare-label">Compare ({items.length}/4)</span>
        <div className="pc-compare-thumbs">
          {items.map((p) => (
            <div key={p.id} className="pc-compare-thumb" title={p.name}>
              {p.images[0] ? <img src={p.images[0].image} alt={p.name} /> : <div className="pc-noimg" />}
              <button
                type="button"
                className="pc-compare-remove"
                aria-label={`Remove ${p.name}`}
                onClick={() => compare.remove(p.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="pc-compare-actions">
          <button type="button" className="pc-compare-clear" onClick={compare.clear}>
            Clear
          </button>
          <button type="button" className="pc-compare-view" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Compare"} table
          </button>
        </div>
        <span className="pc-compare-total">
          From {items.length ? money(salePrice(items[0]), locale, config.currency) : ""}
        </span>
      </div>
      {open && <ComparisonTable />}
    </div>
  );
}

export function ComparisonTable() {
  const quickView = useQuickView();
  const quickViewEnabled = useFeature("quickView");
  const enabled = useFeature("compare");
  const compare = useCompare();
  const { data } = useCatalog();
  const locale = useLocale();
  const { addToCart } = useCart();

  if (!enabled) return null;
  const items = compare.ids.map((id) => data?.byId.get(id)).filter((p): p is Product => Boolean(p));
  if (items.length === 0) {
    return (
      <div className="pc-compare-empty">
        <h3>Compare products</h3>
        <p>Add at least two products with the “Compare” button to see them side by side.</p>
      </div>
    );
  }

  const defs: { key: string; label: string; type: string }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const section = data?.sectionById.get(item.section);
    for (const def of [...(section?.attribute_defs ?? []), ...(item.variant_options ?? [])]) {
      if (seen.has(def.key)) continue;
      // Compare only specifications that have a value in the selected products.
      if (!items.some((product) => productAttributeValues(product, def.key).length > 0)) continue;
      seen.add(def.key);
      defs.push({ key: def.key, label: def.label, type: def.type });
    }
  }

  const cellOptions = (product: Product, key: string) => {
    const definition = data?.sectionById.get(product.section)?.attribute_defs.find((entry) => entry.key === key);
    const axis = product.variant_options?.find((entry) => entry.key === key);
    return productAttributeValues(product, key).map((value) => {
      const option = axis?.values.find((entry) => (typeof entry === "string" ? entry : entry.value) === value);
      const label = typeof option === "object" ? option.label : definition?.options.find((entry) => entry.value === value)?.label ?? value;
      return { value, label };
    });
  };

  return (
    <div className="pc-compare-table-wrap">
      <table className="pc-compare-table">
        <thead>
          <tr>
            <th scope="col" aria-label={t(locale, "product.details")} />
            {items.map((p) => (
              <th key={p.id}>
                <div className="pc-compare-product">
                  {p.images[0] ? <img src={p.images[0].image} alt={p.name} /> : <div className="pc-noimg" />}
                  <strong>{p.name}</strong>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="pc-compare-rowhead">Price</th>
            {items.map((p) => (
              <td key={p.id}>
                <Price product={p} locale={locale} />
                <SaveBadge product={p} locale={locale} />
              </td>
            ))}
          </tr>
          <tr>
            <th className="pc-compare-rowhead">Rating</th>
            {items.map((p) => (
              <td key={p.id} className="pc-rating">
                <IconStar /> {p.rating.toFixed(1)} <em>({p.reviews_count})</em>
              </td>
            ))}
          </tr>
          <tr>
            <th className="pc-compare-rowhead">Loyalty</th>
            {items.map((p) => (
              <td key={p.id}>+{p.loyalty_points} pts</td>
            ))}
          </tr>
          {defs.map((def) => (
            <tr key={def.key}>
              <th className="pc-compare-rowhead">{def.label}</th>
              {items.map((p) => {
                const values = cellOptions(p, def.key);
                return (
                  <td key={p.id}>
                    {values.length === 0 ? "—" : def.type === "color" ? values.map(({ value, label }) => (
                      <span key={value} title={label}>
                        <span className="pc-swatch" style={{ background: productOptionSwatch(p, def.key, value) }} aria-label={label} />
                        <span>{label} </span>
                      </span>
                    )) : values.map(({ label }) => label).join(", ")}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th className="pc-compare-rowhead">Actions</th>
            {items.map((p) => (
              <td key={p.id} className="pc-compare-actions">
                <button
                  type="button"
                  className="pc-add"
                  disabled={!productHasStock(p)}
                  onClick={() => {
                    if (findVariant(p, {})) addToCart(p, {});
                    else if (quickViewEnabled) quickView.open(p.id);
                    else openProductPage(p);
                  }}
                >
                  Add to cart
                </button>
                <button type="button" className="pc-compare-clear" onClick={() => compare.remove(p.id)}>
                  Remove
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Faceted search                                                     */
/* ------------------------------------------------------------------ */

export function FacetedFilters() {
  const enabled = useFeature("facetedSearch");
  const facets = useFacets();
  const { data, loading } = useCatalog();

  if (!enabled) return null;
  if (loading || !data) return <aside className="pc-facets">Loading filters…</aside>;

  const groups = buildFacetGroups(data);
  const active = Object.entries(facets.selections);

  return (
    <aside className="pc-facets" aria-label="Filters">
      <div className="pc-facets-head">
        <span className="pc-facets-title">Filters</span>
        {facets.activeCount > 0 && (
          <button type="button" className="pc-facets-clear" onClick={facets.clear}>
            Clear all ({facets.activeCount})
          </button>
        )}
      </div>
      {active.length > 0 && (
        <div className="pc-facets-active">
          {active.flatMap(([key, values]) =>
            values.map((v) => (
              <button
                key={`${key}:${v}`}
                type="button"
                className="pc-chip"
                onClick={() => facets.toggle(key, v)}
              >
                {v} ×
              </button>
            )),
          )}
        </div>
      )}
      {groups.length === 0 && <p className="ds-body">No filters available for this catalog.</p>}
      {groups.map((group) => (
        <fieldset key={group.key} className="pc-facet-group">
          <legend>{group.label}</legend>
          {group.type === "color" ? (
            <div className="pc-facet-swatches">
              {group.options.map((o) => {
                const selected = facets.selections[group.key]?.includes(o.value) ?? false;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`pc-swatch ${selected ? "is-active" : ""}`}
                    style={{ background: o.swatch ?? o.value }}
                    title={`${o.label} (${o.count})`}
                    aria-pressed={selected}
                    onClick={() => facets.toggle(group.key, o.value)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="pc-facet-options">
              {group.options.map((o) => {
                const selected = facets.selections[group.key]?.includes(o.value) ?? false;
                return (
                  <label key={o.value} className={`pc-facet-option ${selected ? "is-active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => facets.toggle(group.key, o.value)}
                    />
                    <span>{o.label}</span>
                    <em>{o.count}</em>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      ))}
    </aside>
  );
}

export function InstantSearch() {
  const enabled = useFeature("instantSearch");
  const quickViewEnabled = useFeature("quickView");
  const { data } = useCatalog();
  const quickView = useQuickView();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = q
    ? (data?.products ?? []).filter((p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q)).slice(0, 6)
    : [];

  if (!enabled) return null;

  return (
    <div className="pc-visual">
      <div className="pc-visual-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          type="search"
          placeholder="Search products…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        />
      </div>
      {focused && matches.length > 0 && (
        <div className="pc-visual-results">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery("");
                if (quickViewEnabled) quickView.open(p.id);
                else openProductPage(p);
              }}
            >
              {p.images[0] ? <img src={p.images[0].image} alt="" /> : <div className="pc-noimg" />}
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated Use InstantSearch; this was text search, never image search. */
export const VisualSearch = InstantSearch;

/* ------------------------------------------------------------------ */
/* Bundles & subscriptions                                            */
/* ------------------------------------------------------------------ */

export function BundleBuilder({ productId: _productId }: { productId?: string }) {
  const enabled = useFeature("bundles");
  const { data } = useCatalog();
  const locale = useLocale();
  const config = useStoreConfig();
  const { addToCart, showToast } = useCart();
  const [selected, setSelected] = useState<number[]>([]);
  const [selections, setSelections] = useState<Record<number, Selection>>({});

  if (!enabled) return null;
  const products = data?.products ?? [];
  const chosen = products.filter((p) => selected.includes(p.id));
  const ready = chosen.length >= 2 && chosen.every((p) => Boolean(findVariant(p, selections[p.id] ?? {})));
  const chooseOptions = locale === "ar" ? "اختر خيارات كل منتج" : locale === "fr" ? "Choisissez les options de chaque produit" : "Choose options for each product";
  const total = chosen.reduce((sum, p) => {
    const variant = findVariant(p, selections[p.id] ?? {});
    return sum + salePrice({ ...p, price: variant?.price ?? p.price });
  }, 0);

  function toggle(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function addBundle() {
    if (!ready) return;
    for (const p of chosen) addToCart(p, selections[p.id] ?? {});
    showToast(`Bundle (${chosen.length} items) added to cart`);
  }

  return (
    <div className="pc-bundle">
      <div className="pc-bundle-head">
        <span>Pick 2–4 products to build a coordinated set</span>
        {ready && <strong>Your bundle is ready</strong>}
      </div>
      <div className="pc-bundle-grid">
        {products.slice(0, 8).map((p) => {
          const isIn = selected.includes(p.id);
          const section = data?.sectionById.get(p.section);
          return (
            <div key={p.id}>
              <label className={`pc-bundle-item ${isIn ? "is-active" : ""} ${selected.length >= 4 && !isIn ? "is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={isIn}
                  disabled={!productHasStock(p) || (selected.length >= 4 && !isIn)}
                  onChange={() => toggle(p.id)}
                />
                {p.images[0] ? <img src={p.images[0].image} alt={p.name} loading="lazy" /> : <div className="pc-noimg" />}
                <span className="pc-bundle-name">{p.name}</span>
                <Price product={p} locale={locale} />
              </label>
              {isIn && section && (
                <fieldset className="pc-bundle-options">
                  <legend>{p.name}</legend>
                  <VariantPicker product={p} section={section} selection={selections[p.id] ?? {}}
                    onChange={(selection) => setSelections((previous) => ({ ...previous, [p.id]: selection }))} locale={locale} />
                </fieldset>
              )}
            </div>
          );
        })}
      </div>
      <div className="pc-bundle-summary">
        <span className="pc-bundle-count">
          {chosen.length} of 4 selected · {ready ? "Ready to add" : chosen.length >= 2 ? chooseOptions : "Pick at least 2 products"}
        </span>
        {chosen.length > 0 && (
          <span className="pc-bundle-total">
            {money(total, locale, config.currency)}
          </span>
        )}
        <button type="button" className="pc-add" disabled={!ready} onClick={addBundle}>
          Add bundle to cart
        </button>
      </div>
    </div>
  );
}

export function SubscriptionSelector({ productId }: { productId?: number }) {
  const enabled = useFeature("subscriptions");
  const { data } = useCatalog();
  const locale = useLocale();
  const config = useStoreConfig();
  const { addToCart, showToast } = useCart();
  const [type, setType] = useState<"once" | "subscribe">("subscribe");
  const [interval, setInterval] = useState(30);

  if (!enabled) return null;
  const product = typeof productId === "number" && data ? data.byId.get(productId) : bestsellers(data?.products ?? [], 1)[0];
  if (!product) return null;
  const p = product;

  const discount = type === "subscribe" ? subscriptionDiscount(interval) : 0;
  const unit = salePrice(p);
  const price = Math.round(unit * (1 - discount / 100));

  function subscribe() {
    addToCart(p, initialSelection(p, data?.sections ?? []));
    showToast(
      type === "subscribe"
        ? `Subscribed — ${p.name} every ${interval} days, save ${discount}%`
        : `${p.name} added — one-time purchase`,
    );
  }

  return (
    <div className="pc-sub">
      {product.images[0] ? <img src={product.images[0].image} alt={product.name} className="pc-sub-img" /> : null}
      <div className="pc-sub-info">
        <h4 className="pc-sub-name">{product.name}</h4>
        <div className="pc-sub-price">
          {discount > 0 && <s>{money(unit, locale, config.currency)}</s>}
          {money(price, locale, config.currency)}
          {discount > 0 && <span className="pc-badge pc-badge-save">Save {discount}%</span>}
        </div>
        <div className="pc-sub-rows">
          <label className={`pc-sub-row ${type === "once" ? "is-active" : ""}`}>
            <input type="radio" name={`sub-type-${product.id}`} checked={type === "once"} onChange={() => setType("once")} />
            <span>One-time purchase</span>
          </label>
          <label className={`pc-sub-row ${type === "subscribe" ? "is-active" : ""}`}>
            <input type="radio" name={`sub-type-${product.id}`} checked={type === "subscribe"} onChange={() => setType("subscribe")} />
            <span>Subscribe & Save <strong>15%</strong></span>
          </label>
        </div>
        {type === "subscribe" && (
          <div className="pc-sub-intervals">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`pc-sub-interval ${interval === d ? "is-active" : ""}`}
                onClick={() => setInterval(d)}
              >
                Every {d} days · Save {subscriptionDiscount(d)}%
              </button>
            ))}
          </div>
        )}
        <button type="button" className="pc-add" onClick={subscribe}>
          {type === "subscribe" ? `Subscribe — ${money(price, locale, config.currency)}/delivery` : "Add to cart"}
        </button>
      </div>
    </div>
  );
}

export function SubscriptionOffers() {
  const enabled = useFeature("subscriptions");
  const { data } = useCatalog();
  if (!enabled) return null;
  const products = bestsellers(data?.products ?? [], 3);
  if (products.length === 0) return null;
  return (
    <div className="pc-sub-grid">
      {products.map((p) => (
        <SubscriptionSelector key={p.id} productId={p.id} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Express checkout                                                   */
/* ------------------------------------------------------------------ */

export function ExpressCheckout({ productId }: { productId?: string }) {
  const enabled = useFeature("expressCheckout");
  const { data } = useCatalog();
  const locale = useLocale();
  const config = useStoreConfig();
  const { addToCart, openCheckout } = useCart();
  const [selection, setSelection] = useState<Selection>({});

  if (!enabled) return null;
  const product = resolveProduct(productId, data?.products ?? []);
  if (!product) return null;
  const p = product;
  const section = data?.sectionById.get(p.section);
  const variant = findVariant(p, selection);
  const price = salePrice({ ...p, price: variant?.price ?? p.price });

  function buy() {
    if (!variant) return;
    addToCart(p, selection);
    openCheckout();
  }

  return (
    <div className="pc-express">
      {section && <VariantPicker product={p} section={section} selection={selection} onChange={setSelection} locale={locale} />}
      <button type="button" className="pc-express-buy" disabled={!variant} onClick={buy}>
        Buy now — {money(price, locale, config.currency)}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Catalog ratings & recommendations                                 */
/* ------------------------------------------------------------------ */

export function SocialProofCarousel() {
  const enabled = useFeature("socialProof");
  const { data } = useCatalog();
  const locale = useLocale();

  if (!enabled) return null;
  const products = (data?.products ?? []).filter((p) => p.reviews_count > 0).slice(0, 6);
  if (products.length === 0) return null;

  return (
    <div className="pc-social">
      <div className="pc-social-track">
        {products.map((p) => (
          <div key={p.id} className="pc-social-card">
            {p.images[0] ? <img src={p.images[0].image} alt={p.name} loading="lazy" /> : <div className="pc-noimg" />}
            <div className="pc-social-body">
              <div className="pc-social-stars" aria-label={`${p.rating.toFixed(1)} out of 5`}>
                {Array.from({ length: 5 }).map((_, n) => (
                  <IconStar key={n} filled={n < Math.round(p.rating)} />
                ))}
              </div>
              <p className="pc-social-quote">{p.name}</p>
              <span className="pc-social-buyer">
                {p.rating.toFixed(1)} / 5 · {t(locale, "product.reviews", p.reviews_count)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AIRecommendations({ placement }: { placement?: string }) {
  const enabled = useFeature("recommendations");
  const { data } = useCatalog();
  const recent = useRecentlyViewed();

  if (!enabled) return null;
  const products = data?.products ?? [];
  if (products.length === 0) return null;

  const recs = recommend(products, recent.ids, 4);
  return (
    <div className="pc-recs" data-placement={placement ?? ""}>
      <div className="pc-grid">
        {recs.map((p) => (
          <PremiumProductCard key={p.id} product={p} sections={data?.sections ?? []} showQuickView />
        ))}
      </div>
    </div>
  );
}

export function RecentlyViewed() {
  const enabled = useFeature("recentlyViewed");
  const recent = useRecentlyViewed();
  const { data } = useCatalog();

  if (!enabled) return null;
  const items = recent.ids.map((id) => data?.byId.get(id)).filter((p): p is Product => Boolean(p));
  if (items.length === 0) return null;

  return (
    <section className="pc-recent" aria-label="Recently viewed">
      <div className="pc-recent-head">
        <h3 className="pc-recent-title">Recently viewed</h3>
        <button type="button" className="pc-recent-clear" onClick={recent.clear}>
          Clear history
        </button>
      </div>
      <div className="pc-grid">
        {items.slice(0, 4).map((p) => (
          <PremiumProductCard key={p.id} product={p} sections={data?.sections ?? []} showQuickView />
        ))}
      </div>
    </section>
  );
}

export function WishlistButton({ productId }: { productId: number }) {
  const enabled = useFeature("wishlist");
  const wishlist = useWishlist();
  if (!enabled) return null;
  const id = Number(productId);
  const inList = wishlist.inList(id);
  return (
    <button
      type="button"
      className={`pc-wishlist ${inList ? "is-active" : ""}`}
      aria-pressed={inList}
      aria-label={inList ? "Remove from wishlist" : "Add to wishlist"}
      onClick={() => wishlist.toggle(id)}
    >
      <IconHeart />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Loyalty                                                            */
/* ------------------------------------------------------------------ */

const TIERS = [
  { name: "Bronze", min: 0, next: 500 },
  { name: "Silver", min: 500, next: 1500 },
  { name: "Gold", min: 1500, next: 3000 },
  { name: "Platinum", min: 3000, next: null },
];

export function LoyaltyDashboard() {
  const enabled = useFeature("loyaltyProgram");
  const { data } = useCatalog();
  const { showToast } = useCart();

  if (!enabled) return null;
  const products = data?.products ?? [];
  const points = products.reduce((sum, p) => sum + (p.loyalty_points || 0), 0) * 3;
  const tier = [...TIERS].reverse().find((tr) => points >= tr.min) ?? TIERS[0];
  const nextTier = TIERS.find((tr) => tr.min > tier.min);
  const progress = nextTier ? Math.min(100, Math.round(((points - tier.min) / (nextTier.min - tier.min)) * 100)) : 100;
  const rewards = products.filter((p) => p.loyalty_points > 0).sort((a, b) => b.loyalty_points - a.loyalty_points).slice(0, 4);

  return (
    <div className="pc-loyalty">
      <div className="pc-loyalty-head">
        <div>
          <span className="pc-loyalty-tier">{tier.name} member</span>
          <h3 className="pc-loyalty-points">{points.toLocaleString()} pts</h3>
        </div>
        {nextTier && (
          <span className="pc-loyalty-next">
            {nextTier.min - points} pts to {nextTier.name}
          </span>
        )}
      </div>
      <div className="pc-loyalty-track">
        <div className="pc-loyalty-bar">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="pc-loyalty-rewards">
        {rewards.map((p) => (
          <div key={p.id} className="pc-loyalty-reward">
            {p.images[0] ? <img src={p.images[0].image} alt={p.name} loading="lazy" /> : <div className="pc-noimg" />}
            <span className="pc-loyalty-reward-name">{p.name}</span>
            <span className="pc-loyalty-reward-pts">{p.loyalty_points} pts</span>
            <button
              type="button"
              className="pc-loyalty-redeem"
              onClick={() => showToast(`Redeemed ${p.name} for ${p.loyalty_points} pts`)}
            >
              Redeem
            </button>
          </div>
        ))}
      </div>
      <div className="pc-loyalty-refer">
        <span>Refer a friend and you both get 250 pts.</span>
        <button
          type="button"
          className="pc-loyalty-refer-btn"
          onClick={() => showToast("Referral link copied — thanks!")}
        >
          Share referral link
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tiered pricing / B2B                                               */
/* ------------------------------------------------------------------ */

export function TieredPricing({ productId }: { productId?: number }) {
  const enabled = useFeature("tieredPricing");
  const { data } = useCatalog();
  const locale = useLocale();
  const config = useStoreConfig();
  const { showToast } = useCart();

  if (!enabled) return null;
  const product = typeof productId === "number" && data ? data.byId.get(productId) : undefined;
  if (!product) return null;

  const base = salePrice(product);
  const tiers = [
    { qty: "1–4", off: 0 },
    { qty: "5–9", off: 5 },
    { qty: "10–24", off: 10 },
    { qty: "25+", off: 15 },
  ];

  return (
    <div className="pc-tiered">
      <h4 className="pc-tiered-title">Volume pricing — {product.name}</h4>
      <div className="pc-tiered-rows">
        {tiers.map((tr) => (
          <div key={tr.qty} className="pc-tiered-row">
            <span>{tr.qty} units</span>
            <span className="pc-tiered-unit">
              {money(Math.round(base * (1 - tr.off / 100)), locale, config.currency)}
              {tr.off > 0 && <em className="pc-tiered-off">Save {tr.off}%</em>}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="pc-tiered-cta"
        onClick={() => {
          window.location.hash = "#/quotes";
          showToast("Add this product to your quote request");
        }}
      >
        Build a quote
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quote builder                                                      */
/* ------------------------------------------------------------------ */

export function QuoteBuilder() {
  const enabled = useFeature("quoteBuilder");
  const { data } = useCatalog();
  const locale = useLocale();
  const config = useStoreConfig();
  const [items, setItems] = useState<{ id: number; qty: number }[]>([]);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);

  if (!enabled) return null;
  const products = data?.products ?? [];
  const byId = data?.byId ?? new Map<number, Product>();
  const total = items.reduce((sum, it) => {
    const p = byId.get(it.id);
    return p ? sum + salePrice(p) * it.qty : sum;
  }, 0);
  const summary = [
    `Company: ${company}`,
    `Contact: ${email}`,
    "Requested products:",
    ...items.map((item) => {
      const product = byId.get(item.id);
      return product ? `- ${product.name} × ${item.qty}` : "";
    }).filter(Boolean),
    `Estimated subtotal: ${money(total, locale, config.currency)}`,
    notes ? `Notes: ${notes}` : "",
  ].filter(Boolean).join("\n");

  function addToQuote(id: number) {
    setItems((prev) => (prev.some((it) => it.id === id) ? prev : [...prev, { id, qty: 1 }]));
  }
  function setQty(id: number, qty: number) {
    setItems((prev) => (qty <= 0 ? prev.filter((it) => it.id !== id) : prev.map((it) => (it.id === id ? { ...it, qty } : it))));
  }

  return (
    <div className="pc-quote">
      <div className="pc-quote-grid">
        <div className="pc-quote-picker">
          <h4>Add products to your quote</h4>
          <div className="pc-quote-list">
            {products.slice(0, 6).map((p) => (
              <button key={p.id} type="button" className="pc-quote-add" onClick={() => addToQuote(p.id)}>
                {p.images[0] ? <img src={p.images[0].image} alt="" /> : <div className="pc-noimg" />}
                <span>{p.name}</span>
                <em>+</em>
              </button>
            ))}
          </div>
        </div>
        <div className="pc-quote-cart">
          <h4>Quote cart</h4>
          {items.length === 0 ? (
            <p className="ds-body">Your quote cart is empty — add products to build a request.</p>
          ) : (
            <div className="pc-quote-items">
              {items.map((it) => {
                const p = byId.get(it.id);
                if (!p) return null;
                return (
                  <div key={it.id} className="pc-quote-item">
                    <span>{p.name}</span>
                    <div className="pc-qty">
                      <button type="button" onClick={() => setQty(it.id, it.qty - 1)}>−</button>
                      <span>{it.qty}</span>
                      <button type="button" onClick={() => setQty(it.id, it.qty + 1)}>+</button>
                    </div>
                    <span>{money(salePrice(p) * it.qty, locale, config.currency)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="pc-quote-total">
            <span>Subtotal</span>
            <strong>{money(total, locale, config.currency)}</strong>
          </div>
          {sent ? (
            <div className="pc-quote-done">
              <strong>Quote summary generated.</strong>
              <span>Review the request below before sharing it with the store.</span>
              <pre className="pc-quote-summary-text">{summary}</pre>
              <button type="button" className="pc-add" onClick={() => setSent(false)}>Edit quote</button>
            </div>
          ) : (
            <form
              className="pc-quote-form"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <input required placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
              <input required type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <textarea placeholder="Notes (quantities, specs, timeline…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button type="submit" className="pc-add" disabled={items.length === 0}>
                Generate quote summary
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account dashboard                                                  */
/* ------------------------------------------------------------------ */

type AccountTab = "wishlist" | "compare" | "addresses" | "loyalty";

export function AccountDashboard() {
  const enabled = useFeature("accountDashboard");
  const { hasFeature, storeConfig } = usePremiumStorefront();
  const { data } = useCatalog();
  const wishlist = useWishlist();
  const compare = useCompare();
  const { showToast } = useCart();
  const [tab, setTab] = useState<AccountTab>(() => {
    if (hasFeature("wishlist")) return "wishlist";
    if (hasFeature("compare")) return "compare";
    if (hasFeature("savedAddresses")) return "addresses";
    return "loyalty";
  });
  const addressStorageKey = `premium:${storeConfig.slug ?? storeConfig.storeName}:shipping-address`;
  const [address, setAddress] = useState(() => {
    if (typeof window === "undefined") return { street: "", city: "", zip: "" };
    try {
      const saved = window.localStorage.getItem(addressStorageKey);
      if (!saved) return { street: "", city: "", zip: "" };
      const parsed: unknown = JSON.parse(saved);
      if (
        typeof parsed === "object" && parsed !== null &&
        "street" in parsed && typeof parsed.street === "string" &&
        "city" in parsed && typeof parsed.city === "string" &&
        "zip" in parsed && typeof parsed.zip === "string"
      ) {
        return { street: parsed.street, city: parsed.city, zip: parsed.zip };
      }
      return { street: "", city: "", zip: "" };
    } catch {
      return { street: "", city: "", zip: "" };
    }
  });

  if (!enabled) return null;
  const wishItems = wishlist.ids.map((id) => data?.byId.get(id)).filter((p): p is Product => Boolean(p));

  const tabs: { key: AccountTab; label: string; count?: number }[] = [];
  if (hasFeature("wishlist")) tabs.push({ key: "wishlist", label: "Wishlist", count: wishlist.count });
  if (hasFeature("compare")) tabs.push({ key: "compare", label: "Compare", count: compare.count });
  if (hasFeature("savedAddresses")) tabs.push({ key: "addresses", label: "Addresses" });
  if (hasFeature("loyaltyProgram")) tabs.push({ key: "loyalty", label: "Loyalty" });

  return (
    <div className="pc-account">
      <aside className="pc-account-nav" aria-label="Account">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            className={`pc-account-tab ${tab === tb.key ? "is-active" : ""}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
            {tb.count !== undefined && tb.count > 0 && <em>{tb.count}</em>}
          </button>
        ))}
      </aside>
      <div className="pc-account-panel">
        {tab === "wishlist" &&
          (wishItems.length === 0 ? (
            <div className="pc-account-empty">
              <h3>Wishlist</h3>
              <p>Tap the heart on any product to save it here.</p>
            </div>
          ) : (
            <div className="pc-grid">
              {wishItems.map((p) => (
                <PremiumProductCard key={p.id} product={p} sections={data?.sections ?? []} showQuickView />
              ))}
            </div>
          ))}
        {tab === "compare" && <ComparisonTable />}
        {tab === "addresses" && (
          <form
            className="pc-address-form"
            onSubmit={(e) => {
              e.preventDefault();
              window.localStorage.setItem(addressStorageKey, JSON.stringify(address));
              showToast("Address saved");
            }}
          >
            <h3>Shipping address</h3>
            <input required placeholder="Street address" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
            <div className="pc-address-row">
              <input required placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              <input required placeholder="Postal code" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
            </div>
            <button type="submit" className="pc-add">Save address</button>
          </form>
        )}
        {tab === "loyalty" && <LoyaltyDashboard />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gift / recovery / lookbook / video                                 */
/* ------------------------------------------------------------------ */

export function GiftOptions() {
  const enabled = useFeature("giftWrapping");
  const { showToast } = useCart();
  const [option, setOption] = useState<"none" | "standard" | "premium">("none");
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState(false);

  if (!enabled) return null;

  return (
    <div className="pc-gift">
      <h4 className="pc-gift-title">Gift options</h4>
      <div className="pc-gift-rows">
        {(
          [
            { key: "none", label: "No gift wrapping", price: 0 },
            { key: "standard", label: "Standard wrap", price: 3 },
            { key: "premium", label: "Premium box + ribbon", price: 7 },
          ] as const
        ).map((g) => (
          <label key={g.key} className={`pc-gift-row ${option === g.key ? "is-active" : ""}`}>
            <input type="radio" name="gift" checked={option === g.key} onChange={() => setOption(g.key)} />
            <span>{g.label}</span>
            <em>{g.price === 0 ? "Free" : `+$${g.price}`}</em>
          </label>
        ))}
      </div>
      {option !== "none" && (
        <textarea
          className="pc-gift-message"
          placeholder="Gift message (max 200 chars)"
          maxLength={200}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      )}
      <label className="pc-gift-receipt">
        <input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} />
        Include gift receipt (prices hidden)
      </label>
      <button
        type="button"
        className="pc-add"
        onClick={() => showToast("Gift options saved")}
      >
        Save gift options
      </button>
    </div>
  );
}

export function AbandonedCartRecovery() {
  const enabled = useFeature("abandonedCartRecovery");
  const { cart, cartCount, openCart } = useCart();
  if (!enabled) return null;
  if (cart.length === 0) return null;

  return (
    <div className="pc-recovery">
      <span className="pc-recovery-mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="20" r="1" />
          <circle cx="19" cy="20" r="1" />
          <path d="M3 4h2l2.5 11h10.8l2-7H6" />
        </svg>
      </span>
      <div className="pc-recovery-copy">
        <strong>You have {cartCount} item{cartCount === 1 ? "" : "s"} waiting in your cart</strong>
        <p>Your selection is saved here whenever you are ready to continue.</p>
      </div>
      <button type="button" className="pc-recovery-cta" onClick={openCart}>
        Resume your order
      </button>
    </div>
  );
}

export function LookbookViewer({ lookbookId }: { lookbookId?: string }) {
  const enabled = useFeature("lookbook");
  const { data } = useCatalog();
  const quickView = useQuickView();
  const locale = useLocale();

  if (!enabled) return null;
  const products = selectHomepageProducts(data?.products ?? [], "featured", 6);
  if (products.length === 0) return null;

  return (
    <div className="pc-lookbook" data-lookbook={lookbookId ?? ""}>
      <div className="pc-lookbook-grid">
        {products.map((p, i) => (
          <article key={p.id} className={`pc-lookbook-card pc-lookbook-card-${(i % 3) + 1}`}>
            <div className="pc-lookbook-media">
              {p.images[0] ? <img src={p.images[0].image} alt={p.name} loading="lazy" /> : <div className="pc-noimg" />}
              <button
                type="button"
                className="pc-lookbook-hotspot"
                aria-label={`Shop ${p.name}`}
                onClick={() => quickView.open(p.id)}
              >
                +
              </button>
            </div>
            <div className="pc-lookbook-meta">
              <h3>{p.name}</h3>
              <Price product={p} locale={locale} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function VideoCommercePlayer() {
  const enabled = useFeature("videoCommerce");
  const { data } = useCatalog();
  const quickView = useQuickView();

  if (!enabled) return null;
  const products = (data?.products ?? []).slice(0, 3);
  if (products.length === 0) return null;

  return (
    <div className="pc-video-grid">
      {products.map((p) => (
        <div key={p.id} className="pc-video-card">
          <div className="pc-video-thumb">
            {p.images[0] ? <img src={p.images[0].image} alt={p.name} loading="lazy" /> : <div className="pc-noimg" />}
            <button type="button" className="pc-play-btn" aria-label={`Watch ${p.name}`} onClick={() => quickView.open(p.id)}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          <div className="pc-video-meta">
            <h3>{p.name}</h3>
            <span>Shoppable video</span>
            <button type="button" onClick={() => quickView.open(p.id)}>
              Shop this look
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
