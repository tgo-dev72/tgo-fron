import type { CSSProperties, ReactNode } from "react";
import { t, useLocale } from "../i18n";

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`sk ${className}`} style={style} />;
}

export function SkeletonRows({ count = 6, height = 20 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} style={{ height }} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function PageLoader() {
  const locale = useLocale();
  return (
    <div className="page-skeleton" role="status" aria-label={t(locale, "loading.dashboard")} aria-busy="true">
      <Skeleton className="page-skeleton-title" />
      <Skeleton className="page-skeleton-copy" />
      <div className="page-skeleton-grid" aria-hidden="true">
        <Skeleton /><Skeleton /><Skeleton />
      </div>
    </div>
  );
}
