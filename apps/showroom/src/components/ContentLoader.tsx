export function ContentLoader({ label }: { label: string }) {
  return (
    <section className="sr-content-loader" role="status" aria-label={label} aria-busy="true">
      <span className="sr-content-loader-line sr-content-loader-title" />
      <span className="sr-content-loader-line sr-content-loader-copy" />
      <div className="sr-content-loader-grid" aria-hidden="true">
        <span /><span /><span />
      </div>
      <span className="sr-visually-hidden">{label}</span>
    </section>
  );
}
