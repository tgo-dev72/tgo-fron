import assert from "node:assert/strict";
import test from "node:test";
import { api } from "./client";

test("product list requests bypass stale browser caches", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    assert.deepEqual(await api.listProducts(17), []);
    assert.equal(requestInit?.cache, "no-store");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
