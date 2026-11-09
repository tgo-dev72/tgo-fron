interface BrandLogoProps {
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
}

export function BrandLogo({ alt = "TijaraGO", className = "", width, height }: BrandLogoProps) {
  return (
    <>
      <img
        src="/brand/logos/tyjara-go-blue-cyan.svg"
        alt={alt}
        className={`${className} sr-brand-logo-light`.trim()}
        width={width}
        height={height}
      />
      <img
        src="/brand/logos/tyjara-go-white.svg"
        alt={alt}
        className={`${className} sr-brand-logo-dark`.trim()}
        width={width}
        height={height}
      />
    </>
  );
}
