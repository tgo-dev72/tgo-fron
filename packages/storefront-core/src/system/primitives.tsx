import type { CSSProperties, ReactNode } from "react";
import type { DesignSystem } from "./types";

/** Scoped wrapper that applies a system's design tokens as CSS variables. */
export function SystemRoot({
  system,
  theme = "light",
  children,
  style,
}: {
  system: DesignSystem;
  theme?: "light" | "dark";
  children: ReactNode;
  style?: CSSProperties;
}) {
  const palette =
    theme === "dark" && system.varsDark
      ? { ...system.vars, ...system.varsDark }
      : system.vars;
  return (
    <div
      className="ds-root"
      style={{ ...palette, colorScheme: theme, ...style }}
    >
      {children}
    </div>
  );
}

export function Container({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`ds-container ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className = "",
  style,
  id,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <section id={id} className={`ds-section ${className}`} style={style}>
      {children}
    </section>
  );
}

export function Grid({
  children,
  cols = 3,
  className = "",
  style,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`ds-grid ds-grid-${cols} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p className="ds-eyebrow" style={style}>
      {children}
    </p>
  );
}

export function Badge({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="ds-badge" style={style}>
      {children}
    </span>
  );
}

export function Button({
  variant = "primary",
  children,
  style,
  className = "",
  as,
  href,
}: {
  variant?: "primary" | "secondary" | "ghost" | "on-band";
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  as?: "button" | "a";
  href?: string;
}) {
  const cls = `ds-btn ds-btn-${variant} ${className}`.trim();
  if (as === "a") {
    return (
      <a href={href} className={cls} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} style={style}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  style,
  hairline = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  hairline?: boolean;
}) {
  return (
    <div className={`ds-card ${hairline ? "ds-card-hairline" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}
