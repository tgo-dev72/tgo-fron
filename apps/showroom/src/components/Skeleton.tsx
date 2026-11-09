export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`sr-skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function StoreCardSkeleton() {
  return (
    <div className="sr-store-card sr-store-card-skeleton">
      <div className="sr-store-header">
        <Skeleton style={{ width: 48, height: 48, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Skeleton style={{ width: "60%", height: 18, marginBottom: 8 }} />
          <Skeleton style={{ width: 90, height: 16, borderRadius: 100 }} />
        </div>
      </div>
      <Skeleton style={{ width: "70%", height: 12, marginBottom: 8 }} />
      <Skeleton style={{ width: "50%", height: 12, marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 24, paddingTop: 16, borderTop: "1px solid var(--sr-border)" }}>
        <Skeleton style={{ width: 48, height: 20 }} />
        <Skeleton style={{ width: 64, height: 20 }} />
        <Skeleton style={{ width: 52, height: 20 }} />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="sr-dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
        <div>
          <Skeleton style={{ width: 200, height: 32, marginBottom: 8 }} />
          <Skeleton style={{ width: 260, height: 16 }} />
        </div>
        <Skeleton style={{ width: 160, height: 44, borderRadius: 8 }} />
      </div>
      <div className="sr-metrics-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sr-metric-card">
            <Skeleton style={{ width: 80, height: 12, marginBottom: 12 }} />
            <Skeleton style={{ width: 120, height: 28, marginBottom: 8 }} />
            <Skeleton style={{ width: "100%", height: 40 }} />
          </div>
        ))}
      </div>
      <div className="sr-stores-grid">
        {[0, 1].map((i) => (
          <StoreCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
