import { createStore, useStore } from "./store";

/**
 * Premium state hooks — all reactive, persisted in localStorage, shared
 * across every component that reads them (ProductDiscovery cards, the quick
 * view modal, compare bar/table, faceted filters, wishlist, etc.) no matter
 * where they sit in the tree.
 */

const COMPARE_KEY = "pf:compare";
const WISHLIST_KEY = "pf:wishlist";
const RECENT_KEY = "pf:recent";

const MAX_COMPARE = 4;
const MAX_RECENT = 20;

function readIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // storage unavailable — keep state in-memory only
  }
}

const compareStore = createStore<number[]>(typeof window === "undefined" ? [] : readIds(COMPARE_KEY));
const wishlistStore = createStore<number[]>(typeof window === "undefined" ? [] : readIds(WISHLIST_KEY));
const recentStore = createStore<number[]>(typeof window === "undefined" ? [] : readIds(RECENT_KEY));

/** Product Compare — reactive, persisted, max 4. */
export function useCompare() {
  const ids = useStore(compareStore);
  return {
    ids,
    count: ids.length,
    inList: (id: number) => ids.includes(id),
    toggle: (id: number) => {
      compareStore.set((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : prev.length >= MAX_COMPARE
            ? prev
            : [...prev, id];
        writeIds(COMPARE_KEY, next);
        return next;
      });
    },
    remove: (id: number) => {
      compareStore.set((prev) => {
        const next = prev.filter((x) => x !== id);
        writeIds(COMPARE_KEY, next);
        return next;
      });
    },
    clear: () => {
      compareStore.set(() => {
        writeIds(COMPARE_KEY, []);
        return [];
      });
    },
    max: MAX_COMPARE,
  };
}

/** Wishlist — reactive, persisted. */
export function useWishlist() {
  const ids = useStore(wishlistStore);
  return {
    ids,
    count: ids.length,
    inList: (id: number) => ids.includes(id),
    toggle: (id: number) => {
      wishlistStore.set((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        writeIds(WISHLIST_KEY, next);
        return next;
      });
    },
    remove: (id: number) => {
      wishlistStore.set((prev) => {
        const next = prev.filter((x) => x !== id);
        writeIds(WISHLIST_KEY, next);
        return next;
      });
    },
  };
}

/** Recently viewed — most recent first, capped. */
export function useRecentlyViewed() {
  const ids = useStore(recentStore);
  return {
    ids,
    add: (id: number) => {
      recentStore.set((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
        writeIds(RECENT_KEY, next);
        return next;
      });
    },
    clear: () => {
      recentStore.set(() => {
        writeIds(RECENT_KEY, []);
        return [];
      });
    },
  };
}

const quickViewStore = createStore<number | null>(null);

/** Quick View — which product is open in the shared quick-view modal. */
export function useQuickView() {
  const productId = useStore(quickViewStore);
  return {
    productId,
    open: (id: number) => {
      recentStore.set((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
        writeIds(RECENT_KEY, next);
        return next;
      });
      quickViewStore.set(() => id);
    },
    close: () => quickViewStore.set(() => null),
  };
}

export interface FacetSelections {
  [attributeKey: string]: string[];
}

const facetStore = createStore<FacetSelections>({});

/** Faceted search selections — attribute key → selected option values. */
export function useFacets() {
  const selections = useStore(facetStore);
  const activeCount = Object.values(selections).reduce((n, arr) => n + arr.length, 0);
  return {
    selections,
    activeCount,
    toggle: (attributeKey: string, value: string) => {
      facetStore.set((prev) => {
        const cur = prev[attributeKey] ?? [];
        const nextVals = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
        const next: FacetSelections = { ...prev, [attributeKey]: nextVals };
        if (nextVals.length === 0) delete next[attributeKey];
        return next;
      });
    },
    clear: () => facetStore.set(() => ({})),
  };
}
