export interface BrandAsset {
  key: string;
  label: string;
  labelAr: string;
  labelFr: string;
  svgUrl: string;
  png4xUrl: string;
  primaryHex: string;
  accentHex: string;
}

export const BRAND_ASSETS: BrandAsset[] = [
  { key: "black",        label: "Black",        labelFr: "Noir",        labelAr: "أسود",         svgUrl: "/brand/logos/tyjara-go-black.svg",        png4xUrl: "/brand/logos-4x/tyjara-go-black-4x.png",        primaryHex: "#000000", accentHex: "#333333" },
  { key: "blue-cyan",    label: "Blue Cyan",    labelFr: "Bleu Cyan",   labelAr: "أزرق سماوي",   svgUrl: "/brand/logos/tyjara-go-blue-cyan.svg",    png4xUrl: "/brand/logos-4x/tyjara-go-blue-cyan-4x.png",    primaryHex: "#0077B6", accentHex: "#00B4D8" },
  { key: "blue-green",   label: "Blue Green",   labelFr: "Bleu Vert",   labelAr: "أزرق أخضر",    svgUrl: "/brand/logos/tyjara-go-blue-green.svg",   png4xUrl: "/brand/logos-4x/tyjara-go-blue-green-4x.png",   primaryHex: "#1B4332", accentHex: "#2D6A4F" },
  { key: "gold",         label: "Gold",         labelFr: "Or",          labelAr: "ذهبي",         svgUrl: "/brand/logos/tyjara-go-gold.svg",         png4xUrl: "/brand/logos-4x/tyjara-go-gold-4x.png",         primaryHex: "#B8860B", accentHex: "#DAA520" },
  { key: "green-lime",   label: "Green Lime",   labelFr: "Vert Lime",   labelAr: "أخضر ليموني",  svgUrl: "/brand/logos/tyjara-go-green-lime.svg",   png4xUrl: "/brand/logos-4x/tyjara-go-green-lime-4x.png",   primaryHex: "#2D6A4F", accentHex: "#52B788" },
  { key: "orange-yellow", label: "Orange Yellow", labelFr: "Orange Jaune", labelAr: "برتقالي أصفر", svgUrl: "/brand/logos/tyjara-go-orange-yellow.svg", png4xUrl: "/brand/logos-4x/tyjara-go-orange-yellow-4x.png", primaryHex: "#E85D04", accentHex: "#F48C06" },
  { key: "pink-red",     label: "Pink Red",     labelFr: "Rose Rouge",  labelAr: "وردي أحمر",    svgUrl: "/brand/logos/tyjara-go-pink-red.svg",     png4xUrl: "/brand/logos-4x/tyjara-go-pink-red-4x.png",     primaryHex: "#D00000", accentHex: "#E85D04" },
  { key: "purple-magenta", label: "Purple Magenta", labelFr: "Violet Magenta", labelAr: "بنفسجي أحمر قاني", svgUrl: "/brand/logos/tyjara-go-purple-magenta.svg", png4xUrl: "/brand/logos-4x/tyjara-go-purple-magenta-4x.png", primaryHex: "#7B2CBF", accentHex: "#C77DFF" },
  { key: "red",          label: "Red",          labelFr: "Rouge",       labelAr: "أحمر",         svgUrl: "/brand/logos/tyjara-go-red.svg",          png4xUrl: "/brand/logos-4x/tyjara-go-red-4x.png",          primaryHex: "#D00000", accentHex: "#FFBA08" },
  { key: "silver",       label: "Silver",       labelFr: "Argent",      labelAr: "فضي",          svgUrl: "/brand/logos/tyjara-go-silver.svg",       png4xUrl: "/brand/logos-4x/tyjara-go-silver-4x.png",       primaryHex: "#8D99AE", accentHex: "#ADB5BD" },
  { key: "teal-cyan",    label: "Teal Cyan",    labelFr: "Sarcelle Cyan", labelAr: "أزرق مخضر سماوي", svgUrl: "/brand/logos/tyjara-go-teal-cyan.svg",  png4xUrl: "/brand/logos-4x/tyjara-go-teal-cyan-4x.png",   primaryHex: "#1F8A8C", accentHex: "#2BA4A6" },
  { key: "violet-blue",  label: "Violet Blue",  labelFr: "Violet Bleu", labelAr: "بنفسجي أزرق",  svgUrl: "/brand/logos/tyjara-go-violet-blue.svg",  png4xUrl: "/brand/logos-4x/tyjara-go-violet-blue-4x.png",  primaryHex: "#3A0CA3", accentHex: "#4361EE" },
];

/** The primary brand variant used across the platform (matches --brand: #1f8a8c). */
export const PRIMARY_BRAND = BRAND_ASSETS.find((a) => a.key === "teal-cyan")!;

/** Get a brand asset by key. Falls back to the primary brand. */
export function getBrandAsset(key: string): BrandAsset {
  return BRAND_ASSETS.find((a) => a.key === key) ?? PRIMARY_BRAND;
}
