import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PlatformChart, type PlatformChartOption } from "@platform/charts";
import {
  FiActivity, FiAlertTriangle, FiArrowRight, FiBarChart2, FiClock, FiEye, FiLock,
  FiPackage, FiRepeat, FiSearch, FiShoppingCart, FiTrendingUp, FiUsers,
} from "react-icons/fi";
import { api } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { Skeleton, EmptyState } from "../components/Skeleton";
import { t, fmtMoney, useLocale } from "../i18n";
import { useTheme } from "../theme";
import {
  ANALYTICS_LEVEL_RANK, ANALYTICS_RANGES, type AnalyticsLevel, type AnalyticsRange,
} from "../lib/analytics";

/* ── helpers ──────────────────────────────────────────────────────────── */

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function weekdayLabels(locale: string) {
  const labels =
    locale === "ar"
      ? ["سبت", "أحد", "إثن", "ثلا", "أرب", "خمي", "جمع"]
      : locale === "fr"
      ? ["Sam", "Dim", "Lun", "Mar", "Mer", "Jeu", "Ven"]
      : ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  return new Map([6, 0, 1, 2, 3, 4, 5].map((day, index) => [day, labels[index]]));
}

/* ── mini bar component ───────────────────────────────────────────────── */

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span style={{ width: 44, fontSize: 11, color: "var(--ink-faint)", textAlign: "end", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 18, background: "var(--surface-subtle)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .3s ease" }} />
      </div>
      <span style={{ width: 36, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "end", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function AnalyticsUpgrade({ level, title, copy, cta }: { level: "standard" | "advanced"; title: string; copy: string; cta: string }) {
  return (
    <section className="analytics-upgrade-card">
      <span className="analytics-upgrade-icon"><FiLock /></span>
      <div>
        <span className="analytics-level-label">{level}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <Link className="btn btn-primary" to="/subscription">
        {cta} <FiArrowRight />
      </Link>
    </section>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */

export function AnalyticsPage() {
  const { store } = useStore();
  const locale = useLocale();
  const { theme } = useTheme();
  const analyticsLevel: AnalyticsLevel = store?.analytics_level ?? "essential";
  const levelRank = ANALYTICS_LEVEL_RANK[analyticsLevel];
  const availableRanges = ANALYTICS_RANGES[analyticsLevel];
  const [range, setRange] = useState<AnalyticsRange>(30);

  useEffect(() => {
    if (!availableRanges.includes(range)) setRange(30);
  }, [analyticsLevel, availableRanges, range]);

  const reportState = useAsync(
    () => store ? api.getAnalytics(store.id, range) : Promise.reject(new Error("No store selected")),
    [store?.id, range],
  );
  const report = reportState.data;

  /* sales chart */
  const chart = useMemo(() => {
    const dateLocale = locale === "ar" ? "ar-MA-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US";
    return (report?.daily ?? []).map((point) => ({
      date: point.date,
      label: new Date(`${point.date}T12:00:00`).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }),
      amount: safeNum(point.revenue),
      count: point.orders,
    }));
  }, [locale, report?.daily]);
  const salesChartOption = useMemo<PlatformChartOption>(() => {
    const muted = theme === "dark" ? "#8eaa98" : "#64748b";
    const grid = theme === "dark" ? "#203b2a" : "#e8edf2";
    const brand = theme === "dark" ? "#467d5c" : "#3f7657";
    const zoomVisible = range > 14;
    const zoomStart = range > 30 ? ((range - 30) / range) * 100 : 0;
    return {
      animationDuration: 360,
      aria: { enabled: true },
      grid: { left: 52, right: 18, top: 22, bottom: zoomVisible ? 54 : 30 },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        valueFormatter: (value: unknown) => fmtMoney(Number(value) || 0, report?.currency, locale),
      },
      xAxis: {
        type: "category",
        data: chart.map((point) => point.label),
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: muted, hideOverlap: true, interval: "auto", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 10 },
        splitLine: { lineStyle: { color: grid, type: "dashed" } },
      },
      dataZoom: zoomVisible ? [
        { type: "inside", start: zoomStart, end: 100, zoomOnMouseWheel: false },
        { type: "slider", start: zoomStart, end: 100, height: 14, bottom: 8, showDetail: false, brushSelect: false },
      ] : [],
      series: [{
        name: t(locale, "overview.revenue"),
        type: "bar",
        data: chart.map((point) => point.amount),
        barMaxWidth: 34,
        itemStyle: { color: brand, borderRadius: [5, 5, 2, 2] },
        emphasis: { itemStyle: { color: theme === "dark" ? "#5f9c76" : "#315f46" } },
      }],
    };
  }, [chart, locale, range, report?.currency, theme]);

  /* weekday */
  const weekdays = useMemo(() => {
    const labels = weekdayLabels(locale);
    const byDay = new Map((report?.standard?.weekdays ?? []).map((point) => [point.day, point]));
    return [6, 0, 1, 2, 3, 4, 5].map((day) => ({
      day,
      label: labels.get(day) ?? String(day),
      amount: safeNum(byDay.get(day)?.revenue),
      count: byDay.get(day)?.orders ?? 0,
    }));
  }, [locale, report?.standard?.weekdays]);

  /* hour of day */
  const hours = useMemo(() => (report?.standard?.hours ?? []).map((point) => ({
    hour: point.hour,
    count: point.orders,
    amount: safeNum(point.revenue),
  })), [report?.standard?.hours]);
  const hourChartOption = useMemo<PlatformChartOption>(() => {
    const muted = theme === "dark" ? "#8eaa98" : "#64748b";
    const grid = theme === "dark" ? "#203b2a" : "#e8edf2";
    const brand = theme === "dark" ? "#467d5c" : "#3f7657";
    return {
      animationDuration: 320,
      aria: { enabled: true },
      grid: { left: 42, right: 14, top: 16, bottom: 30 },
      tooltip: { trigger: "axis", renderMode: "richText" },
      xAxis: {
        type: "category",
        data: hours.map((point) => `${point.hour}h`),
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: muted, hideOverlap: true, interval: 5, fontSize: 9 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 9 },
        splitLine: { lineStyle: { color: grid, type: "dashed" } },
      },
      series: [{
        name: t(locale, "overview.orders"),
        type: "bar",
        data: hours.map((point) => point.count),
        barMaxWidth: 18,
        itemStyle: { color: brand, borderRadius: [3, 3, 1, 1] },
      }],
    };
  }, [hours, locale, theme]);

  /* top products */
  const topProducts = useMemo(() => (report?.standard?.top_products ?? []).map((product) => ({
    name: product.name,
    qty: product.quantity,
    revenue: safeNum(product.revenue),
  })), [report?.standard?.top_products]);

  /* status breakdown */
  const statusCounts = report?.order_status ?? { pending: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0 };

  /* payment method */
  const paymentBreakdown = {
    online: safeNum(report?.standard?.payment.online),
    cod: safeNum(report?.standard?.payment.cod),
  };

  /* stock stats */
  const stockStats = {
    inStock: report?.standard?.stock.in_stock ?? 0,
    lowStock: report?.standard?.stock.low_stock ?? 0,
    outOfStock: report?.standard?.stock.out_of_stock ?? report?.kpis.out_of_stock_products ?? 0,
  };

  /* KPIs */
  const kpis = {
    totalRevenue: safeNum(report?.kpis.collected_revenue),
    aov: safeNum(report?.kpis.average_order_value),
    avgItemsPerOrder: report?.kpis.average_items_per_order ?? 0,
  };

  const bestWeekday = weekdays.find((point) => point.day === report?.advanced?.best_weekday);
  const bestHour = hours.find((point) => point.hour === report?.advanced?.best_hour);
  const advanced = {
    revenueChange: report?.advanced?.revenue_change_percent ?? null,
    repeatRate: report?.advanced?.repeat_customer_rate ?? 0,
    cancellationRate: report?.advanced?.cancellation_rate ?? 0,
    avgFulfilmentHours: report?.advanced?.average_fulfilment_hours ?? 0,
    bestWeekday,
    bestHour,
  };
  const funnel = report?.standard?.funnel;
  const productPerformance = report?.standard?.product_performance ?? [];
  const zeroResultSearches = report?.standard?.zero_result_searches ?? [];
  const funnelTrendOption = useMemo<PlatformChartOption>(() => {
    const trend = report?.advanced?.funnel_trend ?? [];
    const dateLocale = locale === "ar" ? "ar-MA-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US";
    const muted = theme === "dark" ? "#8eaa98" : "#64748b";
    const grid = theme === "dark" ? "#203b2a" : "#e8edf2";
    const labels = trend.map((point) => new Date(`${point.date}T12:00:00`).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }));
    return {
      animationDuration: 360,
      aria: { enabled: true },
      color: ["#3f7657", "#3978a8", "#d58b2b", "#8a5ab5"],
      grid: { left: 42, right: 18, top: 42, bottom: range > 30 ? 56 : 30 },
      legend: { top: 5, textStyle: { color: muted, fontSize: 10 } },
      tooltip: { trigger: "axis", renderMode: "richText" },
      xAxis: { type: "category", data: labels, axisLabel: { color: muted, hideOverlap: true, fontSize: 9 }, axisLine: { lineStyle: { color: grid } }, axisTick: { show: false } },
      yAxis: { type: "value", minInterval: 1, axisLabel: { color: muted, fontSize: 9 }, splitLine: { lineStyle: { color: grid, type: "dashed" } } },
      dataZoom: range > 30 ? [{ type: "inside", start: ((range - 30) / range) * 100, end: 100 }, { type: "slider", height: 14, bottom: 8, showDetail: false }] : [],
      series: [
        { name: t(locale, "analytics.visits"), type: "line", smooth: true, showSymbol: false, data: trend.map((point) => point.visits) },
        { name: t(locale, "analytics.productViews"), type: "line", smooth: true, showSymbol: false, data: trend.map((point) => point.product_views) },
        { name: t(locale, "analytics.cartAdditions"), type: "line", smooth: true, showSymbol: false, data: trend.map((point) => point.cart_additions) },
        { name: t(locale, "analytics.orderSubmissions"), type: "line", smooth: true, showSymbol: false, data: trend.map((point) => point.order_submissions) },
      ],
    };
  }, [locale, range, report?.advanced?.funnel_trend, theme]);

  const loading = reportState.loading;

  if (loading) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="d-title">{t(locale, "analytics.title")}</h1>
            <p className="d-subtitle">{t(locale, "analytics.subtitle")}</p>
          </div>
        </div>
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div className="metric" key={i}>
              <Skeleton style={{ height: 20, width: 20, borderRadius: "50%" }} />
              <Skeleton style={{ height: 14, width: 80, marginTop: 8 }} />
              <Skeleton style={{ height: 30, width: 100, marginTop: 4 }} />
            </div>
          ))}
        </div>
        <div className="grid analytics-2col" style={{ marginBottom: 16 }}>
          <div className="card"><div style={{ padding: 20 }}><Skeleton style={{ height: 240 }} /></div></div>
          <div className="card"><div style={{ padding: 20 }}><Skeleton style={{ height: 240 }} /></div></div>
        </div>
      </div>
    );
  }

  if (reportState.error || !report) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="d-title">{t(locale, "analytics.title")}</h1>
            <p className="d-subtitle">{t(locale, "analytics.subtitle")}</p>
          </div>
        </div>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--danger)", marginBottom: 14 }}>{reportState.error ?? t(locale, "errors.loadFailed")}</p>
          <button className="btn btn-secondary" type="button" onClick={reportState.reload}>
            {t(locale, "errors.tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "analytics.title")}</h1>
          <p className="d-subtitle">{t(locale, "analytics.subtitle")}</p>
        </div>
        <div className="page-head-actions">
          <div className="range-tabs">
            {availableRanges.map((d) => (
              <button key={d} className={`range-tab${range === d ? " active" : ""}`} onClick={() => setRange(d)}>
                {t(locale, "overview.days", d)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className={`analytics-level-banner analytics-level-${analyticsLevel}`}>
        <div>
          <span className="analytics-level-label">{t(locale, `analytics.level.${analyticsLevel}`)}</span>
          <strong>{t(locale, `analytics.level.${analyticsLevel}Title`)}</strong>
          <p>{t(locale, `analytics.level.${analyticsLevel}Copy`)}</p>
        </div>
        {analyticsLevel !== "advanced" && (
          <Link to="/subscription">{t(locale, "analytics.comparePlans")} <FiArrowRight /></Link>
        )}
      </section>

      {loading ? (
        <div className="card"><Skeleton style={{ height: 260 }} /></div>
      ) : !report.has_data ? (
        <EmptyState icon={<FiBarChart2 />} title={t(locale, "analytics.noData")} sub={t(locale, "analytics.noDataSub")} />
      ) : (
        <>
          {/* ── KPI Row ─────────────────────────────────────────────── */}
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="metric">
              <span className="metric-icon" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><FiTrendingUp /></span>
              <span className="metric-label">{t(locale, "analytics.totalRevenue")}</span>
              <span className="metric-value">{fmtMoney(kpis.totalRevenue, report.currency, locale)}</span>
              <span className="metric-delta up">{t(locale, "overview.confirmedOnly")}</span>
            </div>
            <div className="metric">
              <span className="metric-icon" style={{ background: "var(--info-soft)", color: "var(--info)" }}><FiShoppingCart /></span>
              <span className="metric-label">{t(locale, "analytics.avgOrderValue")}</span>
              <span className="metric-value">{fmtMoney(kpis.aov, report.currency, locale)}</span>
              <span className="metric-delta">{t(locale, "analytics.perPaidOrder")}</span>
            </div>
            <div className="metric">
              <span className="metric-icon" style={{ background: "var(--success-soft)", color: "var(--success)" }}><FiUsers /></span>
              <span className="metric-label">{t(locale, "analytics.totalCustomers")}</span>
              <span className="metric-value">{report.kpis.customers}</span>
              <span className="metric-delta">{t(locale, "overview.lifetime")}</span>
            </div>
            <div className="metric">
              <span className="metric-icon" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}><FiPackage /></span>
              <span className="metric-label">{t(locale, "analytics.totalProducts")}</span>
              <span className="metric-value">{report.kpis.products}</span>
              <span className="metric-delta" style={{ color: stockStats.outOfStock > 0 ? "var(--danger)" : "var(--ink-faint)" }}>
                {t(locale, "analytics.stockSummary", stockStats.outOfStock)}
              </span>
            </div>
          </div>

          {/* ── Sales + Status ──────────────────────────────────────── */}
          <div className="grid analytics-2col" style={{ marginBottom: 16 }}>
            {/* Sales line chart */}
            <div className="card">
              <div className="d-card-head">
                <span className="d-card-title">{t(locale, "analytics.salesChart", range)}</span>
                <span className="d-eyebrow">{t(locale, "overview.perDay")}</span>
              </div>
              <PlatformChart
                className="chart"
                option={salesChartOption}
                label={t(locale, "analytics.salesChart", range)}
                expandLabel={t(locale, "theme.expandChart")}
                closeLabel={t(locale, "theme.closeChart")}
              />
            </div>

            {/* Status breakdown */}
            <div className="card">
              <div className="d-card-head">
                <span className="d-card-title">{t(locale, "analytics.orderStatus")}</span>
              </div>
              <div style={{ padding: "12px 20px" }}>
                {(["pending", "confirmed", "shipped", "delivered", "cancelled"] as const).map((st) => {
                  const color =
                    st === "pending" ? "var(--warning)" :
                    st === "confirmed" ? "var(--success)" :
                    st === "shipped" ? "var(--info)" :
                    st === "delivered" ? "#2ba4a6" :
                    "var(--danger)";
                  return (
                    <BarRow
                      key={st}
                      label={t(locale, `orders.${st}`)}
                      value={statusCounts[st]}
                      max={Math.max(1, ...Object.values(statusCounts))}
                      color={color}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {levelRank >= ANALYTICS_LEVEL_RANK.standard ? <>
          {/* ── Standard: conversion and product intelligence ──────── */}
          <div className="analytics-section-heading">
            <div><span>{t(locale, "analytics.level.standard")}</span><h2>{t(locale, "analytics.conversionIntelligence")}</h2></div>
            <p>{t(locale, "analytics.conversionIntelligenceCopy")}</p>
          </div>
          {funnel && <div className="card analytics-funnel-card" data-testid="conversion-funnel">
            <div className="d-card-head">
              <span className="d-card-title">{t(locale, "analytics.conversionFunnel")}</span>
              <span className="d-eyebrow">{t(locale, "analytics.sessionBased")}</span>
            </div>
            <div className="analytics-funnel-stages">
              {[
                { key: "visits", icon: <FiUsers />, label: t(locale, "analytics.visits"), value: funnel.store_visits, rate: null },
                { key: "views", icon: <FiEye />, label: t(locale, "analytics.productViews"), value: funnel.product_views, rate: funnel.store_visits ? Math.min(100, (funnel.unique_sessions.product_views / funnel.store_visits) * 100) : 0 },
                { key: "cart", icon: <FiShoppingCart />, label: t(locale, "analytics.cartAdditions"), value: funnel.cart_additions, rate: funnel.rates.add_to_cart },
                { key: "checkout", icon: <FiActivity />, label: t(locale, "analytics.checkoutStarts"), value: funnel.checkout_starts, rate: funnel.rates.checkout_start },
                { key: "orders", icon: <FiPackage />, label: t(locale, "analytics.orderSubmissions"), value: funnel.order_submissions, rate: funnel.rates.order_submission },
              ].map((stage) => <div className="analytics-funnel-stage" key={stage.key}>
                {stage.rate !== null && <span className="analytics-funnel-rate">{Math.round(stage.rate)}%</span>}
                <i>{stage.icon}</i><strong>{stage.value}</strong><small>{stage.label}</small>
              </div>)}
            </div>
            <div className="analytics-abandonment-row">
              <span>{t(locale, "analytics.cartAbandonment")} <strong>{Math.round(funnel.rates.cart_abandonment)}%</strong></span>
              <span>{t(locale, "analytics.checkoutAbandonment")} <strong>{Math.round(funnel.rates.checkout_abandonment)}%</strong></span>
            </div>
          </div>}
          <div className="grid analytics-2col analytics-product-grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="d-card-head"><span className="d-card-title">{t(locale, "analytics.productPerformance")}</span></div>
              <div className="analytics-table-wrap">
                {productPerformance.length === 0 ? <p className="analytics-inline-empty">{t(locale, "analytics.noBehaviorData")}</p> : <table className="analytics-data-table">
                  <thead><tr><th>{t(locale, "analytics.product")}</th><th>{t(locale, "analytics.views")}</th><th>{t(locale, "analytics.cart")}</th><th>{t(locale, "analytics.orders")}</th><th>{t(locale, "analytics.conversion")}</th>{analyticsLevel === "advanced" && <th>{t(locale, "analytics.revenuePerView")}</th>}</tr></thead>
                  <tbody>{productPerformance.slice(0, 12).map((product) => <tr key={product.product_id}><td title={product.name}>{product.name}</td><td>{product.views}</td><td>{product.cart_additions}</td><td>{product.orders}</td><td>{Math.round(product.conversion_rate)}%</td>{analyticsLevel === "advanced" && <td>{fmtMoney(safeNum(product.revenue_per_view), report.currency, locale)}</td>}</tr>)}</tbody>
                </table>}
              </div>
            </div>
            <div className="card">
              <div className="d-card-head"><span className="d-card-title">{t(locale, "analytics.zeroResultSearches")}</span><FiSearch /></div>
              <div className="analytics-search-list">
                {zeroResultSearches.length === 0 ? <p className="analytics-inline-empty">{t(locale, "analytics.noMissedSearches")}</p> : zeroResultSearches.map((item) => <div key={item.query}><span>{item.query}</span><strong>{item.searches}</strong></div>)}
              </div>
            </div>
          </div>

          {/* ── Standard: operating patterns ────────────────────────── */}
          <div className="analytics-section-heading">
            <div><span>{t(locale, "analytics.level.standard")}</span><h2>{t(locale, "analytics.operatingPatterns")}</h2></div>
            <p>{t(locale, "analytics.operatingPatternsCopy")}</p>
          </div>
          <div className="grid analytics-2eq" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="d-card-head">
                <span className="d-card-title">{t(locale, "analytics.ordersByWeekday")}</span>
              </div>
              <div style={{ padding: "12px 20px" }}>
                {weekdays.map((w) => (
                  <BarRow
                    key={w.day}
                    label={w.label}
                    value={w.count}
                    max={Math.max(1, ...weekdays.map((x) => x.count))}
                    color="var(--brand)"
                  />
                ))}
              </div>
            </div>
            <div className="card">
              <div className="d-card-head">
                <span className="d-card-title">{t(locale, "analytics.ordersByHour")}</span>
              </div>
              <PlatformChart
                className="analytics-hour-chart"
                option={hourChartOption}
                label={t(locale, "analytics.ordersByHour")}
                expandLabel={t(locale, "theme.expandChart")}
                closeLabel={t(locale, "theme.closeChart")}
              />
            </div>
          </div>

          {/* ── Top Products + Payment + Stock ──────────────────────── */}
          <div className="grid analytics-3col" style={{ marginBottom: 16 }}>
            {/* Top products */}
            <div className="card">
              <div className="d-card-head">
                <span className="d-card-title">{t(locale, "analytics.topProducts")}</span>
              </div>
              <div style={{ padding: "8px 20px 12px" }}>
                {topProducts.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink-faint)", padding: "16px 0", textAlign: "center" }}>{t(locale, "analytics.noProductSales")}</p>
                ) : (
                  topProducts.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < topProducts.length - 1 ? "1px solid var(--hairline)" : undefined }}>
                      <span style={{ width: 22, fontSize: 11, color: "var(--ink-faint)", textAlign: "center", flexShrink: 0, fontWeight: 600 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{p.qty} sold</div>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--brand-press)", flexShrink: 0 }}>
                        {fmtMoney(p.revenue, report.currency, locale)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payment breakdown */}
            <div className="card">
              <div className="d-card-head">
                <span className="d-card-title">{t(locale, "analytics.paymentMethods")}</span>
              </div>
              <div style={{ padding: "20px" }}>
                {(() => {
                  const total = paymentBreakdown.online + paymentBreakdown.cod;
                  if (total === 0) return <p style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center" }}>{t(locale, "analytics.noSales")}</p>;
                  const onlinePct = (paymentBreakdown.online / total) * 100;
                  return (
                    <>
                      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 16, background: "var(--hairline)" }}>
                        <div style={{ width: `${onlinePct}%`, background: "var(--info)", transition: "width .3s ease" }} />
                        <div style={{ width: `${100 - onlinePct}%`, background: "var(--warning)", transition: "width .3s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{t(locale, "analytics.online")}</div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtMoney(paymentBreakdown.online, report.currency, locale)}</div>
                        </div>
                        <div style={{ textAlign: "end" }}>
                          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{t(locale, "analytics.cod")}</div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtMoney(paymentBreakdown.cod, report.currency, locale)}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-faint)" }}>
                        <span>{Math.round(onlinePct)}% {t(locale, "analytics.online")}</span>
                        <span>{Math.round(100 - onlinePct)}% COD</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Stock overview */}
            <div className="card">
              <div className="d-card-head">
                <span className="d-card-title">{t(locale, "analytics.stockOverview")}</span>
              </div>
              <div style={{ padding: "20px" }}>
                {report.kpis.products === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center" }}>{t(locale, "analytics.noProducts")}</p>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 6, height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 16, background: "var(--hairline)" }}>
                      {stockStats.inStock > 0 && <div style={{ width: `${(stockStats.inStock / report.kpis.products) * 100}%`, background: "var(--success)", transition: "width .3s ease" }} />}
                      {stockStats.lowStock > 0 && <div style={{ width: `${(stockStats.lowStock / report.kpis.products) * 100}%`, background: "var(--warning)", transition: "width .3s ease" }} />}
                      {stockStats.outOfStock > 0 && <div style={{ width: `${(stockStats.outOfStock / report.kpis.products) * 100}%`, background: "var(--danger)", transition: "width .3s ease" }} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--success)" }} />
                          <span style={{ fontSize: 13 }}>{t(locale, "analytics.inStock")}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{stockStats.inStock}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--warning)" }} />
                          <span style={{ fontSize: 13 }}>{t(locale, "analytics.lowStock")}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--warning)" }}>{stockStats.lowStock}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--danger)" }} />
                          <span style={{ fontSize: 13 }}>{t(locale, "analytics.outOfStock")}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>{stockStats.outOfStock}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          </> : (
            <AnalyticsUpgrade
              level="standard"
              title={t(locale, "analytics.unlockStandard")}
              copy={t(locale, "analytics.unlockStandardCopy")}
              cta={t(locale, "analytics.comparePlans")}
            />
          )}

          {levelRank >= ANALYTICS_LEVEL_RANK.advanced ? (
            <>
              <div className="analytics-section-heading">
                <div><span>{t(locale, "analytics.level.advanced")}</span><h2>{t(locale, "analytics.decisionInsights")}</h2></div>
                <p>{t(locale, "analytics.decisionInsightsCopy")}</p>
              </div>
              <div className="grid analytics-insight-grid">
                <article className="analytics-insight-card">
                  <span><FiTrendingUp /></span>
                  <small>{t(locale, "analytics.revenueChange")}</small>
                  <strong>{advanced.revenueChange === null ? "—" : `${advanced.revenueChange >= 0 ? "+" : ""}${Math.round(advanced.revenueChange)}%`}</strong>
                  <p>{t(locale, "analytics.comparedPrevious", range)}</p>
                </article>
                <article className="analytics-insight-card">
                  <span><FiRepeat /></span>
                  <small>{t(locale, "analytics.repeatCustomerRate")}</small>
                  <strong>{Math.round(advanced.repeatRate)}%</strong>
                  <p>{t(locale, "analytics.repeatCustomerCopy")}</p>
                </article>
                <article className="analytics-insight-card">
                  <span><FiActivity /></span>
                  <small>{t(locale, "analytics.cancellationRate")}</small>
                  <strong>{Math.round(advanced.cancellationRate)}%</strong>
                  <p>{t(locale, "analytics.cancellationCopy")}</p>
                </article>
                <article className="analytics-insight-card">
                  <span><FiClock /></span>
                  <small>{t(locale, "analytics.fulfilmentTime")}</small>
                  <strong>{advanced.avgFulfilmentHours > 0 ? t(locale, "analytics.hours", Math.round(advanced.avgFulfilmentHours)) : "—"}</strong>
                  <p>{t(locale, "analytics.fulfilmentCopy")}</p>
                </article>
              </div>
              <div className="card analytics-signal-card">
                <div>
                  <span>{t(locale, "analytics.bestSalesDay")}</span>
                  <strong>{advanced.bestWeekday?.amount ? advanced.bestWeekday.label : "—"}</strong>
                </div>
                <div>
                  <span>{t(locale, "analytics.bestSalesHour")}</span>
                  <strong>{advanced.bestHour?.amount ? `${advanced.bestHour.hour}:00` : "—"}</strong>
                </div>
                <div>
                  <span>{t(locale, "analytics.itemsPerOrder")}</span>
                  <strong>{kpis.avgItemsPerOrder.toFixed(1)}</strong>
                </div>
              </div>
              <div className="analytics-section-heading">
                <div><span>{t(locale, "analytics.level.advanced")}</span><h2>{t(locale, "analytics.funnelTrends")}</h2></div>
                <p>{t(locale, "analytics.funnelTrendsCopy", range)}</p>
              </div>
              <div className="analytics-comparison-grid">
                {(["store_visits", "product_views", "cart_additions", "checkout_starts", "order_submissions"] as const).map((key) => {
                  const value = report.advanced?.funnel_comparison.change_percent[key] ?? null;
                  return <article key={key}><small>{t(locale, `analytics.comparison.${key}`)}</small><strong className={value !== null && value < 0 ? "down" : "up"}>{value === null ? "—" : `${value >= 0 ? "+" : ""}${Math.round(value)}%`}</strong><span>{t(locale, "analytics.vsPrevious")}</span></article>;
                })}
              </div>
              <div className="card analytics-funnel-trend-card">
                <PlatformChart className="chart" option={funnelTrendOption} label={t(locale, "analytics.funnelTrends")} expandLabel={t(locale, "theme.expandChart")} closeLabel={t(locale, "theme.closeChart")} />
              </div>
              <div className="grid analytics-2col analytics-opportunity-layout">
                <div className="card">
                  <div className="d-card-head"><span className="d-card-title">{t(locale, "analytics.opportunities")}</span><FiAlertTriangle /></div>
                  <div className="analytics-opportunity-list">
                    {(report.advanced?.opportunities ?? []).length === 0 ? <p className="analytics-inline-empty">{t(locale, "analytics.noOpportunities")}</p> : report.advanced?.opportunities.map((item, index) => <article key={`${item.kind}:${item.product_id ?? index}`}>
                      <i><FiAlertTriangle /></i><div><strong>{item.product_name || t(locale, "analytics.storeFunnel")}</strong><p>{t(locale, `analytics.opportunity.${item.kind}`, item.metrics.views ?? item.metrics.cart_abandonment ?? 0, item.metrics.cart_additions ?? 0, item.metrics.orders ?? 0)}</p></div>
                    </article>)}
                  </div>
                </div>
                <div className="card">
                  <div className="d-card-head"><span className="d-card-title">{t(locale, "analytics.sources")}</span></div>
                  <div className="analytics-table-wrap">
                    {(report.advanced?.sources ?? []).length === 0 ? <p className="analytics-inline-empty">{t(locale, "analytics.noSourceData")}</p> : <table className="analytics-data-table"><thead><tr><th>{t(locale, "analytics.source")}</th><th>{t(locale, "analytics.visits")}</th><th>{t(locale, "analytics.orderSubmissions")}</th><th>{t(locale, "analytics.collectedOrders")}</th><th>{t(locale, "analytics.conversion")}</th><th>{t(locale, "analytics.revenue")}</th></tr></thead><tbody>{report.advanced?.sources.map((source) => <tr key={`${source.source}:${source.campaign}`}><td>{source.campaign ? `${source.source} · ${source.campaign}` : source.source}</td><td>{source.visits}</td><td>{source.order_submissions}</td><td>{source.collected_orders}</td><td>{Math.round(source.conversion_rate)}%</td><td>{fmtMoney(safeNum(source.revenue), report.currency, locale)}</td></tr>)}</tbody></table>}
                  </div>
                </div>
              </div>
            </>
          ) : levelRank >= ANALYTICS_LEVEL_RANK.standard ? (
            <AnalyticsUpgrade
              level="advanced"
              title={t(locale, "analytics.unlockAdvanced")}
              copy={t(locale, "analytics.unlockAdvancedCopy")}
              cta={t(locale, "analytics.comparePlans")}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
