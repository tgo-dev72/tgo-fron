import type { SubscriptionPlan, SubscriptionStatus } from "../api/client";

export type ActiveSubscription = NonNullable<SubscriptionStatus["subscription"]>;

export function localizedPlanCopy(plan: SubscriptionPlan, locale: string) {
  return plan.translations?.[locale as "en" | "fr" | "ar"]
    ?? plan.translations?.en
    ?? { name: plan.name, description: plan.description };
}

/** Match the same plan and entitlement scope that checkout protects server-side. */
export function isPlanActiveForSelection(
  plan: SubscriptionPlan,
  activeSubscriptions: ActiveSubscription[],
  selectedStoreId: number | null,
) {
  return activeSubscriptions.some((active) => {
    if (active.plan?.id !== plan.id) return false;
    if (plan.entitlement_scope === "all_owned_stores") return active.selected_store === null;
    return selectedStoreId !== null && active.selected_store?.id === selectedStoreId;
  });
}
