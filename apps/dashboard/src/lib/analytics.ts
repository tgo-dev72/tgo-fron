import type { Order } from "../api/client";

export type AnalyticsLevel = "essential" | "standard" | "advanced";
export type AnalyticsRange = 7 | 30 | 90 | 365;

export const ANALYTICS_LEVEL_RANK: Record<AnalyticsLevel, number> = {
  essential: 0,
  standard: 1,
  advanced: 2,
};

export const ANALYTICS_RANGES: Record<AnalyticsLevel, readonly AnalyticsRange[]> = {
  essential: [7, 30],
  standard: [7, 30, 90],
  advanced: [7, 30, 90, 365],
};

export function isRevenueOrder(order: Order): boolean {
  if (order.status === "cancelled") return false;
  if (order.payment_mode === "online") return order.is_paid === "confirmed";
  return order.payment_mode === "cod" && order.status === "delivered";
}

export function ordersSince(orders: Order[], days: number, offsetDays = 0, now = new Date()): Order[] {
  const end = new Date(now);
  end.setDate(end.getDate() - offsetDays);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return orders.filter((order) => {
    const created = new Date(order.created_at);
    return created >= start && created < end;
  });
}

export function customerIdentity(order: Order): string {
  const email = String(order.customer_email ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = String(order.customer_phone ?? "").replace(/\s+/g, "");
  return phone ? `phone:${phone}` : "";
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
