import { ApiError } from "../api/platform";

type Translate = (key: string) => string;

export function friendlyApiError(error: unknown, t: Translate, fallback = "error.generic"): string {
  if (!(error instanceof ApiError)) return t(fallback);
  if (error.status === 0) return t("error.network");
  if (error.status === 401) return t("error.session");
  if (error.status === 403) return t("error.permission");
  if (error.status === 409) return t("error.conflict");
  if (error.status === 429) return t("error.rateLimit");
  if (error.status >= 500) return t("error.service");
  return t(fallback);
}
