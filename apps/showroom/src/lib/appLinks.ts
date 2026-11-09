import { platformAppOrigin } from "../../../shared/platformOrigins";

export function merchantDashboardUrl(storeId: number) {
  const configured = (import.meta.env.VITE_DASHBOARD_URL as string | undefined)?.trim();
  const url = new URL(platformAppOrigin("dashboard", configured));
  url.searchParams.set("store", String(storeId));
  return url.toString();
}

export function merchantPasswordRecoveryUrl() {
  const configured = (import.meta.env.VITE_DASHBOARD_URL as string | undefined)?.trim();
  return new URL("/forgot-password", platformAppOrigin("dashboard", configured)).toString();
}
