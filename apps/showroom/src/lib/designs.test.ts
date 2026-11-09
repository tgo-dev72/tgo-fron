import assert from "node:assert/strict";
import test from "node:test";
import { currentDesigns, getAccent } from "./designs";

test("old API manifests cannot restore retired templates in store creation", () => {
  const designs = ["basic", "variants", "discovery", "story", "conversion", "trade", "beauty", "fashion", "electronics", "atelier", "nexa"]
    .map((key) => ({ key }));
  assert.deepEqual(currentDesigns(designs).map((design) => design.key),
    ["basic", "beauty", "fashion", "electronics", "nexa"]);
});

test("store creation uses the selected design's identity color", () => {
  assert.equal(getAccent("beauty"), "#8b5c55");
  assert.equal(getAccent("fashion"), "#a67c2e");
  assert.equal(getAccent("electronics"), "#1957d2");
  assert.equal(getAccent("nexa"), "#a67c2e");
});
