import type { StoreConfig } from "@storefront/core";

/**
 * Per-store configuration — the Django storefront factory regenerates this
 * file on every scaffold; do not edit by hand.
 */
export const storeConfig: StoreConfig = {
  storeName: "Your Store (placeholder)",
  domain: "https://CHANGE-ME.example.com",
  contactEmail: "contact@example.com",
  phone: "",
  currency: "MAD",
  brandColor: "#0e92e4",
  freeShippingThreshold: 0,
  shippingFee: 0,
  serviceableCities: [],
  defaultLocale: "en",
  payment: {
    online: true,
    acceptedCards: ["VISA", "Mastercard", "AMEX"],
  },
};
