import { platformAppOrigin } from "../../../shared/platformOrigins";

export function showroomDashboardUrl(storeId?: number) {
  const configured = (import.meta.env.VITE_SHOWROOM_URL as string | undefined)?.trim();
  const url = new URL("/dashboard", platformAppOrigin("showroom", configured));
  if (storeId) url.searchParams.set("store", String(storeId));
  return url.toString();
}

export function showroomSignupUrl(locale?: "en" | "fr" | "ar") {
  const configured = (import.meta.env.VITE_SHOWROOM_URL as string | undefined)?.trim();
  const url = new URL("/signup", platformAppOrigin("showroom", configured));
  if (locale) url.searchParams.set("lang", locale);
  return url.toString();
}
