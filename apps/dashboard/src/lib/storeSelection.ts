export function parseRequestedStoreId(search: string): number | null {
  const value = new URLSearchParams(search).get("store");
  if (value === null || !/^\d+$/.test(value)) return null;

  const storeId = Number(value);
  return Number.isSafeInteger(storeId) && storeId > 0 ? storeId : null;
}
