/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { buildResourceQuery } from "./resourceQuery";

test("operational filters remain addressable and survive navigation", () => {
  assert.equal(buildResourceQuery({ resource: "deployments", search: "", filter: "failed", page: 1, paymentSource: "store" }).toString(), "status=failed");
  assert.equal(buildResourceQuery({ resource: "users", search: "merchant@example.com", filter: "merchant", page: 2, paymentSource: "store" }).toString(), "search=merchant%40example.com&role=merchant&page=2");
});

test("membership and storefront payment ledgers have distinct URLs", () => {
  assert.equal(buildResourceQuery({ resource: "payments", search: "", filter: "failed", page: 1, paymentSource: "membership" }).toString(), "status=failed&ledger=membership");
});
