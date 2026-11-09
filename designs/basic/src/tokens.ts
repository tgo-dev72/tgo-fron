import type { DesignSystem } from "@storefront/core";

/** A calm baseline for first-time merchants: readable, neutral and brandable. */
export const basic: DesignSystem = {
  id: "basic",
  name: "Basic",
  product: "Launch",
  role: "Essential commerce",
  summary:
    "A lightweight storefront that keeps products, options and ordering clear.",
  inspiredBy: [],
  vars: {
    "--ds-font-display":
      "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    "--ds-font-body":
      "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    "--ds-font-mono":
      "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",

    "--ds-color-canvas": "#fcfdfc",
    "--ds-color-surface": "#f5f8f6",
    "--ds-color-surface-2": "#edf3ef",
    "--ds-color-surface-3": "#e3ebe6",
    "--ds-color-border": "#dfe8e2",
    "--ds-color-border-strong": "#c9d8cf",
    "--ds-color-ink": "#142019",
    "--ds-color-ink-2": "#526058",
    "--ds-color-ink-3": "#819087",
    "--ds-color-accent": "#287a52",
    "--ds-color-accent-hover": "#1f6844",
    "--ds-color-accent-ink": "#ffffff",
    "--ds-color-accent-soft": "rgba(40, 122, 82, 0.10)",
    "--ds-color-band": "#142019",
    "--ds-color-band-ink": "#f7fbf8",
    "--ds-color-band-ink-2": "#afbeb4",

    "--ds-r-sm": "6px",
    "--ds-r-md": "8px",
    "--ds-r-lg": "12px",
    "--ds-r-xl": "16px",
    "--ds-r-pill": "9999px",

    "--ds-section": "88px",

    "--ds-shadow-1": "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(15,23,42,0.05)",
    "--ds-shadow-2": "0 24px 48px -20px rgba(15,23,42,0.18)",
    "--basic-hero-grid": "rgba(40, 122, 82, 0.045)",
  },
  varsDark: {
    "--ds-color-canvas": "#0b0c10",
    "--ds-color-surface": "#14161c",
    "--ds-color-surface-2": "#1a1d25",
    "--ds-color-surface-3": "#232733",
    "--ds-color-border": "#262a34",
    "--ds-color-border-strong": "#3b4150",
    "--ds-color-ink": "#f1f3f8",
    "--ds-color-ink-2": "#a8aebb",
    "--ds-color-ink-3": "#6d7380",
    "--ds-color-accent": "#6e7ce0",
    "--ds-color-accent-hover": "#8b98f0",
    "--ds-color-accent-ink": "#ffffff",
    "--ds-color-accent-soft": "rgba(110, 124, 224, 0.14)",
    "--ds-color-band": "#0e1015",
    "--ds-color-band-ink": "#f1f3f8",
    "--ds-color-band-ink-2": "#8f95a3",

    "--ds-shadow-1": "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.35)",
    "--ds-shadow-2": "0 24px 48px -20px rgba(0,0,0,0.6)",
    "--basic-hero-grid": "rgba(255, 255, 255, 0.028)",
  },
};
