import { useMemo, useState } from "react";
import { PlatformChart, type PlatformChartOption } from "@platform/charts";
import { FiArrowUpRight, FiShoppingCart, FiShoppingBag, FiUsers, FiDollarSign } from "react-icons/fi";
import { api, type Order, type AnalyticsReport } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { Skeleton, EmptyState } from "../components/Skeleton";
import { t, fmtMoney, timeAgo, useLocale } from "../i18n";
import { useTheme } from "../theme";

const DAYS = 7;

function statusOf(o: Order, locale: "en" | "fr" | "ar"): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t(locale, "orders.pending"), cls: "badge-warning" },
    confirmed: { label: t(locale, "orders.confirmed"), cls: "badge-success" },
    shipped: { label: t(locale, "orders.shipped"), cls: "badge-info" },
    delivered: { label: t(locale, "orders.delivered"), cls: "badge-success" },
    cancelled: { label: t(locale, "orders.cancelled"), cls: "badge-danger" },
  };
  return map[o.status] ?? { label: o.status, cls: "" };
}

export function OverviewPage() {
  const { store } = useStore();
  const locale = useLocale();
  const { theme } = useTheme();
  const [range, setRange] = useState<7 | 30>(DAYS);

  const orders = useAsync(() => (store ? api.listOrders(store.id) : Promise.resolve<Order[]>([])), [store?.id]);
  const report = useAsync<AnalyticsReport | null>(
    () => store ? api.getAnalytics(store.id, range) : Promise.resolve(null), [store?.id, range],
  );
  const loadingAll = orders.loading || report.loading;
  const data = orders.data ?? [];
  const currency = report.data?.currency ?? "MAD";
  const totals = {
    revenue: Number(report.data?.kpis.collected_revenue ?? 0),
    aov: Number(report.data?.kpis.average_order_value ?? 0),
    count: Object.values(report.data?.order_status ?? {}).reduce((sum, count) => sum + count, 0),
  };
  const chart = useMemo(() => (report.data?.daily ?? []).map(point => ({
    date: point.date,
    label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(
      locale === "ar" ? "ar-MA-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US",
      { weekday: "short", timeZone: "UTC" },
    ),
    amount: Number(point.revenue),
    count: point.orders,
  })), [report.data, locale]);
  const chartOption = useMemo<PlatformChartOption>(() => {
    const muted = theme === "dark" ? "#8eaa98" : "#64748b";
    const grid = theme === "dark" ? "#203b2a" : "#e8edf2";
    const brand = theme === "dark" ? "#467d5c" : "#3f7657";
    const zoomVisible = range > 14;
    return {
      animationDuration: 360,
      aria: { enabled: true },
      grid: { left: 52, right: 18, top: 22, bottom: zoomVisible ? 54 : 30 },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        valueFormatter: (value: unknown) => fmtMoney(Number(value) || 0, currency, locale),
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
        { type: "inside", start: 0, end: 100, zoomOnMouseWheel: false },
        { type: "slider", start: 0, end: 100, height: 14, bottom: 8, showDetail: false, brushSelect: false },
      ] : [],
      series: [{
        name: t(locale, "overview.revenue"),
        type: "bar",
        data: chart.map((point) => point.amount),
        barMaxWidth: 38,
        itemStyle: { color: brand, borderRadius: [6, 6, 2, 2] },
        emphasis: { itemStyle: { color: theme === "dark" ? "#5f9c76" : "#315f46" } },
      }],
    };
  }, [chart, currency, locale, range, theme]);
  const recent = data.slice(0, 8);
  if (loadingAll) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="d-title">{t(locale, "overview.title")}</h1>
            <p className="d-subtitle">{t(locale, "overview.subtitle", store?.name ?? t(locale, "nav.dashboard"))}.</p>
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
      <div className="grid overview-bottom" style={{ marginBottom: 16 }}>
          <div className="card"><div style={{ padding: 20 }}><Skeleton style={{ height: 240 }} /></div></div>
          <div className="card"><div style={{ padding: 20 }}><Skeleton style={{ height: 240 }} /></div></div>
        </div>
      </div>
    );
  }

  if (report.error || orders.error || !report.data) {
    return <EmptyState icon={<FiDollarSign />} title={t(locale, "overview.loadError")}
      action={<button className="btn btn-secondary" onClick={() => { report.reload(); orders.reload(); }}>{t(locale, "errors.tryAgain")}</button>} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "overview.title")}</h1>
          <p className="d-subtitle">{t(locale, "overview.subtitle", store?.name ?? t(locale, "nav.dashboard"))}.</p>
        </div>
        <div className="page-head-actions">
          <div className="range-tabs">
            {([7, 30] as const).map((d) => (
              <button key={d} className={`range-tab${range === d ? " active" : ""}`} onClick={() => setRange(d)}>
                {t(locale, "overview.days", d)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="metric">
          <span className="metric-icon" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
            <FiDollarSign />
          </span>
          <span className="metric-label">{t(locale, "overview.revenue")}</span>
          <span className="metric-value">{fmtMoney(totals.revenue, currency, locale)}</span>
          <span className="metric-delta up"><FiArrowUpRight /> {t(locale, "overview.confirmedOnly")}</span>
        </div>
        <div className="metric">
          <span className="metric-icon" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
            <FiShoppingCart />
          </span>
          <span className="metric-label">{t(locale, "overview.orders")}</span>
          <span className="metric-value">{totals.count}</span>
          <span className="metric-delta up">{t(locale, "overview.pending", report.data.order_status.pending)}</span>
        </div>
        <div className="metric">
          <span className="metric-icon" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            <FiUsers />
          </span>
          <span className="metric-label">{t(locale, "overview.customers")}</span>
          <span className="metric-value">{report.data.kpis.customers}</span>
          <span className="metric-delta up"><FiArrowUpRight /> {t(locale, "overview.lifetime")}</span>
        </div>
        <div className="metric">
          <span className="metric-icon" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
            <FiShoppingBag />
          </span>
          <span className="metric-label">{t(locale, "overview.avgOrderValue")}</span>
          <span className="metric-value">{fmtMoney(totals.aov, currency, locale)}</span>
          <span className="metric-delta">{t(locale, "overview.outOfStock", report.data.kpis.out_of_stock_products)}</span>
        </div>
      </div>

      <div className="grid overview-bottom" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="d-card-head">
            <span className="d-card-title">{t(locale, "overview.sales", range)}</span>
            <span className="d-eyebrow">{t(locale, "overview.perDay")}</span>
          </div>
          {orders.loading ? (
            <div style={{ padding: 20 }}><Skeleton style={{ height: 200 }} /></div>
          ) : chart.every((c) => c.amount === 0) ? (
            <EmptyState icon={<FiDollarSign />} title={t(locale, "overview.noSales")} sub={t(locale, "overview.noSalesSub")} />
          ) : (
            <PlatformChart
              className="chart"
              option={chartOption}
              label={t(locale, "overview.sales", range)}
              expandLabel={t(locale, "theme.expandChart")}
              closeLabel={t(locale, "theme.closeChart")}
            />
          )}
        </div>

        <div className="card">
          <div className="d-card-head">
            <span className="d-card-title">{t(locale, "overview.recentOrders")}</span>
          </div>
          {orders.loading ? (
            <div style={{ padding: 20 }}><Skeleton style={{ height: 200 }} /></div>
          ) : recent.length === 0 ? (
            <EmptyState icon={<FiShoppingCart />} title={t(locale, "overview.noOrders")} />
          ) : (
            recent.map((o) => (
              <div className="recent-order" key={o.order_id}>
                <div className="avatar">{(o.customer_name || "?")[0] || "?"}</div>
                <div className="who">
                  <b>{o.customer_name || t(locale, "orders.guest")}</b>
                  <span>{timeAgo(o.created_at, locale)} · {o.customer_city || "—"}</span>
                </div>
                <span className={`badge ${statusOf(o, locale).cls}`}>{statusOf(o, locale).label}</span>
                <span className="tnum" style={{ fontWeight: 600, fontSize: 13.5 }}>{fmtMoney(o.amount, o.currency, locale)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
