import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { platform, type Design, type DeployRequest, type Store } from "../api/platform";
import { useLocale } from "../i18n";
import { useAsync } from "../hooks/useAsync";
import { featureLabel, getAccent, isCurrentDesignKey } from "../lib/designs";
import { friendlyApiError } from "../lib/errors";
import {
  DEPLOY_POLL_INTERVAL_MS,
  DEPLOY_POLL_MAX_ATTEMPTS,
  deploymentPipelineIndex,
  isDeploymentLive,
} from "../lib/deploymentState";

const DEPLOY_PIPELINE = [
  { key: "identity", match: "Downloading design-stock" },
  { key: "style", match: "Scaffolded apps/" },
  { key: "catalog", match: "Pushed apps/" },
  { key: "address", match: ["Created DNS record", "Attached domain"] },
  { key: "finishing", match: "Triggered production deployment" },
  { key: "done", match: "Public URL:" },
];

function pipelineIndex(log: string): number {
  for (let i = DEPLOY_PIPELINE.length - 1; i >= 0; i--) {
    const step = DEPLOY_PIPELINE[i];
    const matches = Array.isArray(step.match)
      ? step.match.some((match) => log.includes(match))
      : log.includes(step.match);
    if (matches) return i;
  }
  return -1;
}

export default function RedesignModal({
  store,
  initialDesign,
  onClose,
}: {
  store: Store;
  initialDesign?: string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { data: designs, loading: designsLoading, error: designsError, refresh: refreshDesigns } = useAsync<Design[]>(
    () => platform.listDesigns(),
    [],
  );

  const initialDesignKey = initialDesign && isCurrentDesignKey(initialDesign) ? initialDesign : "basic";
  const [designKey, setDesignKey] = useState<string>(initialDesignKey);
  const readyDesigns = useMemo(() => designs?.filter((design) => design.status === "ready") ?? [], [designs]);
  const selectedDesignAvailable = readyDesigns.some((design) => design.key === designKey);
  useEffect(() => {
    if (designs && !selectedDesignAvailable) {
      const fallback = readyDesigns[0]?.key ?? "";
      setDesignKey(fallback);
      setColor(getAccent(fallback));
    }
  }, [designs, readyDesigns, selectedDesignAvailable]);
  const [color, setColor] = useState(() => getAccent(initialDesignKey));
  const [busy, setBusy] = useState(false);
  const [deployReq, setDeployReq] = useState<DeployRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollAttempts = useRef(0);

  const handleDeploy = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDeployReq(null);
    pollAttempts.current = 0;
    try {
      const req = await platform.createDeployRequest({
        store: store.id,
        design: designKey,
        config: {
          store_name: store.name,
          brand_color: color,
        },
      });
      const started = await platform.scaffoldRequest(req.id);
      setDeployReq(started);
    } catch (err) {
      setError(friendlyApiError(err, t, "wizard.err.generic"));
      setBusy(false);
    }
  }, [store, designKey, color, t]);

  // Poll deploy status
  useEffect(() => {
    if (!deployReq) return;
    if (deployReq.status === "failed" || deployReq.deploy_status === "failed") {
      setBusy(false);
      return;
    }
    if (isDeploymentLive(deployReq)) {
      setBusy(false);
      return;
    }
    if (pollAttempts.current >= DEPLOY_POLL_MAX_ATTEMPTS) {
      setError(t("deploy.timeout"));
      setBusy(false);
      return;
    }
    const timer = setTimeout(async () => {
      pollAttempts.current += 1;
      try {
        const updated = await platform.getRequest(deployReq.id);
        setDeployReq(updated);
      } catch (err) {
        if (pollAttempts.current >= 3) setError(friendlyApiError(err, t, "deploy.connection"));
      }
    }, DEPLOY_POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [deployReq, t]);

  const deployFailed = deployReq?.status === "failed" || deployReq?.deploy_status === "failed";

  return (
    <AnimatePresence>
      <motion.div
        className="sr-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="sr-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sr-modal-header">
            <h2>{t("redesign.title")}</h2>
            <button className="sr-modal-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div className="sr-modal-body">
            {!deployReq ? (
              <>
                {designsLoading ? (
                  <div className="sr-skeleton" style={{ height: 200, borderRadius: 12 }} />
                ) : designsError ? (
                  <div className="sr-auth-error" role="alert">
                    <p>{t("error.service")}</p>
                    <button type="button" className="sr-btn sr-btn-ghost sr-btn-sm" onClick={refreshDesigns}>
                      {t("preview.retry")}
                    </button>
                  </div>
                ) : (
                  <div className="sr-redesign-designs">
                    {readyDesigns.map((d) => {
                      const locked = d.tier === "premium" && store.plan !== "premium";
                      return (
                      <motion.button
                        key={d.key}
                        type="button"
                        className={`sr-design-card${designKey === d.key ? " selected" : ""}${d.tier === "premium" ? " premium" : ""}${locked ? " locked" : ""}`}
                        onClick={() => {
                          if (locked) {
                            localStorage.setItem("showroom-pending-design", d.key);
                            localStorage.setItem("showroom-pending-store", String(store.id));
                            onClose();
                            navigate(`/membership?design=${encodeURIComponent(d.key)}&store=${store.id}`);
                          } else {
                            setDesignKey(d.key);
                            setColor(getAccent(d.key));
                          }
                        }}
                        aria-disabled={locked}
                        whileHover={locked ? undefined : { y: -2 }}
                        whileTap={locked ? undefined : { scale: 0.97 }}
                      >
                        {designKey === d.key && (
                          <div className="sr-retail-check">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          </div>
                        )}
                        {d.tier === "premium" && <div className="sr-design-badge">{locked ? t("wizard.premiumLocked") : t("wizard.designPremium")}</div>}
                        <div className="sr-design-name">{d.name}</div>
                        <div className="sr-design-tagline">{d.tagline}</div>
                        {d.tier === "premium" && d.features && (
                          <div className="sr-design-features">
                            {d.features.slice(0, 2).map((feature) => (
                              <span key={feature} className="sr-design-feature-tag">{featureLabel(feature)}</span>
                            ))}
                          </div>
                        )}
                      </motion.button>
                    );})}
                  </div>
                )}

                <div className="sr-redesign-color">
                  <label>{t("redesign.brandColor")}</label>
                  <div className="sr-color-row">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="sr-color-input"
                    />
                    <span className="sr-color-value">{color}</span>
                  </div>
                </div>

                {error && <div className="sr-auth-error">{error}</div>}
              </>
            ) : (
              <div className="sr-redesign-deploy">
                <p className="sr-redesign-deploy-title">{t("redesign.deploying")}</p>
                <DeployTimeline req={deployReq} t={t} />
                {deployFailed && (
                  <div className="sr-deploy-error" role="alert">
                    <p>{t("deploy.failed")}</p>
                  </div>
                )}
                {isDeploymentLive(deployReq) && deployReq.deployed_url && (
                  <motion.a
                    href={deployReq.deployed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="sr-btn sr-btn-primary sr-btn-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {t("redesign.openStore")}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="m15 3 6 6-6 6"/></svg>
                  </motion.a>
                )}
              </div>
            )}
          </div>

          {(!deployReq || deployFailed) && (
            <div className="sr-modal-footer">
              <button className="sr-btn sr-btn-ghost" onClick={onClose}>
                {t("redesign.cancel")}
              </button>
              <button
                className="sr-btn sr-btn-primary"
                onClick={handleDeploy}
                disabled={busy || !selectedDesignAvailable || designsLoading || Boolean(designsError)}
              >
                {busy ? t("redesign.starting") : deployFailed ? t("preview.retry") : t("redesign.deploy")}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DeployTimeline({ req, t }: { req: DeployRequest; t: (k: string) => string }) {
  const log = req.log || "";
  const isFailed = req.status === "failed" || req.deploy_status === "failed";

  const activeIndex = useMemo(
    () => Math.max(pipelineIndex(log), deploymentPipelineIndex(req.pipeline_state)),
    [log, req.pipeline_state],
  );

  return (
    <div className="sr-deploy-timeline">
      {DEPLOY_PIPELINE.map((step, i) => {
        let state: "done" | "active" | "pending" | "failed" = "pending";
        if (isFailed && i === activeIndex + 1) state = "failed";
        else if (i <= activeIndex) state = "done";
        else if (i === activeIndex + 1) state = "active";

        return (
          <motion.div
            key={step.key}
            className={`sr-deploy-step ${state}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            <div className="sr-deploy-step-icon">
              {state === "done" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : state === "active" ? (
                <span className="sr-deploy-spinner" />
              ) : state === "failed" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              ) : (
                <span className="sr-deploy-pending-dot" />
              )}
            </div>
            <div className="sr-deploy-step-content">
              <span className="sr-deploy-step-label">{t(`deploy.step.${step.key}`)}</span>
              {state === "active" && (
                <motion.span
                  className="sr-deploy-step-dots"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  ...
                </motion.span>
              )}
            </div>
            {i < DEPLOY_PIPELINE.length - 1 && <div className={`sr-deploy-step-line ${i <= activeIndex ? "filled" : ""}`} />}
          </motion.div>
        );
      })}
    </div>
  );
}
