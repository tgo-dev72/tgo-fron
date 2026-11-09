/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { shouldExpireMerchantSession, type SubscriptionPlan } from "../api/client";
import { isPlanActiveForSelection, localizedPlanCopy, type ActiveSubscription } from "./subscription";

function plan(id: number, scope: SubscriptionPlan["entitlement_scope"]): SubscriptionPlan {
  return {
    id, name: `Plan ${id}`, slug: `plan-${id}`, description: "", price: "99.00", currency: "MAD",
    duration_days: 30, entitlement_scope: scope, features: [], grants_premium_designs: false,
    is_featured: false, is_free: false,
  };
}

function active(activePlan: SubscriptionPlan, storeId: number | null): ActiveSubscription {
  return {
    status: "active",
    plan: activePlan,
    selected_store: storeId === null ? null : { id: storeId, name: `Store ${storeId}`, slug: `store-${storeId}` },
    started_at: null,
    current_period_end: "2099-01-01T00:00:00Z",
    cancel_at_period_end: false,
  };
}

test("account-wide active plan is marked current", () => {
  const starter = plan(2, "all_owned_stores");
  assert.equal(isPlanActiveForSelection(starter, [active(starter, null)], 10), true);
});

test("plan commercial copy is localized with a legacy fallback", () => {
  const starter = {
    ...plan(2, "all_owned_stores"),
    translations: {
      en: { name: "Starter", description: "Start." },
      fr: { name: "Essentiel", description: "Commencez." },
      ar: { name: "الانطلاقة", description: "ابدأ." },
    },
  };
  assert.equal(localizedPlanCopy(starter, "fr").name, "Essentiel");
  assert.equal(localizedPlanCopy(plan(3, "all_owned_stores"), "fr").name, "Plan 3");
});

test("another account-wide plan remains available", () => {
  const starter = plan(2, "all_owned_stores");
  const business = plan(3, "all_owned_stores");
  assert.equal(isPlanActiveForSelection(business, [active(starter, null)], 10), false);
});

test("per-store plan is current only for the selected covered store", () => {
  const storePlan = plan(4, "one_store");
  const subscriptions = [active(storePlan, 10)];
  assert.equal(isPlanActiveForSelection(storePlan, subscriptions, 10), true);
  assert.equal(isPlanActiveForSelection(storePlan, subscriptions, 11), false);
  assert.equal(isPlanActiveForSelection(storePlan, subscriptions, null), false);
});

test("protected request 401 expires the merchant session immediately", () => {
  assert.equal(shouldExpireMerchantSession("/api/store/12/pages/home/", 401), true);
  assert.equal(shouldExpireMerchantSession("/api/store/12/pages/home/", 403), false);
});

test("invalid login and initial identity checks do not create redirect loops", () => {
  assert.equal(shouldExpireMerchantSession("/accounts/token", 401), false);
  assert.equal(shouldExpireMerchantSession("/accounts/me", 401), false);
});
