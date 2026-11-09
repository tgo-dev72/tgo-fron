import type { DesignSystem } from "../system/types";
import type { ThemeId } from "./index";
import { storefrontThemePalette } from "./palettes";

/** Theme defaults; merchant appearance and brand color remain runtime overrides. */
export function premiumThemeSystem(id: Exclude<ThemeId, "basic">): DesignSystem {
  const palette = storefrontThemePalette(id);
  const typography = {
    beauty: { body: "'Trebuchet MS', Arial, sans-serif", display: "Georgia, 'Times New Roman', serif", radius: "20px" },
    fashion: { body: "Arial, Helvetica, sans-serif", display: "Georgia, 'Times New Roman', serif", radius: "2px" },
    atelier: { body: "Inter, Arial, sans-serif", display: "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif", radius: "2px" },
    electronics: { body: "Arial, Helvetica, sans-serif", display: "Arial, Helvetica, sans-serif", radius: "10px" },
    nexa: { body: "'Nexa Inter', Arial, sans-serif", display: "'Nexa Space Grotesk', Arial, sans-serif", radius: "8px" },
  }[id];
  return {
    id, name: id[0].toUpperCase() + id.slice(1), product: "TijaraGO", role: "Premium ecommerce", summary: `${id} storefront presentation`, inspiredBy: [],
    vars: {
      "--ds-font-display": typography.display, "--ds-font-body": typography.body, "--ds-font-mono": "ui-monospace, Menlo, monospace",
      "--ds-color-canvas": palette.canvas, "--ds-color-surface": palette.surface, "--ds-color-surface-2": palette.surface2, "--ds-color-surface-3": palette.surface3,
      "--ds-color-border": palette.border, "--ds-color-border-strong": palette.borderStrong,
      "--ds-color-ink": palette.ink, "--ds-color-ink-2": palette.ink2, "--ds-color-ink-3": palette.ink3,
      "--ds-color-accent": palette.accent, "--ds-color-accent-hover": palette.accentHover, "--ds-color-accent-ink": palette.accentInk, "--ds-color-accent-soft": palette.accentSoft,
      "--ds-color-band": palette.band, "--ds-color-band-ink": palette.bandInk, "--ds-color-band-ink-2": palette.bandInk2,
      "--ds-r-sm": typography.radius, "--ds-r-md": typography.radius, "--ds-r-lg": typography.radius, "--ds-r-xl": typography.radius, "--ds-r-pill": "9999px",
      "--ds-section": "96px", "--ds-shadow-1": "0 2px 14px rgba(20, 25, 34, .06)", "--ds-shadow-2": "0 24px 48px -22px rgba(20, 25, 34, .18)",
    },
  };
}
