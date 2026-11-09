export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark ${compact ? "compact" : ""}`}>
    <img className="brand-mark-image" src="/brand/logos/tyjara-go-white.svg" alt="" aria-hidden="true" />
    <span className="visually-hidden">TijaraGO</span>
  </span>;
}

export function LoadingBrand({ label = "Loading" }: { label?: string }) {
  return <span className="loading-brand" role="status" aria-label={label}>
    <img src="/brand/logos/tyjara-go-white.svg" alt="" aria-hidden="true" />
  </span>;
}
