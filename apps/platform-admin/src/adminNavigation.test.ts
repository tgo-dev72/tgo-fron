/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { safeAdminReturnPath } from "./adminNavigation";

test("staff returns to the exact protected view after authentication", () => {
  assert.equal(safeAdminReturnPath("/deployments?status=failed&page=2"), "/deployments?status=failed&page=2");
});

test("staff return navigation rejects login loops and external destinations", () => {
  assert.equal(safeAdminReturnPath("//example.com"), "/");
  assert.equal(safeAdminReturnPath("/login"), "/");
  assert.equal(safeAdminReturnPath(undefined), "/");
});
