/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { paymentReturnSearch, readPaymentReturn } from "./paymentReturn";

test("payment return parameters are consumed without dropping business context", () => {
  assert.equal(paymentReturnSearch("?payment=failed&payment_id=abc&design=atlas&store=7"), "?design=atlas&store=7");
  assert.equal(paymentReturnSearch("?payment=success&payment_id=abc"), "");
});

test("provider-hosted return values are recognized and completely removed", () => {
  const search = "?transaction_id=23632716-c406-4a9e-bc85-21a434b2cf32&is_success=1&success=1&order_id=84b352e9-c207-4c96-bd4f-22d3bf111e49&code=000";
  assert.deepEqual(readPaymentReturn(search), {
    isReturn: true,
    result: "success",
    paymentId: "84b352e9-c207-4c96-bd4f-22d3bf111e49",
  });
  assert.equal(paymentReturnSearch(search), "");
});

test("failed provider returns retain only storefront continuation context", () => {
  const search = "?is_success=0&success=0&order_id=payment-1&code=101&store=7&design=atlas&message=declined";
  assert.equal(readPaymentReturn(search).result, "failed");
  assert.equal(paymentReturnSearch(search), "?store=7&design=atlas");
});
