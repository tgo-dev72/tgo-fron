export interface DesignSystem {
  id: string;
  name: string;
  product: string;
  role: string;
  summary: string;
  inspiredBy: string[];
  vars: Record<string, string>;
  /** Optional dark palette applied when SystemRoot renders with theme="dark". */
  varsDark?: Record<string, string>;
  /** Monetization tier. Defaults to "standard". */
  tier?: "standard" | "premium";
  /** Premium capability flags unlocked by this design. */
  features?: string[];
}
