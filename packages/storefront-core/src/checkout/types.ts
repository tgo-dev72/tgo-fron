import type { Locale } from "../i18n";

/**
 * Generic checkout contract for the storefront. No store/vertical/backend
 * specifics leak into the design — everything is driven by store.config.ts
 * and a CheckoutService implementation. The production implementation posts
 * to the store-platform API; a simulated one can be swapped in for previews.
 */

export type PaymentMethod = "cod" | "card";

export interface CheckoutContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
}

export interface CheckoutLine {
  /** Product id (also the line key). */
  id: number;
  /** Product id sent to the API. */
  productId: number;
  /** StockVariant id sent to the API (resolved from the cart; never null here). */
  variantId: number | null;
  name: string;
  /** Human-readable variant summary (attributes joined). */
  variant: string;
  qty: number;
  /** Quantity originally requested before stock allocation. */
  requestedQty?: number;
  unitPrice: number;
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax?: number;
  total: number;
}

export interface CheckoutQuote extends CheckoutTotals {
  currency: string;
  couponCode: string;
}

export interface PlaceOrderInput {
  reviewedTotals?: CheckoutQuote;
  contact: CheckoutContact;
  marketingConsent: boolean;
  method: PaymentMethod;
  lines: CheckoutLine[];
  totals: CheckoutTotals;
  currency: string;
  locale: Locale;
  /** Stable for retries of an unchanged checkout, preventing duplicate orders. */
  idempotencyKey: string;
  couponCode?: string;
}

export interface CheckoutOrder {
  reference: string;
  placedAt: string;
  contact: CheckoutContact;
  lines: CheckoutLine[];
  totals: CheckoutTotals;
  currency: string;
  method: PaymentMethod;
  /** Backend is_paid: pending | confirmed | failed | cod. */
  paidStatus?: string;
  /** Fulfilment lifecycle returned by the order endpoint. */
  status?: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  trackingNumber?: string;
  carrier?: string;
  /** True when one or more requested quantities were reduced at placement. */
  hasAdjustments?: boolean;
  couponCode?: string;
  couponDiscountType?: "percentage" | "fixed" | "";
  couponValue?: number | null;
}

export interface PlaceOrderResult {
  order: CheckoutOrder;
  /**
   * For online (card) orders: the hosted payment URL the browser redirects
   * to. Null for COD.
   */
  paymentUrl: string | null;
  /** The order exists, but its hosted checkout could not be opened yet. */
  paymentUnavailable?: boolean;
}

export type PaymentStatus = "pending" | "confirmed" | "failed";

export interface CheckoutService {
  quoteOrder(input: PlaceOrderInput): Promise<CheckoutQuote>;
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  /** Poll helper for the hosted-payment return flow. */
  verifyOrder(orderId: string): Promise<PaymentStatus>;
  /** Fresh order detail (used by the tracking view). */
  getOrder(orderId: string): Promise<CheckoutOrder>;
  /** Fresh hosted-payment URL for a failed/pending online order (retry). */
  retryPayment(orderId: string, locale: Locale): Promise<string>;
  /** Mark a pending online order failed + release its reservation. */
  cancelOrder(orderId: string): Promise<void>;
}
