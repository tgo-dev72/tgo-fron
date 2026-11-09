import { premiumThemeSystem, type DesignSystem } from "@storefront/core";

const sharedPalette = premiumThemeSystem("nexa").vars;

/** Package-local metadata only. Registration and premium availability are release-gated. */
export const nexaSystem: DesignSystem = {
  id: "nexa", name: "NEXA", product: "TijaraGO", role: "Electronics commerce",
  summary: "Technology, beautifully presented.", inspiredBy: [], tier: "premium",
  features: ["facetedSearch", "quickView"],
  vars: {
    ...sharedPalette,
    "--ds-font-display": "'Nexa Space Grotesk', Arial, sans-serif",
    "--ds-font-body": "'Nexa Inter', Arial, sans-serif",
    "--ds-font-mono": "ui-monospace, monospace",
    "--ds-r-sm": "8px", "--ds-r-md": "12px", "--ds-r-lg": "18px", "--ds-r-xl": "24px", "--ds-r-pill": "9999px",
    "--ds-section": "88px", "--ds-shadow-1": "0 4px 16px rgb(17 19 24 / 5%)",
    "--ds-shadow-2": "0 16px 40px rgb(17 19 24 / 12%)",
  },
};
