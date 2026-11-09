import { useEffect, useState } from "react";
import { api, useLocale } from "@storefront/core";
import type { CatalogSection, Product } from "@storefront/core";

/**
 * Shared catalog access for premium widgets. Every component that needs the
 * catalog calls useCatalog(); the underlying fetch is cached per-locale at
 * module scope (one request, shared by every consumer) and refetched when the
 * storefront language changes — matching the base <Storefront> behavior.
 */

export interface CatalogData {
  sections: CatalogSection[];
  products: Product[];
  byId: Map<number, Product>;
  sectionById: Map<number, CatalogSection>;
}

const inflight = new Map<string, Promise<CatalogData>>();

function fetchCatalog(locale: string): Promise<CatalogData> {
  let pending = inflight.get(locale);
  if (!pending) {
    pending = Promise.all([api.getSections(locale), api.getProducts(undefined, locale)]).then(([sections, products]) => ({
      sections,
      products,
      byId: new Map(products.map((p) => [p.id, p])),
      sectionById: new Map(sections.map((s) => [s.id, s])),
    }));
    inflight.set(locale, pending);
  }
  return pending;
}

export interface CatalogState {
  data: CatalogData | null;
  loading: boolean;
  error: string | null;
}

export function useCatalog(): CatalogState {
  const locale = useLocale();
  const [data, setData] = useState<CatalogData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchCatalog(locale)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return { data, loading: data === null && error === null, error };
}
