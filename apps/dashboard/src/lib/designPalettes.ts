import { STOREFRONT_THEME_PALETTES } from "@storefront/core";

export interface DesignPalette {
  brand: string;
  primary: string;
  secondary: string;
  muted: string;
}

const DESIGN_PALETTES: Record<string, DesignPalette> = Object.fromEntries(
  Object.entries(STOREFRONT_THEME_PALETTES).map(([key, palette]) => [key, {
    brand: palette.brand,
    primary: palette.band,
    secondary: palette.accent,
    muted: palette.accentSoft,
  }]),
);

export function designPalette(design: string): DesignPalette {
  return DESIGN_PALETTES[design] ?? DESIGN_PALETTES.basic;
}
