import type { ReactNode } from "react";

export function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <article className="sr-feature-card">
      <div className="sr-feature-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </article>
  );
}
