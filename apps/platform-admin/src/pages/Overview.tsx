import { useCallback, useEffect, useMemo, useState } from "react";
import { PlatformChart, type PlatformChartOption } from "@platform/charts";
import { Link } from "react-router-dom";
import { FiArrowUpRight, FiCloud, FiCreditCard, FiPackage, FiRefreshCw, FiShoppingBag, FiUsers } from "react-icons/fi";
import { adminApi, type Overview as OverviewData } from "../api";
import { ErrorState, Loading, PageHeader, Status, formatDate, money, number } from "../components/Ui";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export function Overview() {
  const { locale, tr } = useI18n();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback((background = false) => {
    if (!background) setLoading(true);
    setError("");
    adminApi.overview().then(setData).catch(() => setError(tr("common.unavailableDetail"))).finally(() => setLoading(false));
  }, [tr]);
  useEffect(() => { load(); }, [load]);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} retry={load} />;
  if (!data) return null;
  const statusTotal = Object.values(data.order_status).reduce((sum, value) => sum + value, 0) || 1;

  return <>
    <PageHeader eyebrow={tr("overview.eyebrow")} title={tr("nav.controlRoom")} detail={tr("overview.detail", { date: formatDate(data.generated_at, true, locale) })}
      actions={<button className="button secondary" disabled={loading} onClick={() => load()}><FiRefreshCw className={loading ? "spin" : ""} /> {tr("overview.refresh")}</button>} />

    <section className="metric-grid">
      <Metric icon={<FiShoppingBag />} label={tr("nav.stores")} value={number(data.metrics.stores, locale)} note={tr("overview.new30", { count: data.metrics.new_stores_30d })} tone="plum" />
      <Metric icon={<FiUsers />} label={tr("overview.platformUsers")} value={number(data.metrics.users, locale)} note={tr("overview.new30", { count: data.metrics.new_users_30d })} tone="blue" />
      <Metric icon={<FiPackage />} label={tr("nav.orders")} value={number(data.metrics.orders, locale)} note={tr("overview.in30", { count: data.metrics.orders_30d })} tone="violet" />
      <Metric icon={<FiCreditCard />} label={tr("overview.realizedRevenue")} value={money(data.metrics.realized_revenue, "MAD", locale)} note={tr("overview.paymentSuccess", { rate: data.metrics.payment_success_rate })} tone="amber" />
      <Metric icon={<FiCloud />} label={tr("overview.liveStorefronts")} value={number(data.metrics.deployed_storefronts, locale)} note={tr("overview.productsManaged", { count: number(data.metrics.products, locale) })} tone="green" />
    </section>

    <section className="dashboard-grid">
      <article className="panel span-2">
        <div className="panel-head"><div><h2>{tr("overview.commercePulse")}</h2><p>{tr("overview.volume14")}</p></div><strong>{money(data.metrics.gross_volume, "MAD", locale)}</strong></div>
        <CommercePulseChart
          points={data.trend}
          locale={locale}
          label={tr("overview.chartLabel")}
          expandLabel={tr("common.expandChart")}
          closeLabel={tr("common.closeChart")}
        />
      </article>
      <article className="panel">
        <div className="panel-head"><div><h2>{tr("overview.workflow")}</h2><p>{tr("overview.distribution")}</p></div></div>
        <div className="distribution">
          {Object.entries(data.order_status).map(([key, value]) => <div key={key}>
            <span><Status value={key} /><b>{value}</b></span>
            <i><em style={{ width: `${(value / statusTotal) * 100}%` }} /></i>
          </div>)}
          {!Object.keys(data.order_status).length && <p className="muted">{tr("overview.noOrders")}</p>}
        </div>
      </article>
    </section>

    <section className="dashboard-grid lower">
      <article className="panel">
        <div className="panel-head"><div><h2>{tr("overview.attention")}</h2><p>{tr("overview.attentionDetail")}</p></div><span className="count-chip">{data.alerts.length}</span></div>
        <div className="alert-list">
          {data.alerts.map((alert) => <Link to={alert.href} className={`alert ${alert.severity}`} key={alert.key}>
            <span className="alert-count">{alert.count}</span><span><strong>{tr(`alert.${alert.key}.title`, {}, tr("alert.other.title"))}</strong><small>{tr(`alert.${alert.key}.detail`, {}, tr("alert.other.detail"))}</small></span><FiArrowUpRight />
          </Link>)}
          {!data.alerts.length && <div className="all-clear"><i>✓</i><strong>{tr("overview.calm")}</strong><span>{tr("overview.noAlerts")}</span></div>}
        </div>
      </article>
      <article className="panel span-2">
        <div className="panel-head"><div><h2>{tr("overview.latestOrders")}</h2><p>{tr("overview.latestDetail")}</p></div><Link className="text-link" to="/orders">{tr("overview.viewAll")} <FiArrowUpRight /></Link></div>
        <div className="table-scroll"><table><thead><tr><th>{tr("header.order")}</th><th>{tr("header.store")}</th><th>{tr("header.customer")}</th><th>{tr("header.status")}</th><th>{tr("header.amount")}</th></tr></thead>
          <tbody>{data.recent.orders.map((order) => <tr key={order.id}><td className="mono">#{order.order_id.slice(0, 8)}</td><td><strong>{order.store.name}</strong><small>{order.store.slug}</small></td><td>{order.customer_name || order.customer_email || tr("common.guest")}</td><td><Status value={order.status} /></td><td className="amount">{money(order.amount, order.currency, locale)}</td></tr>)}</tbody>
        </table>{!data.recent.orders.length && <div className="empty-row">{tr("overview.noRecordedOrders")}</div>}</div>
      </article>
    </section>
  </>;
}

function CommercePulseChart({
  points,
  locale,
  label,
  expandLabel,
  closeLabel,
}: {
  points: OverviewData["trend"];
  locale: "en" | "fr" | "ar";
  label: string;
  expandLabel: string;
  closeLabel: string;
}) {
  const { theme } = useTheme();
  const option = useMemo<PlatformChartOption>(() => {
    const muted = theme === "dark" ? "#aa9caf" : "#766b7d";
    const grid = theme === "dark" ? "#392a41" : "#e8e0ec";
    const accent = theme === "dark" ? "#c77dff" : "#7b2cba";
    const zoomVisible = points.length > 14;
    const zoomStart = points.length > 30 ? ((points.length - 30) / points.length) * 100 : 0;
    return {
      animationDuration: 360,
      aria: { enabled: true },
      grid: { left: 58, right: 18, top: 18, bottom: zoomVisible ? 52 : 28 },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        valueFormatter: (value: unknown) => money(Number(value) || 0, "MAD", locale),
      },
      xAxis: {
        type: "category",
        data: points.map((point) => formatDate(point.date, false, locale)),
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: muted, hideOverlap: true, interval: "auto", fontSize: 9 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 9 },
        splitLine: { lineStyle: { color: grid, type: "dashed" } },
      },
      dataZoom: zoomVisible ? [
        { type: "inside", start: zoomStart, end: 100, zoomOnMouseWheel: false },
        { type: "slider", start: zoomStart, end: 100, height: 14, bottom: 7, showDetail: false, brushSelect: false },
      ] : [],
      series: [{
        type: "bar",
        data: points.map((point) => point.volume),
        barMaxWidth: 26,
        itemStyle: { color: accent, borderRadius: [5, 5, 1, 1] },
        emphasis: { itemStyle: { color: theme === "dark" ? "#f05dbb" : "#db2b9a" } },
      }],
    };
  }, [locale, points, theme]);

  return <PlatformChart className="chart" option={option} label={label} expandLabel={expandLabel} closeLabel={closeLabel} />;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
