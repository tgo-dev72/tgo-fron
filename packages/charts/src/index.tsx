import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import {
  init,
  use,
  type EChartsCoreOption,
  type EChartsType,
} from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import "./styles.css";

use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
  AriaComponent,
  CanvasRenderer,
]);

export type PlatformChartOption = EChartsCoreOption;

interface PlatformChartProps {
  option: PlatformChartOption;
  label: string;
  className?: string;
  expandLabel?: string;
  closeLabel?: string;
}

function ChartCanvas({
  option,
  label,
  className,
}: {
  option: PlatformChartOption;
  label: string;
  className: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = init(container, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const resize = () => chart.resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(container);
    window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: false });
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label={label}
    />
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function PlatformChart({
  option,
  label,
  className = "",
  expandLabel,
  closeLabel,
}: PlatformChartProps) {
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resolvedExpandLabel = expandLabel ?? `Expand chart: ${label}`;
  const resolvedCloseLabel = closeLabel ?? "Close expanded chart";

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
      expandButtonRef.current?.focus();
    };
  }, [expanded]);

  const dialog = expanded && typeof document !== "undefined"
    ? createPortal(
      <div
        className="platform-chart-dialog-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setExpanded(false);
        }}
      >
        <section
          className="platform-chart-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="platform-chart-dialog-header">
            <h2 id={titleId}>{label}</h2>
            <button
              ref={closeButtonRef}
              type="button"
              className="platform-chart-icon-button"
              aria-label={resolvedCloseLabel}
              title={resolvedCloseLabel}
              onClick={() => setExpanded(false)}
            >
              <CloseIcon />
            </button>
          </header>
          <ChartCanvas
            option={option}
            label={label}
            className="platform-chart platform-chart-expanded-canvas"
          />
        </section>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="platform-chart-shell">
      <ChartCanvas
        option={option}
        label={label}
        className={`platform-chart ${className}`.trim()}
      />
      <button
        ref={expandButtonRef}
        type="button"
        className="platform-chart-icon-button platform-chart-expand-button"
        aria-label={resolvedExpandLabel}
        title={resolvedExpandLabel}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={() => setExpanded(true)}
      >
        <ExpandIcon />
      </button>
      {dialog}
    </div>
  );
}
