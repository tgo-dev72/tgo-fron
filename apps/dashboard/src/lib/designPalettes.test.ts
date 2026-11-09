import assert from "node:assert/strict";
import test from "node:test";
import { designPalette } from "./designPalettes";

test("each premium design starts with its own coherent identity palette", () => {
  assert.deepEqual(designPalette("beauty"), { brand: "#8B5C55", primary: "#403530", secondary: "#8B5C55", muted: "#F5E9E5" });
  assert.deepEqual(designPalette("fashion"), { brand: "#A67C2E", primary: "#0D0D0C", secondary: "#A67C2E", muted: "#F3E7C9" });
  assert.deepEqual(designPalette("electronics"), { brand: "#1957D2", primary: "#0B1730", secondary: "#1957D2", muted: "#DCE7FF" });
  assert.deepEqual(designPalette("nexa"), { brand: "#1264D8", primary: "#070B14", secondary: "#1264D8", muted: "#E7F0FF" });
});

test("unknown or retired designs fall back to the neutral essential palette", () => {
  assert.deepEqual(designPalette("retired"), designPalette("basic"));
});
