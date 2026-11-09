export type PaymentReturnResult = "success" | "failed" | null;

export interface PaymentReturnState {
  isReturn: boolean;
  result: PaymentReturnResult;
  paymentId: string | null;
}

export const SUBSCRIPTION_STATUS_EVENT = "tijarago:subscription-status-updated";

export function announceSubscriptionStatusUpdate(): void {
  window.dispatchEvent(new Event(SUBSCRIPTION_STATUS_EVENT));
}

const RETURN_KEYS = new Set([
  "payment",
  "payment_id",
  "transaction_id",
  "is_success",
  "success",
  "order_id",
  "code",
]);

const BUSINESS_CONTEXT_KEYS = new Set(["design", "store"]);

function successFlag(value: string | null): PaymentReturnResult {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "success", "succeeded", "paid"].includes(normalized)) return "success";
  if (["0", "false", "failed", "failure", "error", "cancelled", "canceled"].includes(normalized)) return "failed";
  return null;
}

export function readPaymentReturn(search: string): PaymentReturnState {
  const params = new URLSearchParams(search);
  const isReturn = [...RETURN_KEYS].some((key) => params.has(key));
  const explicitResult = successFlag(params.get("payment"));
  const providerResult = successFlag(params.get("is_success")) ?? successFlag(params.get("success"));
  const codeResult = params.has("code") ? (params.get("code") === "000" ? "success" : "failed") : null;
  return {
    isReturn,
    result: explicitResult ?? providerResult ?? codeResult,
    paymentId: params.get("payment_id") || params.get("order_id"),
  };
}

export function paymentReturnSearch(search: string): string {
  const params = new URLSearchParams(search);
  if (![...RETURN_KEYS].some((key) => params.has(key))) return search;
  const retained = new URLSearchParams();
  params.forEach((value, key) => {
    if (BUSINESS_CONTEXT_KEYS.has(key)) retained.append(key, value);
  });
  const next = retained.toString();
  return next ? `?${next}` : "";
}
