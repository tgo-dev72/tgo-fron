import type { StockVariant } from "../api/client";

export function isDefaultInventoryVariant(variant: StockVariant): boolean {
  return Object.keys(variant.attributes ?? {}).length === 0;
}

export function merchantVariants(variants: StockVariant[]): StockVariant[] {
  return variants.filter((variant) => !isDefaultInventoryVariant(variant));
}

export function productPublicationReady(
  requiresMerchantVariant: boolean,
  inventoryReady: boolean,
  variants: StockVariant[],
  usesVariants = requiresMerchantVariant,
): boolean {
  return !usesVariants || (inventoryReady && merchantVariants(variants).length > 0);
}
