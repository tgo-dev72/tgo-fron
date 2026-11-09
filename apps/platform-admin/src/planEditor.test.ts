/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import type { EntitlementDefinition, PlanInput } from "./api";
import { normalizePlanEntitlements, validatePlanOffer } from "./planEditor";

const validPlan: PlanInput = {
  name: "Starter", slug: "starter", description: "Start growing", price: "99.00", currency: "MAD",
  duration_days: 30, entitlement_scope: "all_owned_stores", features: [], entitlements: { "designs.premium": true },
  translations: {
    en: { name: "Starter", description: "Start growing" },
    fr: { name: "Essentiel", description: "Commencez" },
    ar: { name: "الانطلاقة", description: "ابدأ" },
  },
  is_active: false, is_featured: false, sort_order: 10,
};

test("a complete multilingual pack can reach review", () => {
  assert.deepEqual(validatePlanOffer(validPlan), []);
});

test("hidden earlier-step fields are validated before save", () => {
  const invalid = {
    ...validPlan,
    currency: "MA",
    translations: { ...validPlan.translations, fr: { name: "", description: "" } },
  };
  assert.deepEqual(validatePlanOffer(invalid), ["currency", "fr.name", "fr.description"]);
});

test("plan capability payload contains only active definitions with API-safe values", () => {
  const capability = (overrides: Partial<EntitlementDefinition>): EntitlementDefinition => ({
    id: 1,
    key: "designs.premium",
    name: "Premium designs",
    description: "Premium designs",
    translations: validPlan.translations,
    value_type: "boolean",
    scope: "account",
    unit: "",
    allowed_values: [],
    default_value: false,
    is_active: true,
    sort_order: 1,
    used_by_plans: 1,
    created_at: "",
    updated_at: "",
    business_rule: null,
    ...overrides,
  });
  const definitions = [
    capability({}),
    capability({ id: 2, key: "stores.max_count", value_type: "integer", default_value: 1 }),
    capability({ id: 3, key: "support.level", value_type: "choice", allowed_values: ["standard", "priority"], default_value: "standard" }),
    capability({ id: 4, key: "legacy.hidden", is_active: false }),
  ];

  assert.deepEqual(normalizePlanEntitlements({
    "designs.premium": "true",
    "stores.max_count": "12",
    "support.level": " priority ",
    "legacy.hidden": true,
    "unknown.stale": true,
  }, definitions), {
    "designs.premium": true,
    "stores.max_count": 12,
    "support.level": "priority",
  });
});
