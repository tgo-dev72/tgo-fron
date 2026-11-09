import type { StoreConfig } from "@storefront/core";

/** A presentation default, not a persisted configuration or entitlement override.
 * Explicit merchant settings and the backend-selected design remain untouched.
 * Published sections are dispatched by Storefront; no fixture or second renderer.
 */
export function nexaPresentationConfig(config: StoreConfig): StoreConfig {
  return {
    ...config,
    navigation: {
      ...config.navigation,
      headerPreset: config.navigation?.headerPreset ?? "editorial",
    },
  };
}
