import type { EntitlementDefinition, EntitlementValue, PlanInput } from "./api";

export type PlanOfferIssue =
  | "price"
  | "currency"
  | "duration"
  | "slug"
  | `${"en" | "fr" | "ar"}.${"name" | "description"}`;

export function validatePlanOffer(form: PlanInput): PlanOfferIssue[] {
  const issues: PlanOfferIssue[] = [];
  if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) issues.push("price");
  if (!/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) issues.push("currency");
  if (!Number.isInteger(Number(form.duration_days)) || Number(form.duration_days) < 1 || Number(form.duration_days) > 3650) issues.push("duration");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) issues.push("slug");
  (["en", "fr", "ar"] as const).forEach((language) => {
    if (!form.translations[language].name.trim()) issues.push(`${language}.name`);
    if (!form.translations[language].description.trim()) issues.push(`${language}.description`);
  });
  return issues;
}

/**
 * Build the entitlement payload from the current governed registry.
 *
 * Plans can outlive a capability definition. Filtering here prevents a stale
 * browser snapshot (or an archived capability) from making an unrelated plan
 * edit fail, while normalizing HTML input values to the API's strict types.
 */
export function normalizePlanEntitlements(
  values: Record<string, EntitlementValue>,
  capabilities: EntitlementDefinition[],
): Record<string, EntitlementValue> {
  return Object.fromEntries(capabilities.filter((capability) => capability.is_active).map((capability) => {
    const value = values[capability.key] ?? capability.default_value;
    if (capability.value_type === "boolean") {
      return [capability.key, value === true || value === "true"];
    }
    if (capability.value_type === "integer") {
      return [capability.key, Number(value)];
    }
    if (capability.value_type === "decimal") {
      return [capability.key, String(value).trim()];
    }
    return [capability.key, String(value).trim()];
  }));
}
