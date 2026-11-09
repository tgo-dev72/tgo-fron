import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { platform, type Store } from "../api/platform";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { PageTransition } from "../components/PageTransition";
import { useLocale, retailLabel } from "../i18n";
import { merchantDashboardUrl } from "../lib/appLinks";
import { friendlyApiError } from "../lib/errors";
import { IconBolt, IconPalette, IconRocket, IconTag, RetailIcon } from "../components/ShowroomIcons";
import { deploymentProgress, deploymentProgressPath } from "../lib/deploymentState";
import RedesignModal from "./RedesignModal";

const METRIC_ICONS = [
  <svg key="stores" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  <svg key="deployed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
  <svg key="types" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>,
  <svg key="team" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLocale();
  const [redesignTarget, setRedesignTarget] = useState<{ store: Store; initialDesign?: string } | null>(null);
  const [retryingStoreId, setRetryingStoreId] = useState<number | null>(null);
  const [retryError, setRetryError] = useState<{ storeId: number; message: string } | null>(null);

  const { data: stores, loading, error, refresh } = useAsync<Store[]>(() => platform.listStores(), []);
  const [storeSnapshot, setStoreSnapshot] = useState<Store[] | null>(null);

  useEffect(() => {
    if (stores) setStoreSnapshot(stores);
  }, [stores]);

  const hasPreparingStore = storeSnapshot?.some((store) => store.storefront_status === "preparing") ?? false;
  useEffect(() => {
    if (!hasPreparingStore) return;
    let active = true;
    let inFlight = false;
    const updateProgress = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await platform.listStores();
        if (active) setStoreSnapshot(next);
      } catch {
        // Keep the last durable status visible and try again on the next tick.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void updateProgress(), 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasPreparingStore]);

  function openDeployment(store: Store) {
    if (!store.storefront_request_id) return;
    sessionStorage.setItem("showroom-active-deployment", String(store.storefront_request_id));
    navigate(deploymentProgressPath(store.storefront_request_id));
  }

  function startNewStore() {
    sessionStorage.removeItem("showroom-active-deployment");
    navigate("/create");
  }

  async function retryStorefront(store: Store) {
    if (!store.storefront_request_id || retryingStoreId !== null) return;
    setRetryingStoreId(store.id);
    setRetryError(null);
    try {
      const deployment = await platform.scaffoldRequest(store.storefront_request_id);
      sessionStorage.setItem("showroom-active-deployment", String(deployment.id));
      navigate(deploymentProgressPath(deployment.id));
    } catch (retryFailure) {
      setRetryError({
        storeId: store.id,
        message: friendlyApiError(retryFailure, t, "dash.retryError"),
      });
      refresh();
    } finally {
      setRetryingStoreId(null);
    }
  }

  useEffect(() => {
    const storeId = Number(searchParams.get("redesign_store"));
    if (!stores || !storeId || redesignTarget) return;
    const store = stores.find((item) => item.id === storeId);
    if (!store) return;
    const initialDesign = searchParams.get("design") || localStorage.getItem("showroom-pending-design") || undefined;
    setRedesignTarget({ store, initialDesign });
    localStorage.removeItem("showroom-pending-design");
    localStorage.removeItem("showroom-pending-store");
    navigate("/dashboard", { replace: true });
  }, [navigate, redesignTarget, searchParams, stores]);

  if (loading) {
    return (
      <PageTransition>
        <div className="sr-dashboard">
          <div className="sr-dashboard-header">
            <div>
              <div className="sr-skeleton" style={{ height: 32, width: 200, marginBottom: 8 }} />
              <div className="sr-skeleton" style={{ height: 16, width: 320 }} />
            </div>
          </div>
          <div className="sr-metrics-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sr-metric-card">
                <div className="sr-metric-top">
                  <div className="sr-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
                  <div className="sr-skeleton" style={{ height: 12, width: 60 }} />
                </div>
                <div className="sr-skeleton" style={{ height: 32, width: 48, marginTop: 8 }} />
              </div>
            ))}
          </div>
          <div className="sr-stores-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sr-store-card">
                <div className="sr-store-card-top">
                  <div className="sr-skeleton" style={{ width: 48, height: 48, borderRadius: 12 }} />
                  <div style={{ flex: 1 }}>
                    <div className="sr-skeleton" style={{ height: 16, width: "60%", marginBottom: 8 }} />
                    <div className="sr-skeleton" style={{ height: 12, width: "35%" }} />
                  </div>
                </div>
                <div className="sr-skeleton" style={{ height: 1, width: "100%", margin: "12px 0" }} />
                <div style={{ display: "flex", gap: 16 }}>
                  {[0, 1, 2].map((j) => (
                    <div key={j} style={{ flex: 1 }}>
                      <div className="sr-skeleton" style={{ height: 12, width: "100%", marginBottom: 4 }} />
                      <div className="sr-skeleton" style={{ height: 20, width: "40%" }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="sr-dashboard">
          <div className="sr-auth-error" role="alert">
            <span>{t("error.service")}</span>
            <button type="button" className="sr-btn sr-btn-ghost sr-btn-sm" onClick={refresh}>{t("preview.retry")}</button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const unprioritizedStores = storeSnapshot ?? stores ?? [];
  const linkedStoreId = Number(searchParams.get("store"));
  const linkedStore = unprioritizedStores.find((store) => store.id === linkedStoreId);
  const storeList = linkedStore
    ? [linkedStore, ...unprioritizedStores.filter((store) => store.id !== linkedStoreId)]
    : unprioritizedStores;

  return (
    <PageTransition>
      <div className="sr-dashboard">
        <header className="sr-dashboard-header">
          <div>
            <h1>{t("dash.title")}</h1>
            <p>{t("dash.welcome", { name: user?.name ?? "" })}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startNewStore}
            className="sr-btn sr-btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            {t("dash.newStore")}
          </motion.button>
        </header>

        <div className="sr-metrics-grid" aria-live="polite">
          {[
            { label: t("dash.metrics.stores"), value: storeList.length },
            { label: t("dash.metrics.deployed"), value: storeList.filter((s) => s.storefront_status === "live").length },
            { label: t("dash.metrics.retailTypes"), value: new Set(storeList.map((s) => s.retail_type_detail?.key).filter(Boolean)).size },
            { label: t("dash.metrics.members"), value: storeList.reduce((acc, s) => acc + s.members.length, 0) },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              className="sr-metric-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="sr-metric-top">
                <div className="sr-metric-icon">{METRIC_ICONS[i]}</div>
                <span className="sr-metric-label">{m.label}</span>
              </div>
              <strong className="sr-metric-value">{m.value}</strong>
            </motion.div>
          ))}
        </div>

        <section className="sr-dashboard-section" aria-labelledby="stores-title">
          <div className="sr-panel-head">
            <h2 id="stores-title">{t("dash.stores.title")}</h2>
          </div>

          {storeList.length === 0 ? (
            <motion.div
              className="sr-empty-hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="sr-empty-hero-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                  <path d="M3 6h18"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <h2>{t("dash.empty.hero.title")}</h2>
              <p>{t("dash.empty.hero.desc")}</p>

              <div className="sr-empty-features">
                {[
                  { icon: <IconTag />, title: t("dash.empty.f1.title"), desc: t("dash.empty.f1.desc") },
                  { icon: <IconPalette />, title: t("dash.empty.f2.title"), desc: t("dash.empty.f2.desc") },
                  { icon: <IconBolt />, title: t("dash.empty.f3.title"), desc: t("dash.empty.f3.desc") },
                  { icon: <IconRocket />, title: t("dash.empty.f4.title"), desc: t("dash.empty.f4.desc") },
                ].map((f, i) => (
                  <motion.div
                    key={f.title}
                    className="sr-empty-feature"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                  >
                    <span className="sr-empty-feature-icon">{f.icon}</span>
                    <div>
                      <strong>{f.title}</strong>
                      <span>{f.desc}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={startNewStore}
                className="sr-btn sr-btn-primary sr-btn-lg sr-empty-cta"
              >
                {t("dash.empty.createFirst")}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </motion.button>
            </motion.div>
          ) : (
            <div className="sr-stores-grid">
              <AnimatePresence mode="popLayout">
                {storeList.map((store, i) => {
                  const progress = deploymentProgress(store.storefront_progress);
                  const hasProgressView = store.storefront_status !== "live" && Boolean(store.storefront_request_id);
                  return (
                    <motion.article
                      key={store.id}
                      layout
                      className={`sr-store-card${hasProgressView ? " sr-store-card-clickable" : ""}${linkedStoreId === store.id ? " sr-store-card-linked" : ""}`}
                      aria-current={linkedStoreId === store.id ? "true" : undefined}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.22, delay: i * 0.04 }}
                      whileHover={{ y: -2 }}
                    >
                      {hasProgressView && (
                        <button
                          type="button"
                          className="sr-store-card-progress-link"
                          aria-label={`${t("dash.action.viewProgress")}: ${store.name}`}
                          onClick={() => openDeployment(store)}
                        />
                      )}
                      <div className="sr-store-card-top">
                        <div className="sr-store-icon-wrap" style={{ background: store.retail_type_detail ? "var(--sr-primary-soft)" : "var(--sr-bg)" }}>
                          <span className="sr-store-icon"><RetailIcon type={store.retail_type_detail?.key} /></span>
                        </div>
                        <div className="sr-store-card-info">
                          <h3>{store.name}</h3>
                          <div className="sr-store-card-meta">
                            <span className="sr-store-slug">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                              @{store.slug}
                            </span>
                            <span className={`sr-status sr-status-${store.storefront_status}`}>
                              {store.storefront_status === "live"
                                ? t("dash.status.active")
                                : store.storefront_status === "preparing"
                                  ? t("dash.deploy.deploying")
                                  : store.storefront_status === "failed"
                                    ? t("dash.deploy.failed")
                                    : t("dash.deploy.not_deployed")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="sr-store-divider" />

                      {store.storefront_status === "preparing" && (
                        <div className="sr-store-launch-progress" aria-label={t("dash.launchProgress")}>
                          <div><span>{t("dash.launchProgress")}</span><strong>{progress}%</strong></div>
                          <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></span>
                        </div>
                      )}

                      <div className="sr-store-stats">
                        <div className="sr-stat">
                          <span className="sr-stat-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
                          </span>
                          <span className="sr-stat-value">{retailLabel(store.retail_type_detail, t)}</span>
                          <span className="sr-stat-label">{t("dash.retailType")}</span>
                        </div>
                        <div className="sr-stat">
                          <span className="sr-stat-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                          </span>
                          <span className="sr-stat-value">{store.members.length}</span>
                          <span className="sr-stat-label">{t("dash.members")}</span>
                        </div>
                        <div className="sr-stat">
                          <span className="sr-stat-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
                          </span>
                          <span className="sr-stat-value">{new Date(store.created_at).toLocaleDateString()}</span>
                          <span className="sr-stat-label">{t("dash.stat.created")}</span>
                        </div>
                      </div>

                      <div className="sr-store-actions">
                        <a href={merchantDashboardUrl(store.id)} className="sr-btn sr-btn-primary sr-btn-sm">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 2 2 4-4"/></svg>
                          {t("dash.action.manage")}
                        </a>
                        {store.storefront_status === "live" && store.storefront_url && (
                          <a href={store.storefront_url} target="_blank" rel="noreferrer" className="sr-btn sr-btn-ghost sr-btn-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="m15 3 6 6-6 6"/></svg>
                            {t("dash.action.open")}
                          </a>
                        )}
                        {store.storefront_status === "preparing" && store.storefront_request_id && (
                          <button type="button" className="sr-btn sr-btn-ghost sr-btn-sm" onClick={() => openDeployment(store)}>
                            <span className="sr-deploy-spinner" aria-hidden="true" />
                            {t("dash.action.viewProgress")}
                          </button>
                        )}
                        {store.storefront_status === "failed" && store.storefront_request_id && (
                          <button
                            type="button"
                            className="sr-btn sr-btn-primary sr-btn-sm"
                            onClick={() => void retryStorefront(store)}
                            disabled={retryingStoreId !== null}
                            aria-busy={retryingStoreId === store.id}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.2 6.2L4 8"/><path d="M5.5 15A7 7 0 0 0 17.8 17.8L20 16"/></svg>
                            {retryingStoreId === store.id ? t("dash.action.retrying") : t("dash.action.retryLaunch")}
                          </button>
                        )}
                        <button
                          className="sr-btn sr-btn-ghost sr-btn-sm"
                          onClick={() => setRedesignTarget({ store })}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          {t("dash.action.redesign")}
                        </button>
                        {retryError?.storeId === store.id && (
                          <p className="sr-store-retry-error" role="alert">{retryError.message}</p>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>

      {redesignTarget && (
        <RedesignModal store={redesignTarget.store} initialDesign={redesignTarget.initialDesign} onClose={() => setRedesignTarget(null)} />
      )}
    </PageTransition>
  );
}
