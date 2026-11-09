export function BrandLoader({ label, text }: { label?: string; text?: string }) {
  return (
    <div className="sr-brand-loader" role="status" aria-label={label ?? text ?? "Loading"}>
      <span className="sr-brand-loader-art" aria-hidden="true" />
      {text && <span>{text}</span>}
    </div>
  );
}
