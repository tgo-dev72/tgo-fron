import { ApiError } from "../api/client";
import { t, type Locale } from "../i18n";

export function checkoutFailureMessage(error: unknown, locale: Locale): string {
  if (error instanceof ApiError) {
    if (error.code === "checkout_changed") return t(locale, "checkout.reviewChanged");
    if (error.status === 400 || error.status === 409) {
      const fieldMessage = Object.values(error.fields).flat().find(Boolean);
      if (fieldMessage) return fieldMessage;
      if (error.message && !error.message.startsWith("API ")) return error.message;
      return t(locale, "checkout.availabilityChanged");
    }
    if (error.status === 403) return t(locale, "checkout.temporarilyUnavailable");
  }
  return t(locale, "checkout.genericError");
}
