import { t, type Locale } from "../i18n";

export function friendlyError(err: unknown, locale: Locale, fallbackKey: string): string {
  const message = err instanceof Error ? err.message : "";
  const code = (
    err && typeof err === "object" && "code" in err && typeof err.code === "string"
  ) ? err.code : "";

  const localizedCodes: Record<string, string> = {
    store_delete_confirmation_failed: "settings.deleteConfirmationFailed",
    store_has_active_orders: "settings.deleteActiveOrders",
    store_deployment_active: "settings.deleteDeploymentActive",
    store_cleanup_failed: "settings.deleteTemporaryFailure",
    store_delete_blocked: "settings.deleteBlocked",
    store_delete_not_allowed: "settings.deleteNotAllowed",
  };
  if (localizedCodes[code]) return t(locale, localizedCodes[code]);
  if (!message) return t(locale, fallbackKey);

  const unknownAttr = message.match(/^Unknown attribute ['"]([^'"]+)['"]/);
  if (unknownAttr) return t(locale, "errors.unknownAttribute", unknownAttr[1]);

  if (message === "This attribute is required.") return t(locale, "errors.requiredAttribute");
  if (message.startsWith("Invalid value")) return t(locale, "errors.invalidValue");
  if (message === "Must be a number.") return t(locale, "errors.mustBeNumber");
  if (message === "Section does not belong to this store.") return t(locale, "errors.sectionWrongStore");
  if (message === "Attributes must be an object.") return t(locale, "errors.attributesNotObject");

  // Do not expose provider, infrastructure, permission, or backend validation
  // details that have not been deliberately translated for the current UI.
  return t(locale, fallbackKey);
}
