import assert from "node:assert/strict";
import test from "node:test";
import type { StockVariant } from "../api/client";
import { isDefaultInventoryVariant, merchantVariants, productPublicationReady } from "./catalog";

const defaultInventory: StockVariant = {
  id: 1,
  attributes: {},
  price: null,
  quantity: 0,
  reserved: 0,
  available_quantity: 0,
  extra: {},
};

const configuredInventory: StockVariant = {
  ...defaultInventory,
  id: 2,
  attributes: { color: "navy", size: "M" },
  quantity: 4,
  available_quantity: 4,
};

test("the system inventory row is hidden from merchant variant counts", () => {
  assert.equal(isDefaultInventoryVariant(defaultInventory), true);
  assert.deepEqual(merchantVariants([defaultInventory]), []);
  assert.deepEqual(merchantVariants([configuredInventory]), [configuredInventory]);
  assert.equal(isDefaultInventoryVariant({ ...defaultInventory, quantity: 12, available_quantity: 12 }), true);
});

test("configurable products remain drafts until real inventory exists", () => {
  assert.equal(productPublicationReady(true, true, [defaultInventory]), false);
  assert.equal(productPublicationReady(true, true, [configuredInventory]), true);
  assert.equal(productPublicationReady(false, true, [defaultInventory]), true);
  assert.equal(productPublicationReady(true, true, [defaultInventory], false), true);
});
