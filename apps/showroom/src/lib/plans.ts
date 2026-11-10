import type { SubscriptionPlan, SubscriptionStatus } from "../api/platform";

export function localizedPlanCopy(plan: SubscriptionPlan, locale: string) {
  return plan.translations?.[locale as "en" | "fr" | "ar"]
    ?? plan.translations?.en
    ?? { name: plan.name, description: plan.description };
}

export function localizedPlanBenefit(benefit: NonNullable<SubscriptionPlan["benefits"]>[number], locale: string) {
  return benefit.translations?.[locale as "en" | "fr" | "ar"] ?? { name: benefit.name, description: benefit.description, display: benefit.display };
}

export function planBenefits(plan: SubscriptionPlan, locale = "en"): string[] {
  const generated = (plan.benefits ?? []).map((benefit) => localizedPlanBenefit(benefit, locale).display);
  const values = generated.length ? generated : plan.features;
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function formatPlanPrice(price: string, currency: string, locale: string): string {
  const value = Number(price);
  if (!Number.isFinite(value)) return `${price} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${price} ${currency}`;
  }
}

export function recommendedPlanId(plans: SubscriptionPlan[]): number | null {
  return plans.find((plan) => plan.is_featured)?.id ?? null;
}

export function activePlanSubscriptions(status: SubscriptionStatus | null, plan: SubscriptionPlan) {
  if (!status) return [];
  const subscriptions = status.subscriptions.length > 0
    ? status.subscriptions
    : status.subscription ? [status.subscription] : [];
  return subscriptions.filter((entry) => entry.status === "active" && entry.plan?.id === plan.id);
}

export function hasUsedFreePlan(status: SubscriptionStatus | null): boolean {
  if (!status) return false;
  const subscriptions = status.subscription
    ? [...status.subscriptions, status.subscription]
    : status.subscriptions;
  return subscriptions.some((entry) => Boolean(entry.plan?.is_free));
}

export function isPlanCurrent(
  status: SubscriptionStatus | null,
  plan: SubscriptionPlan,
  storeId: number | null,
): boolean {
  return activePlanSubscriptions(status, plan).some((entry) => {
    if (plan.entitlement_scope === "all_owned_stores") {
      return entry.plan?.entitlement_scope === "all_owned_stores";
    }
    return storeId !== null && entry.selected_store?.id === storeId;
  });
}

export function isMembershipResolved(authenticated: boolean, loading: boolean, failed: boolean): boolean {
  return !authenticated || (!loading && !failed);
}
