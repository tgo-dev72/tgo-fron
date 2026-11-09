import assert from "node:assert/strict";
import test from "node:test";
import type { Order } from "../api/client";
import { ANALYTICS_RANGES, isRevenueOrder, ordersSince, percentChange } from "./analytics";

function order(overrides: Partial<Order>): Order {
  return {
    created_at: "2026-09-07T12:00:00Z",
    status: "confirmed",
    payment_mode: "online",
    is_paid: "confirmed",
    ...overrides,
  } as Order;
}

test("analytics history grows with the governed level", () => {
  assert.deepEqual(ANALYTICS_RANGES.essential, [7, 30]);
  assert.deepEqual(ANALYTICS_RANGES.standard, [7, 30, 90]);
  assert.deepEqual(ANALYTICS_RANGES.advanced, [7, 30, 90, 365]);
});

test("revenue excludes unpaid and cancelled orders", () => {
  assert.equal(isRevenueOrder(order({})), true);
  assert.equal(isRevenueOrder(order({ is_paid: "pending" })), false);
  assert.equal(isRevenueOrder(order({ status: "cancelled" })), false);
  assert.equal(isRevenueOrder(order({ payment_mode: "cod", is_paid: "cod", status: "confirmed" })), false);
  assert.equal(isRevenueOrder(order({ payment_mode: "cod", is_paid: "cod", status: "delivered" })), true);
});

test("current and previous periods do not overlap", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  const orders = [
    order({ id: 1, created_at: "2026-09-07T12:00:00Z" }),
    order({ id: 2, created_at: "2026-08-20T12:00:00Z" }),
    order({ id: 3, created_at: "2026-07-20T12:00:00Z" }),
  ];
  assert.deepEqual(ordersSince(orders, 30, 0, now).map((item) => item.id), [1, 2]);
  assert.deepEqual(ordersSince(orders, 30, 30, now).map((item) => item.id), [3]);
});

test("period comparison avoids inventing growth without a baseline", () => {
  assert.equal(percentChange(200, 100), 100);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(100, 0), null);
});
