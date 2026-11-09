import { platform, type SubscriptionCatalog } from "../api/platform";

const STORAGE_KEY = "sr-plan-catalog-v1";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 700;

type StoredCatalog = {
  savedAt: number;
  catalog: SubscriptionCatalog;
};

let inFlight: Promise<SubscriptionCatalog> | null = null;

function isCatalog(value: unknown): value is SubscriptionCatalog {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SubscriptionCatalog>;
  return Array.isArray(candidate.plans)
    && Boolean(candidate.billing)
    && typeof candidate.billing?.available === "boolean"
    && typeof candidate.billing?.sandbox === "boolean"
    && Array.isArray(candidate.billing?.gateways);
}

export function readPlanCatalogCache(): SubscriptionCatalog | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as StoredCatalog | null;
    if (!parsed || !isCatalog(parsed.catalog) || !Number.isFinite(parsed.savedAt)) return null;
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.catalog;
  } catch {
    return null;
  }
}

function storePlanCatalog(catalog: SubscriptionCatalog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), catalog } satisfies StoredCatalog));
  } catch {
    // Storage can be unavailable in private browsing; the live catalog remains usable.
  }
}

async function requestCatalog(): Promise<SubscriptionCatalog> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await platform.listSubscriptionPlans(controller.signal);
  } finally {
    window.clearTimeout(timeout);
  }
}

function delay(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

export function loadPlanCatalog(): Promise<SubscriptionCatalog> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const catalog = await requestCatalog();
        storePlanCatalog(catalog);
        return catalog;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await delay(RETRY_DELAY_MS);
      }
    }
    throw lastError;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function warmPlanCatalog() {
  if (readPlanCatalogCache()) return;
  void loadPlanCatalog().catch(() => undefined);
}
