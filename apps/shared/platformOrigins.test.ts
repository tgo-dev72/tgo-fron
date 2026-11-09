import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlatformAppOrigin } from "./platformOrigins";

test("local app links preserve the current LAN hostname and change only the port", () => {
  assert.equal(
    resolvePlatformAppOrigin(
      "https://10.189.110.138:5178",
      "dashboard",
      "https://stale-address.example:5179",
    ),
    "https://10.189.110.138:5179",
  );
  assert.equal(
    resolvePlatformAppOrigin("https://192.168.50.9:5179", "showroom"),
    "https://192.168.50.9:5178",
  );
});

test("production app links use explicit public origins", () => {
  assert.equal(
    resolvePlatformAppOrigin(
      "https://www.tijarago.com",
      "dashboard",
      "https://dash.tijarago.com/path-that-is-not-an-origin",
    ),
    "https://dash.tijarago.com",
  );
});

test("production fallbacks use the www, dash and admin siblings", () => {
  assert.equal(resolvePlatformAppOrigin("https://dash.tijarago.com", "showroom"), "https://www.tijarago.com");
  assert.equal(resolvePlatformAppOrigin("https://www.tijarago.com", "dashboard"), "https://dash.tijarago.com");
  assert.equal(resolvePlatformAppOrigin("https://www.tijarago.com", "platform-admin"), "https://admin.tijarago.com");
  assert.equal(resolvePlatformAppOrigin("https://admin.tijarago.com", "showroom"), "https://www.tijarago.com");
  assert.equal(resolvePlatformAppOrigin("https://tijarago.com", "dashboard"), "https://dash.tijarago.com");
});
