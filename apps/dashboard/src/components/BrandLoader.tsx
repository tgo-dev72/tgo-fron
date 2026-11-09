interface BrandLoaderProps {
  label?: string;
  fullPage?: boolean;
  surface?: "canvas" | "card";
  hideLabel?: boolean;
}

export function BrandLoader({
  label = "Loading",
  fullPage = false,
  surface = "canvas",
  hideLabel = false,
}: BrandLoaderProps) {
  return (
    <div
      className={`d-brand-loader${fullPage ? " d-brand-loader-full" : ""}`}
      role="status"
      aria-label={label}
    >
      <span
        className={`d-brand-loader-art${surface === "card" ? " d-brand-loader-art-card" : ""}`}
        aria-hidden="true"
      />
      {!hideLabel && <span className="d-brand-loader-label">{label}</span>}
    </div>
  );
}
