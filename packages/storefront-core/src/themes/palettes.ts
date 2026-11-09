export interface StorefrontThemePalette {
  brand: string;
  canvas: string;
  surface: string;
  surface2: string;
  surface3: string;
  ink: string;
  ink2: string;
  ink3: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
  accentInk: string;
  accentSoft: string;
  band: string;
  bandInk: string;
  bandInk2: string;
  header: string;
  headerInk: string;
  navigation: string;
  navigationInk: string;
  card: string;
  badge: string;
  badgeInk: string;
  newsletter: string;
  newsletterInk: string;
  footer: string;
  footerInk: string;
}

/** Single source of truth for untouched theme colors. Merchant appearance
 * values remain explicit overrides, but an empty setting is always resolved
 * from this coherent semantic palette. */
export const STOREFRONT_THEME_PALETTES: Record<string, StorefrontThemePalette> = {
  basic: {
    brand: "#287A52", canvas: "#FCFDFC", surface: "#F5F8F6", surface2: "#EDF3EF", surface3: "#E3EBE6",
    ink: "#17211B", ink2: "#526159", ink3: "#748079", border: "#D8E2DC", borderStrong: "#A6B7AD",
    accent: "#287A52", accentHover: "#1F6844", accentInk: "#FFFFFF", accentSoft: "#DDEDE5",
    band: "#17211B", bandInk: "#FFFFFF", bandInk2: "#CAD5CE",
    header: "#FFFFFF", headerInk: "#17211B", navigation: "#FFFFFF", navigationInk: "#17211B",
    card: "#FFFFFF", badge: "#0F766E", badgeInk: "#FFFFFF", newsletter: "#E8F3EE", newsletterInk: "#17211B", footer: "#111A15", footerInk: "#FFFFFF",
  },
  beauty: {
    brand: "#8B5C55", canvas: "#FFFDF9", surface: "#F7F1EB", surface2: "#EFE5DB", surface3: "#E6D8CD",
    ink: "#312B28", ink2: "#71655E", ink3: "#91837B", border: "#E2D5CB", borderStrong: "#B8A59B",
    accent: "#8B5C55", accentHover: "#70433D", accentInk: "#FFFFFF", accentSoft: "#F5E9E5",
    band: "#403530", bandInk: "#FFFFFF", bandInk2: "#E3D7D1",
    header: "#FFF9F6", headerInk: "#493B36", navigation: "#F7EEE8", navigationInk: "#493B36",
    card: "#FFFDF9", badge: "#8B3A55", badgeInk: "#FFFFFF", newsletter: "#ECE1D7", newsletterInk: "#312B28", footer: "#403530", footerInk: "#FFFFFF",
  },
  fashion: {
    brand: "#A67C2E", canvas: "#FFFDF8", surface: "#F7EFD9", surface2: "#EAD8AD", surface3: "#DDC58E",
    ink: "#11100D", ink2: "#625947", ink3: "#81745B", border: "#E0D1AC", borderStrong: "#9B875C",
    accent: "#A67C2E", accentHover: "#805D1F", accentInk: "#FFFFFF", accentSoft: "#F3E7C9",
    band: "#0D0D0C", bandInk: "#FFFAF0", bandInk2: "#D8D0C0",
    header: "#FBF5E8", headerInk: "#11100D", navigation: "#24221F", navigationInk: "#FAF8F4",
    card: "#FAF8F4", badge: "#C6A15B", badgeInk: "#17130B", newsletter: "#24221F", newsletterInk: "#FFFAF0", footer: "#0D0D0C", footerInk: "#FFFAF0",
  },
  electronics: {
    brand: "#1957D2", canvas: "#F5F7FA", surface: "#FFFFFF", surface2: "#E9EEF5", surface3: "#DDE5F0",
    ink: "#111C2D", ink2: "#536174", ink3: "#728096", border: "#D8E0EB", borderStrong: "#96A6BA",
    accent: "#1957D2", accentHover: "#123FA2", accentInk: "#FFFFFF", accentSoft: "#DCE7FF",
    band: "#0B1730", bandInk: "#FFFFFF", bandInk2: "#C5D2E7",
    header: "#FFFFFF", headerInk: "#0B1730", navigation: "#0B1730", navigationInk: "#FFFFFF",
    card: "#FFFFFF", badge: "#1D4ED8", badgeInk: "#FFFFFF", newsletter: "#E9EEF5", newsletterInk: "#111C2D", footer: "#0B1730", footerInk: "#FFFFFF",
  },
  nexa: {
    brand: "#1264D8", canvas: "#FFFFFF", surface: "#F6F9FD", surface2: "#EAF1FB", surface3: "#D9E6F7",
    ink: "#070B14", ink2: "#43516A", ink3: "#66758E", border: "#D5DFED", borderStrong: "#8DA2BF",
    accent: "#1264D8", accentHover: "#0B4FAC", accentInk: "#FFFFFF", accentSoft: "#E7F0FF",
    band: "#070B14", bandInk: "#FFFFFF", bandInk2: "#B8C7DC",
    header: "#FFFFFF", headerInk: "#070B14", navigation: "#070B14", navigationInk: "#FFFFFF",
    card: "#FFFFFF", badge: "#1264D8", badgeInk: "#FFFFFF", newsletter: "#EAF1FB", newsletterInk: "#070B14", footer: "#070B14", footerInk: "#FFFFFF",
  },
  atelier: {
    brand: "#A88765", canvas: "#FAF9F6", surface: "#FFFFFF", surface2: "#F1EFEA", surface3: "#E5E2DC",
    ink: "#191919", ink2: "#74716D", ink3: "#96918B", border: "#E2DED7", borderStrong: "#AAA39A",
    accent: "#A88765", accentHover: "#816449", accentInk: "#FFFFFF", accentSoft: "#F1EFEA",
    band: "#22231F", bandInk: "#FFFFFF", bandInk2: "#C9C9C3",
    header: "#FBF8F2", headerInk: "#1F1C18", navigation: "#F3EEE5", navigationInk: "#1F1C18",
    card: "#FBF8F2", badge: "#6B4F35", badgeInk: "#FFFFFF", newsletter: "#F1EFEA", newsletterInk: "#191919", footer: "#090A0C", footerInk: "#FFFFFF",
  },
};

export function storefrontThemePalette(design: string | undefined): StorefrontThemePalette {
  return STOREFRONT_THEME_PALETTES[design ?? "basic"] ?? STOREFRONT_THEME_PALETTES.basic;
}
