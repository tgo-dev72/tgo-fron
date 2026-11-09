import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CatalogSection, Product, Variant } from "../api/types";
import { t } from "../i18n";
import type { Locale } from "../i18n";
import { findVariant, salePrice, variantLabel } from "./components";
import type { CartItem, Selection } from "./components";
import { trackStorefrontEvent } from "../api/analytics";

/**
 * Shared cart state for a storefront instance. <Storefront> owns the provider;
 * any component rendered inside it (the base storefront itself, premium
 * widgets like QuickView/Bundles/ExpressCheckout, or custom children) can
 * call useCart() to read and mutate the same cart — so the nav badge, cart
 * drawer and checkout all stay in sync regardless of who adds an item.
 */

export interface CartContextValue {
  cart: CartItem[];
  cartCount: number;
  drawerOpen: boolean;
  checkoutOpen: boolean;
  toast: string | null;
  /** Add a product (with an optional variant selection). Shows a toast on success. */
  addToCart: (product: Product, selection?: Selection, quantity?: number) => void;
  /** Set an item's quantity; 0 removes it. */
  setQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  openCart: () => void;
  closeCart: () => void;
  /** Open the checkout flow directly (closes the drawer). */
  openCheckout: () => void;
  closeCheckout: () => void;
  showToast: (message: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// A family route can remount Storefront. Keep the cart for this browser page,
// isolated by store, so browsing a content/account page cannot discard it.
const cartsByStore = new Map<string, CartItem[]>();

function storedCart(storeKey: string): CartItem[] {
  const inMemory = cartsByStore.get(storeKey);
  if (inMemory) return inMemory;
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(`tijarago-cart:${storeKey}`) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItem => {
      if (!item || typeof item !== "object") return false;
      const row = item as Partial<CartItem>;
      return typeof row.key === "string" && typeof row.product?.id === "number"
        && Number.isInteger(row.qty) && row.qty! > 0 && row.qty! <= 100
        && typeof row.unitPrice === "number" && Number.isFinite(row.unitPrice) && row.unitPrice >= 0
        && typeof row.maxQty === "number" && row.maxQty >= row.qty!;
    });
  } catch { return []; }
}

export function CartProvider({
  children,
  storeKey,
  sections,
  locale,
}: {
  children: ReactNode;
  storeKey: string;
  sections: CatalogSection[];
  locale: Locale;
}) {
  const [cart, setCart] = useState<CartItem[]>(() => storedCart(storeKey));
  useEffect(() => {
    if (cart.length) cartsByStore.set(storeKey, cart);
    else cartsByStore.delete(storeKey);
    try {
      const key = `tijarago-cart:${storeKey}`;
      if (cart.length) window.sessionStorage.setItem(key, JSON.stringify(cart));
      else window.sessionStorage.removeItem(key);
    } catch { /* Browser storage can be disabled; in-memory cart remains usable. */ }
  }, [cart, storeKey]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("order_id"),
  );
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (toast === null) return;
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(toastTimer.current);
  }, [toast]);

  const cartCount = cart.reduce((n, it) => n + it.qty, 0);

  function showToast(message: string) {
    setToast(message);
  }

  function addToCart(product: Product, selection: Selection = {}, quantity = 1) {
    const simpleProduct = product.uses_variants === false;
    const inventoryVariant = simpleProduct
      ? product.variants.find((candidate) => Object.keys(candidate.attributes ?? {}).length === 0) ?? product.variants[0]
      : undefined;
    let variant: Variant | undefined = inventoryVariant;
    if (!simpleProduct) {
      variant = findVariant(product, selection);
      if (!variant) {
        showToast(t(locale, "product.variantUnavailable"));
        return;
      }
    }
    const available = simpleProduct
      ? Number(product.inventory ?? inventoryVariant?.available_quantity ?? 0)
      : Number(variant?.available_quantity ?? 0);
    if (product.track_inventory !== false && available <= 0) {
      showToast(t(locale, "product.variantUnavailable"));
      return;
    }
    const unitPrice = salePrice({
      price: variant?.effective_price ?? variant?.price ?? product.price,
      promo: product.promo,
      compare_at_price: variant?.effective_compare_at_price ?? product.compare_at_price,
    });
    const maxQty = product.track_inventory === false ? Number.MAX_SAFE_INTEGER : available;
    const requestedQty = Math.max(1, Math.trunc(quantity) || 1);
    const key = simpleProduct ? `${product.id}:simple` : `${product.id}:${variant?.id}`;
    setCart((prev) => {
      const existing = prev.find((it) => it.key === key);
      if (existing) {
        return prev.map((it) => (it.key === key ? { ...it, qty: Math.min(it.qty + requestedQty, it.maxQty) } : it));
      }
      return [
        ...prev,
        {
          key,
          product,
          variantId: simpleProduct ? null : variant?.id ?? null,
          variantLabel: simpleProduct || !variant ? "" : variantLabel(product, variant, sections),
          qty: Math.min(requestedQty, maxQty),
          unitPrice,
          maxQty,
        },
      ];
    });
    trackStorefrontEvent({
      eventType: "add_to_cart",
      productId: product.id,
      variantId: simpleProduct ? null : variant?.id ?? null,
      properties: { quantity: Math.min(requestedQty, maxQty), cart_value: unitPrice * Math.min(requestedQty, maxQty) },
    });
    showToast(`${t(locale, "product.addToCart")} — ${product.name}`);
  }

  function setQty(key: string, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((it) => it.key !== key)
        : prev.map((it) => (it.key === key ? { ...it, qty: Math.min(qty, it.maxQty) } : it)),
    );
  }

  const value: CartContextValue = {
    cart,
    cartCount,
    drawerOpen,
    checkoutOpen,
    toast,
    addToCart,
    setQty,
    removeItem: (key) => setQty(key, 0),
    openCart: () => setDrawerOpen(true),
    closeCart: () => setDrawerOpen(false),
    openCheckout: () => {
      setDrawerOpen(false);
      setCheckoutOpen(true);
      trackStorefrontEvent({
        eventType: "checkout_started",
        properties: {
          quantity: cartCount,
          cart_value: cart.reduce((total, item) => total + item.unitPrice * item.qty, 0),
        },
      });
    },
    closeCheckout: () => setCheckoutOpen(false),
    showToast,
    clearCart: () => setCart([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a <CartProvider>");
  return ctx;
}
