/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { shouldExpireMerchantSession } from "../api/platform";

test("showroom protected request 401 expires the merchant session", () => {
  assert.equal(shouldExpireMerchantSession("/api/subscriptions/status", 401), true);
  assert.equal(shouldExpireMerchantSession("/api/subscriptions/status", 500), false);
});

test("showroom authentication requests cannot cause a redirect loop", () => {
  assert.equal(shouldExpireMerchantSession("/accounts/token", 401), false);
  assert.equal(shouldExpireMerchantSession("/accounts/me", 401), false);
});
