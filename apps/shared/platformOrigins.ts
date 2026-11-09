export type PlatformApp = "showroom" | "dashboard" | "platform-admin";

const DEVELOPMENT_PORTS: Record<PlatformApp, string> = {
  showroom: "5178",
  dashboard: "5179",
  "platform-admin": "5180",
};

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function siblingOrigin(currentOrigin: string, app: PlatformApp): string {
  const url = new URL(currentOrigin);
  if (import.meta.env?.DEV || isLocalHostname(url.hostname)) {
    url.port = DEVELOPMENT_PORTS[app];
    return url.origin;
  }

  const labels = url.hostname.split(".");
  const subdomain = { showroom: "www", dashboard: "dash", "platform-admin": "admin" }[app];
  if (["www", "dash", "dashboard", "showroom", "admin"].includes(labels[0])) {
    labels[0] = subdomain;
  } else {
    labels.unshift(subdomain);
  }
  url.hostname = labels.join(".");
  return url.origin;
}

/**
 * Local links always preserve the browser's current hostname. A configured
 * URL is used only for a non-local production host, so stale LAN addresses
 * can never leak into redirects.
 */
export function resolvePlatformAppOrigin(
  currentOrigin: string,
  app: PlatformApp,
  configured?: string,
  development = false,
): string {
  const current = new URL(currentOrigin);
  if (development || isLocalHostname(current.hostname)) {
    return siblingOrigin(current.origin, app);
  }
  const explicit = configured?.trim();
  return explicit ? new URL(explicit).origin : siblingOrigin(current.origin, app);
}

export function platformAppOrigin(app: PlatformApp, configured?: string): string {
  return resolvePlatformAppOrigin(
    window.location.origin,
    app,
    configured,
    Boolean(import.meta.env?.DEV),
  );
}
