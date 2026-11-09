import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiCheck, FiDatabase, FiRefreshCw, FiServer, FiShield } from "react-icons/fi";
import { adminApi, type SystemHealth } from "../api";
import { ErrorState, Loading, PageHeader, formatDate, number } from "../components/Ui";
import { useI18n } from "../i18n";

export function SystemPage() {
  const { locale, tr } = useI18n();
  const [data, setData] = useState<SystemHealth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true); setError(""); adminApi.system().then(setData).catch(() => setError(tr("common.unavailableDetail"))).finally(() => setLoading(false));
  }, [tr]);
  useEffect(load, [load]);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} retry={load} />;
  if (!data) return null;
  const services = Object.entries(data.providers);
  const serviceStates = services.map(([, configured]) => configured);
  const readyServices = serviceStates.filter(Boolean).length;
  return <>
    <PageHeader eyebrow={tr("system.eyebrow")} title={tr("nav.system")} detail={tr("system.detail", { date: formatDate(data.generated_at, true, locale) })} actions={<button className="button secondary" disabled={loading} onClick={() => load()}><FiRefreshCw className={loading ? "spin" : ""} /> {tr("system.recheck")}</button>} />
    <section className={`health-hero${data.status === "healthy" ? "" : " attention"}`}><span>{data.status === "healthy" ? <FiCheck /> : <FiAlertTriangle />}</span><div><strong>{tr(data.status === "healthy" ? "system.responding" : "system.attention")}</strong><p>{tr(data.status === "healthy" ? "system.databaseHealthy" : "system.attentionDetail", { count: data.attention_count })}</p></div><b>{tr(data.status === "healthy" ? "system.available" : "system.review")}</b></section>
    <section className="health-grid">
      <HealthPanel icon={<FiServer />} title={tr("system.providers")}>
        <HealthRow label={tr("system.connectedServices")} value={tr("system.servicesReady", { ready: readyServices, total: serviceStates.length })} ok={readyServices === serviceStates.length} />
        {services.map(([provider, configured]) => <HealthRow
          key={provider}
          label={tr(`system.provider.${provider}`, {}, provider.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()))}
          value={tr(configured ? "system.configured" : "system.missing")}
          ok={configured}
        />)}
      </HealthPanel>
      <HealthPanel icon={<FiDatabase />} title={tr("system.catalog")}>
        <HealthRow label={tr("system.products")} value={number(data.catalog.products, locale)} ok />
        <HealthRow label={tr("system.variants")} value={number(data.catalog.variants, locale)} ok />
        <HealthRow label={tr("system.noVariants")} value={number(data.catalog.active_without_variants, locale)} ok={!data.catalog.active_without_variants} />
        <HealthRow label={tr("system.outOfStock")} value={number(data.catalog.out_of_stock_variants, locale)} ok={!data.catalog.out_of_stock_variants} />
      </HealthPanel>
      <HealthPanel icon={<FiShield />} title={tr("system.queues")}>
        <HealthRow label={tr("system.stockExceptions")} value={number(data.operations.untreated_stock_exceptions, locale)} ok={!data.operations.untreated_stock_exceptions} />
        <HealthRow label={tr("system.failedDeployments")} value={number(data.operations.failed_deployments, locale)} ok={!data.operations.failed_deployments} />
        <HealthRow label={tr("system.stalledDeployments")} value={number(data.operations.stalled_deployments, locale)} ok={!data.operations.stalled_deployments} />
        <HealthRow label={tr("system.failedCampaigns")} value={number(data.operations.failed_campaigns, locale)} ok={!data.operations.failed_campaigns} />
        <HealthRow label={tr("system.activeSubscribers")} value={number(data.operations.active_subscribers, locale)} ok />
      </HealthPanel>
    </section>
  </>;
}

function HealthPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <article className="panel health-panel"><div className="panel-head"><div className="health-title"><span>{icon}</span><h2>{title}</h2></div></div><div>{children}</div></article>;
}
function HealthRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="health-row"><span>{label}</span><strong className={ok ? "ok" : "warn"}><i />{value}</strong></div>;
}
