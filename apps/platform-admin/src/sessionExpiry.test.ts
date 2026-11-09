/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { shouldExpireStaffSession } from "./api";
import "./planEditor.test";
import "./adminNavigation.test";
import "./resourceQuery.test";

test("platform operation 401 expires the staff session", () => {
  assert.equal(shouldExpireStaffSession("/api/platform-admin/stores?page=2", 401), true);
  assert.equal(shouldExpireStaffSession("/api/platform-admin/stores", 403), false);
});

test("staff login and initial session checks cannot cause a redirect loop", () => {
  assert.equal(shouldExpireStaffSession("/accounts/token", 401), false);
  assert.equal(shouldExpireStaffSession("/api/platform-admin/session", 401), false);
});
