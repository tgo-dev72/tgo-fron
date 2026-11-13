/**
 * Production CheckoutService — posts to the store-platform API.
 *
 * Flow:
 * - POST /api/orders/        creates a pending order, reserves stock and
 *                            snapshots the items.
 * - POST /api/payments/      online orders get a hosted YCPay payment URL;
 *                            the browser redirects there.
 * - POST /api/payments/verify/  polled on return from the gateway until the
 *                            order is confirmed or failed.
 * - POST /api/payments/cancel/  releases the reservation if the customer
 *                            abandons a pending online order.
 */
import { request } from "../api/client";
import type { Locale } from "../i18n";
import type {
  CheckoutContact,
  CheckoutQuote,
  CheckoutLine,
  CheckoutOrder,
  CheckoutService,
  PaymentStatus,
  PlaceOrderInput,
  PlaceOrderResult,
} from "./types";

interface OrderItemResponse {
  product_id: number;
  variant_id: number | null;
  ref: string;
  name: string;
  attributes: Record<string, unknown>;
  quantity: number;
  fulfilled_quantity?: number;
  price: number;
}

interface OrderResponse {
  order_id: string;
  amount: number;
  subtotal?: number;
  shipping_amount?: number;
  tax_amount?: number;
  discount_amount?: number;
  coupon_code?: string;
  coupon_discount_type?: "percentage" | "fixed" | "";
  coupon_value?: number | null;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  exception: boolean;
  payment_mode: string;
  is_paid: string;
  currency: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_city?: string;
  customer_address?: string;
  tracking_number?: string;
  carrier?: string;
  created_at: string;
  items: OrderItemResponse[];
}

interface PaymentUrlResponse {
  payment_url: string;
  order_id: string;
}

interface VerifyResponse {
  verified: boolean;
  status: string;
}

function variantSummary(attributes: Record<string, unknown>): string {
  return Object.values(attributes)
    .map((a) => (Array.isArray(a) ? a.join(" / ") : String(a)))
    .join(" · ");
}

export function contactFromOrder(raw: Pick<OrderResponse, "customer_name" | "customer_email" | "customer_phone" | "customer_city" | "customer_address">): CheckoutContact {
  const name = (raw.customer_name ?? "").trim();
  const first = name.split(/\s+/)[0] ?? "";
  const last = name.split(/\s+/).slice(1).join(" ");
  return {
    firstName: first,
    lastName: last,
    email: raw.customer_email ?? "",
    phone: raw.customer_phone ?? "",
    city: raw.customer_city ?? "",
    address: raw.customer_address ?? "",
  };
}

export function mapOrder(raw: OrderResponse, input?: PlaceOrderInput): CheckoutOrder {
  const legacySubtotal = raw.items.reduce((sum, it) => sum + Number(it.price) * (it.fulfilled_quantity ?? it.quantity), 0);
  const subtotal = raw.subtotal === undefined ? legacySubtotal : Number(raw.subtotal);
  const total = Number(raw.amount);
  const discount = raw.discount_amount === undefined ? 0 : Number(raw.discount_amount);
  const shipping = raw.shipping_amount === undefined
    ? Math.max(0, Math.round((total - subtotal + discount) * 100) / 100)
    : Number(raw.shipping_amount);
  const tax = raw.tax_amount === undefined ? 0 : Number(raw.tax_amount);
  const method = input?.method ?? (raw.payment_mode === "cod" ? "cod" : "card");
  return {
    reference: raw.order_id,
    placedAt: raw.created_at,
    contact: input ? input.contact : contactFromOrder(raw),
    lines: raw.items.map((it): CheckoutLine => ({
      id: it.product_id,
      productId: it.product_id,
      productRef: it.ref,
      variantId: it.variant_id,
      name: it.name,
      variant: variantSummary(it.attributes),
      qty: it.fulfilled_quantity ?? it.quantity,
      requestedQty: it.quantity,
      unitPrice: Number(it.price),
    })),
    totals: { subtotal, discount, shipping, ...(raw.tax_amount === undefined ? {} : { tax }), total },
    currency: raw.currency,
    method,
    paidStatus: raw.is_paid,
    status: raw.status,
    trackingNumber: raw.tracking_number ?? "",
    carrier: raw.carrier ?? "",
    hasAdjustments: raw.exception,
    couponCode: raw.coupon_code ?? "",
    couponDiscountType: raw.coupon_discount_type ?? "",
    couponValue: raw.coupon_value == null ? null : Number(raw.coupon_value),
  };
}

export class CheckoutError extends Error {}

function orderPayload(input: PlaceOrderInput) {
  return {
    expected_totals: input.reviewedTotals ? {
      subtotal: input.reviewedTotals.subtotal, discount: input.reviewedTotals.discount,
      shipping: input.reviewedTotals.shipping, total: input.reviewedTotals.total,
      tax: input.reviewedTotals.tax ?? 0,
      currency: input.reviewedTotals.currency,
    } : undefined,
    payment_mode: input.method === "cod" ? "cod" : "online",
    marketing_consent: input.marketingConsent,
    marketing_tracking_consent: input.marketingTrackingConsent === true,
    marketing_tracking_id: input.marketingTrackingConsent === true ? input.marketingTrackingId ?? "" : "",
    coupon_code: input.couponCode?.trim() ?? "",
    customer: {
      name: `${input.contact.firstName} ${input.contact.lastName}`.trim(),
      email: input.contact.email,
      phone: input.contact.phone,
      city: input.contact.city,
      address: input.contact.address,
    },
    items: input.lines.map((line) => ({
      product_id: line.productId,
      variant_id: line.variantId,
      quantity: line.qty,
    })),
  };
}

export function createCheckoutService(): CheckoutService {
  return {
    async quoteOrder(input: PlaceOrderInput): Promise<CheckoutQuote> {
      const quote = await request<{ subtotal: number; discount: number; shipping: number; tax: number; total: number; currency: string; coupon_code: string }>("/api/orders/quote/", {
        method: "POST", body: JSON.stringify(orderPayload(input)),
      });
      return {
        subtotal: Number(quote.subtotal), discount: Number(quote.discount),
        shipping: Number(quote.shipping), total: Number(quote.total),
        tax: Number(quote.tax || 0),
        currency: quote.currency, couponCode: quote.coupon_code,
      };
    },
    async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
      const payload = orderPayload(input);

      const raw = await request<OrderResponse>("/api/orders/", {
        method: "POST",
        headers: { "Idempotency-Key": input.idempotencyKey },
        body: JSON.stringify(payload),
      });

      if (raw.items.length === 0) {
        throw new CheckoutError("Order was not created — no items were recognized.");
      }

      const order = mapOrder(raw, input);
      let paymentUrl: string | null = null;

      if (input.method === "card" && raw.is_paid === "pending") {
        const base = `${window.location.origin}${window.location.pathname}`;
        const success = `${base}?order_id=${encodeURIComponent(raw.order_id)}`;
        try {
          const pay = await request<PaymentUrlResponse>("/api/payments/", {
            method: "POST",
            body: JSON.stringify({
              order_id: raw.order_id,
              tokenParams: { success_url: success, error_url: success, lang: input.locale },
            }),
          });
          paymentUrl = pay.payment_url;
        } catch {
          // Preserve the submitted order and its retry path when the gateway
          // is unavailable; it still belongs in the submission funnel.
          return { order, paymentUrl: null, paymentUnavailable: true };
        }
      }

      return { order, paymentUrl };
    },

    async verifyOrder(orderId: string): Promise<PaymentStatus> {
      const res = await request<VerifyResponse>("/api/payments/verify/", {
        method: "POST",
        body: JSON.stringify({ order_id: orderId }),
      });
      return res.status as PaymentStatus;
    },

    async getOrder(orderId: string): Promise<CheckoutOrder> {
      const raw = await request<OrderResponse>(`/api/orders/${encodeURIComponent(orderId)}/`);
      return mapOrder(raw);
    },

    async retryPayment(orderId: string, locale: Locale): Promise<string> {
      const base = `${window.location.origin}${window.location.pathname}`;
      const success = `${base}?order_id=${encodeURIComponent(orderId)}`;
      const res = await request<PaymentUrlResponse>("/api/payments/retry/", {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          tokenParams: { success_url: success, error_url: success, lang: locale },
        }),
      });
      return res.payment_url;
    },

    async cancelOrder(orderId: string): Promise<void> {
      await request<unknown>("/api/payments/cancel/", {
        method: "POST",
        body: JSON.stringify({ order_id: orderId }),
      });
    },
  };
}

/** Locale → the two-letter code the payment gateway understands. */
export function gatewayLang(locale: Locale): string {
  return locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en";
}
