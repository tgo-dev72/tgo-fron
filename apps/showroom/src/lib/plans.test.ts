import test from "node:test";
import assert from "node:assert/strict";
import { activePlanSubscriptions, formatPlanPrice, isMembershipResolved, isPlanCurrent, localizedPlanCopy, planBenefits, recommendedPlanId } from "./plans";
import type { SubscriptionPlan, SubscriptionStatus } from "../api/platform";

const accountPlan: SubscriptionPlan = {
  id: 2, name: "Starter", slug: "starter", description: "", price: "99.00", currency: "MAD",
  translations: {
    en: { name: "Starter", description: "Start growing." },
    fr: { name: "Essentiel", description: "Commencez à grandir." },
    ar: { name: "الانطلاقة", description: "ابدأ نمو نشاطك." },
  },
  duration_days: 30, entitlement_scope: "all_owned_stores", features: ["Premium designs"],
  benefits: [{ key: "designs.premium", name: "Premium designs", description: "", value: true, unit: "", display: "Premium designs" }],
  grants_premium_designs: true, is_featured: false, is_free: false,
};

test("plan benefits are trimmed and deduplicated", () => {
  assert.deepEqual(planBenefits(accountPlan), ["Premium designs"]);
});

test("plan names and descriptions follow the selected language", () => {
  assert.deepEqual(localizedPlanCopy(accountPlan, "fr"), {
    name: "Essentiel",
    description: "Commencez à grandir.",
  });
  assert.equal(localizedPlanCopy(accountPlan, "ar").name, "الانطلاقة");
});

test("plan prices are localized without exposing raw decimal formatting", () => {
  assert.match(formatPlanPrice("99.00", "MAD", "en"), /99/);
  assert.equal(formatPlanPrice("not-a-price", "MAD", "en"), "not-a-price MAD");
});

test("only the first configured featured plan is presented as recommended", () => {
  const anotherFeatured = { ...accountPlan, id: 4, slug: "premium", is_featured: true };
  assert.equal(recommendedPlanId([{ ...accountPlan, is_featured: true }, anotherFeatured]), accountPlan.id);
  assert.equal(recommendedPlanId([{ ...accountPlan, is_featured: false }]), null);
});

test("account plans are current without selecting a store", () => {
  const status = {
    subscriptions: [{ status: "active", plan: accountPlan, selected_store: null }],
  } as SubscriptionStatus;
  assert.equal(isPlanCurrent(status, accountPlan, null), true);
});

test("active plans remain detectable when the API returns only the compatibility subscription field", () => {
  const status: SubscriptionStatus = {
    subscriptions: [],
    subscription: {
      status: "active",
      plan: accountPlan,
      entitlements: {},
      selected_store: null,
      started_at: null,
      current_period_end: null,
      cancel_at_period_end: false,
    },
      latest_payment: null,
      payment: null,
      balances: [],
  };
  assert.equal(activePlanSubscriptions(status, accountPlan).length, 1);
  assert.equal(isPlanCurrent(status, accountPlan, null), true);
});

test("store plans are current only for the selected subscribed store", () => {
  const storePlan = { ...accountPlan, id: 3, slug: "store-pack", entitlement_scope: "one_store" as const };
  const status = {
    subscriptions: [{ status: "active", plan: storePlan, selected_store: { id: 8, name: "Atlas", slug: "atlas" } }],
  } as SubscriptionStatus;
  assert.equal(isPlanCurrent(status, storePlan, 8), true);
  assert.equal(isPlanCurrent(status, storePlan, 9), false);
});

test("authenticated plan actions stay blocked until membership is resolved", () => {
  assert.equal(isMembershipResolved(true, true, false), false);
  assert.equal(isMembershipResolved(true, false, true), false);
  assert.equal(isMembershipResolved(true, false, false), true);
  assert.equal(isMembershipResolved(false, false, false), true);
});
