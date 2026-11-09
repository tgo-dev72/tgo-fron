import assert from "node:assert/strict";
import { parseRequestedStoreId } from "./storeSelection";

assert.equal(parseRequestedStoreId("?store=42"), 42);
assert.equal(parseRequestedStoreId("?tab=products&store=7"), 7);
assert.equal(parseRequestedStoreId(""), null);
assert.equal(parseRequestedStoreId("?store="), null);
assert.equal(parseRequestedStoreId("?store=0"), null);
assert.equal(parseRequestedStoreId("?store=-1"), null);
assert.equal(parseRequestedStoreId("?store=2.5"), null);
assert.equal(parseRequestedStoreId("?store=not-a-store"), null);

console.log("dashboard store selection tests passed");
