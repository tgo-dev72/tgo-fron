/** Keep customer authentication returns within the current storefront origin. */
export function safeAccountDestination(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || (url.pathname === "/account" || (url.pathname === "/" && url.hash.startsWith("#/account")))) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

export function accountParameters(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const hashRoute = window.location.pathname === "/" && window.location.hash.startsWith("#/account");
  const params = new URLSearchParams(hashRoute ? window.location.hash.split("?", 2)[1] ?? "" : window.location.search);
  const raw = params.get("reset") ?? (!hashRoute ? new URLSearchParams(window.location.hash.slice(1)).get("reset") : null);
  if (raw) {
    const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    window.history.replaceState(
      { ...currentState, accountResetToken: raw },
      "",
      hashRoute ? `${window.location.pathname}${window.location.search}#/account` : `${window.location.pathname}${params.size > 1 ? `?${new URLSearchParams([...params].filter(([key]) => key !== "reset"))}` : ""}`,
    );
  }
  const saved = window.history.state?.accountResetToken;
  if (saved && !params.has("reset")) params.set("reset", saved);
  return params;
}

export function customerAccountHref(mode: "signin" | "register" = "signin"): string {
  if (typeof window === "undefined") return `/account?mode=${mode}`;
  const params = new URLSearchParams({ mode });
  const fromAccount = accountParameters().get("next");
  const current = (window.location.pathname === "/account" || (window.location.pathname === "/" && window.location.hash.startsWith("#/account")))
    ? fromAccount : `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const destination = safeAccountDestination(current);
  const homeEntry = window.location.pathname === "/" && !window.location.search && (!window.location.hash || window.location.hash === "#/");
  if (destination && !homeEntry) params.set("next", destination);
  return `/account?${params}`;
}

export function returnAfterAuthentication(): void {
  const destination = safeAccountDestination(accountParameters().get("next"));
  if (destination) window.location.assign(destination);
  else window.location.assign("/account");
}
