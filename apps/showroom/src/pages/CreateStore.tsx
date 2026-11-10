import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ApiError, platform, type RetailType, type Design, type DeployRequest, type SubscriptionStatus } from "../api/platform";
import { useLocale, retailLabel } from "../i18n";
import { useAsync } from "../hooks/useAsync";
import { PageTransition, fadeUp } from "../components/PageTransition";
import { featureLabel, getAccent } from "../lib/designs";
import { ContentLoader } from "../components/ContentLoader";
import { friendlyApiError } from "../lib/errors";
import { RetailIcon } from "../components/ShowroomIcons";
import {
  DEPLOY_POLL_INTERVAL_MS,
  DEPLOY_POLL_MAX_ATTEMPTS,
  DEPLOY_STREAM_STALE_TIMEOUT_MS,
  deploymentProgressPath,
  deploymentStartingPath,
  deploymentPipelineIndex,
  deploymentRequestId,
  isDeploymentLive,
  isDeploymentTerminal,
} from "../lib/deploymentState";

const CURRENCIES = ["MAD", "USD", "EUR", "GBP", "AED"];
const STOREFRONT_BASE_DOMAIN = (import.meta.env.VITE_STOREFRONT_BASE_DOMAIN as string | undefined)?.trim() || "tijarago.com";
const VALID_STORE_SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
type AddressAvailability = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

const STEPS = ["wizard.details", "wizard.designReview"] as const;

const DEPLOY_PIPELINE = [
  { key: "identity", match: "Downloading design-stock", icon: "01" },
  { key: "style", match: "Scaffolded apps/", icon: "02" },
  { key: "catalog", match: "Pushed apps/", icon: "03" },
  { key: "address", match: ["Created DNS record", "Attached domain"], icon: "04" },
  { key: "finishing", match: "Triggered production deployment", icon: "05" },
  { key: "verifying", match: "Public URL:", icon: "06" },
];

function slugify(name: string) {
  const readable = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  if (readable) return readable;
  if (!name.trim()) return "";
  const fingerprint = Array.from(name.trim()).reduce(
    (value, character) => ((value * 31) + (character.codePointAt(0) ?? 0)) >>> 0,
    2166136261,
  );
  return `shop-${fingerprint.toString(36)}`;
}

function pipelineIndex(log: string, state?: DeployRequest["pipeline_state"]): number {
  const stateIndex = deploymentPipelineIndex(state);
  if (stateIndex >= 0) return stateIndex;
  for (let i = DEPLOY_PIPELINE.length - 1; i >= 0; i--) {
    const step = DEPLOY_PIPELINE[i];
    const matches = Array.isArray(step.match)
      ? step.match.some((match) => log.includes(match))
      : log.includes(step.match);
    if (matches) return i;
  }
  return -1;
}

function DesignCard({
  design,
  selected,
  locked,
  onClick,
}: {
  design: Design;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const { t } = useLocale();
  const isPremium = design.tier === "premium";
  return (
    <motion.button
      type="button"
      className={`sr-design-card${selected ? " selected" : ""}${isPremium ? " premium" : ""}${locked ? " locked" : ""}`}
      onClick={onClick}
      aria-disabled={locked}
      aria-pressed={selected}
      whileHover={locked ? undefined : { y: -4 }}
      whileTap={locked ? undefined : { scale: 0.97 }}
    >
      {selected && (
        <div className="sr-retail-check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
      )}
      {isPremium && <div className="sr-design-badge">{locked ? t("wizard.premiumLocked") : t("wizard.designPremium")}</div>}
      <div className="sr-design-name">{design.name}</div>
      <div className="sr-design-tagline">{design.tagline}</div>
      <p className="sr-design-desc">{design.description}</p>
      {design.features && design.features.length > 0 && (
        <div className="sr-design-features">
          {design.features.slice(0, 4).map((f) => (
            <span key={f} className="sr-design-feature-tag">{featureLabel(f)}</span>
          ))}
          {design.features.length > 4 && (
            <span className="sr-design-feature-tag more">+{design.features.length - 4}</span>
          )}
        </div>
      )}
    </motion.button>
  );
}

function DeployTimeline({ req, t }: { req: DeployRequest; t: (k: string) => string }) {
  const log = req.log || "";
  const isFailed = req.status === "failed" || req.deploy_status === "failed" || req.pipeline_state === "failed";

  const activeIndex = useMemo(() => pipelineIndex(log, req.pipeline_state), [log, req.pipeline_state]);

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

export default function CreateStore() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { requestId: routeRequestId, storeSlug: routeStoreSlug } = useParams<{
    requestId?: string;
    storeSlug?: string;
  }>();
  const [searchParams] = useSearchParams();
  const startingStoreSlug = routeStoreSlug && VALID_STORE_SLUG.test(routeStoreSlug)
    ? routeStoreSlug
    : null;
  const resumeRequestId = deploymentRequestId(
    routeRequestId,
    searchParams.get("request_id"),
    sessionStorage.getItem("showroom-active-deployment"),
  );

  const { data: retailTypes, loading: typesLoading, error: typesError, refresh: refreshTypes } = useAsync<RetailType[]>(
    () => platform.listRetailTypes(),
    [],
  );

  const { data: designs, loading: designsLoading, error: designsError, refresh: refreshDesigns } = useAsync<Design[]>(
    () => platform.listDesigns(),
    [],
  );

  const { data: subscription, loading: subscriptionLoading, error: subscriptionError, refresh: refreshSubscription } = useAsync<SubscriptionStatus>(
    () => platform.subscriptionStatus(),
    [],
  );

  const [step, setStep] = useState(0);
  const [retailTypeId, setRetailTypeId] = useState<number | null>(null);
  const [designKey, setDesignKey] = useState<string | null>("basic");
  const readyDesigns = useMemo(() => designs?.filter((design) => design.status === "ready") ?? [], [designs]);
  const [name, setName] = useState("");
  const storeNameInputRef = useRef<HTMLInputElement>(null);
  const focusStoreNameAfterConflictRef = useRef(false);
  const [addressAvailability, setAddressAvailability] = useState<AddressAvailability>("idle");
  const addressCheckRef = useRef(0);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  // A newly-created storefront should begin with the identity of the design
  // the merchant selected. The color remains editable after creation.
  const color = getAccent(designKey ?? "basic");
  const [currency, setCurrency] = useState("MAD");
  const [busy, setBusy] = useState(resumeRequestId !== null || startingStoreSlug !== null);
  const [error, setError] = useState("");
  const [storeLimitReached, setStoreLimitReached] = useState(false);
  const [brandingWarning, setBrandingWarning] = useState("");

  const [deployReq, setDeployReq] = useState<DeployRequest | null>(null);
  const [deployDone, setDeployDone] = useState(false);
  const [pollError, setPollError] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<number | null>(resumeRequestId);
  const [retryingDeploy, setRetryingDeploy] = useState(false);
  const [showDeployDetails, setShowDeployDetails] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const streamFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  const autoSlug = useMemo(() => slugify(name), [name]);
  const slug = autoSlug;
  const selectedType = retailTypes?.find((rt) => rt.id === retailTypeId) ?? null;
  const selectedDesign = designs?.find((d) => d.key === designKey) ?? null;
  const hasAccountPremium = subscription?.subscriptions.some(
    (entry) => entry.status === "active" && entry.plan?.grants_premium_designs && entry.plan.entitlement_scope === "all_owned_stores",
  ) ?? false;
  const detailsValid = name.trim().length >= 2 && slug.length >= 2 && VALID_STORE_SLUG.test(slug)
    && ["available", "error"].includes(addressAvailability);
  const canNext = detailsValid && (step === 0 || Boolean(selectedDesign?.status === "ready"
    && (selectedDesign.tier !== "premium" || hasAccountPremium)));


  useEffect(() => {
    const checkId = ++addressCheckRef.current;
    if (!slug) {
      setAddressAvailability("idle");
      return;
    }
    if (slug.length < 2 || !VALID_STORE_SLUG.test(slug)) {
      setAddressAvailability("invalid");
      return;
    }
    setAddressAvailability("checking");
    const timer = setTimeout(() => {
      void platform.storeAddressAvailability(slug).then((result) => {
        if (addressCheckRef.current !== checkId) return;
        setAddressAvailability(result.available ? "available" : result.reason === "taken" ? "taken" : "invalid");
      }).catch(() => {
        if (addressCheckRef.current === checkId) setAddressAvailability("error");
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [slug]);

  useEffect(() => {
    if (step !== 0 || !focusStoreNameAfterConflictRef.current) return;
    focusStoreNameAfterConflictRef.current = false;
    storeNameInputRef.current?.focus();
  }, [step]);

  const pollDeploy = useCallback((requestId: number) => {
    streamRef.current?.close();
    streamRef.current = null;
    if (streamFallbackRef.current) clearTimeout(streamFallbackRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    pollAttemptsRef.current = 0;
    setActiveRequestId(requestId);
    setPollError("");
    let inFlight = false;
    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      let finished = false;
      pollAttemptsRef.current += 1;
      try {
        const data = await platform.getRequest(requestId);
        setDeployReq(data);
        if (isDeploymentTerminal(data)) {
          finished = true;
          if (pollRef.current) clearInterval(pollRef.current);
          setDeployDone(true);
          sessionStorage.removeItem("showroom-active-deployment");
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          finished = true;
          sessionStorage.removeItem("showroom-active-deployment");
          if (pollRef.current) clearInterval(pollRef.current);
          setBusy(true);
          setPollError(t("deploy.connection"));
          return;
        }
        if (pollAttemptsRef.current >= 3) setPollError(friendlyApiError(err, t, "deploy.connection"));
      } finally {
        inFlight = false;
        if (pollAttemptsRef.current >= DEPLOY_POLL_MAX_ATTEMPTS && !finished) {
          if (pollRef.current) clearInterval(pollRef.current);
          setDeployDone(true);
          setPollError(t("deploy.timeout"));
        }
      }
    };
    void check();
    pollRef.current = setInterval(() => { void check(); }, DEPLOY_POLL_INTERVAL_MS);
  }, [t]);

  const monitorDeploy = useCallback((requestId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    streamRef.current?.close();
    if (streamFallbackRef.current) clearTimeout(streamFallbackRef.current);
    setActiveRequestId(requestId);
    setBusy(true);
    setPollError("");
    sessionStorage.setItem("showroom-active-deployment", String(requestId));
    navigate(deploymentProgressPath(requestId), { replace: true });

    if (typeof EventSource === "undefined") {
      pollDeploy(requestId);
      return;
    }

    const source = new EventSource(platform.requestEventsUrl(requestId), { withCredentials: true });
    streamRef.current = source;
    let fallbackStarted = false;
    const startPollingFallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      source.close();
      if (streamRef.current === source) streamRef.current = null;
      if (streamFallbackRef.current) clearTimeout(streamFallbackRef.current);
      pollDeploy(requestId);
    };
    const armStreamWatchdog = () => {
      if (streamFallbackRef.current) clearTimeout(streamFallbackRef.current);
      streamFallbackRef.current = setTimeout(startPollingFallback, DEPLOY_STREAM_STALE_TIMEOUT_MS);
    };
    armStreamWatchdog();

    source.addEventListener("deployment.updated", (event) => {
      armStreamWatchdog();
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { request: DeployRequest };
        const deployment = payload.request;
        setDeployReq(deployment);
        if (isDeploymentTerminal(deployment)) {
          fallbackStarted = true;
          source.close();
          streamRef.current = null;
          if (streamFallbackRef.current) clearTimeout(streamFallbackRef.current);
          setDeployDone(true);
          sessionStorage.removeItem("showroom-active-deployment");
        }
      } catch {
        startPollingFallback();
      }
    });
    source.onerror = startPollingFallback;
  }, [navigate, pollDeploy]);

  const monitorDeployRef = useRef(monitorDeploy);
  monitorDeployRef.current = monitorDeploy;

  useEffect(() => {
    if (!startingStoreSlug || resumeRequestId) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const recoverCreation = async () => {
      attempts += 1;
      try {
        const stores = await platform.listStores();
        if (cancelled) return;
        const store = stores.find((candidate) => candidate.slug === startingStoreSlug);
        if (store?.storefront_request_id) {
          let deployment = await platform.getRequest(store.storefront_request_id);
          if (cancelled) return;
          if (
            deployment.status === "pending"
            && deployment.deploy_status === "not_deployed"
          ) {
            deployment = await platform.scaffoldRequest(store.storefront_request_id);
            if (cancelled) return;
          }
          setDeployReq(deployment);
          sessionStorage.removeItem("showroom-pending-store-creation");
          monitorDeployRef.current(store.storefront_request_id);
          return;
        }
      } catch (recoveryError) {
        if (cancelled) return;
        if (recoveryError instanceof ApiError && (recoveryError.status === 401 || recoveryError.status === 403)) {
          setDeployDone(true);
          setPollError(t("deploy.connection"));
          return;
        }
      }

      if (attempts >= 20) {
        sessionStorage.removeItem("showroom-pending-store-creation");
        setDeployDone(true);
        setPollError(t("deploy.connection"));
        return;
      }
      retryTimer = setTimeout(() => { void recoverCreation(); }, 1_500);
    };

    setBusy(true);
    void recoverCreation();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [resumeRequestId, startingStoreSlug, t]);

  useEffect(() => {
    if (!logo) {
      setLogoPreview("");
      return;
    }
    const preview = URL.createObjectURL(logo);
    setLogoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [logo]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (streamFallbackRef.current) clearTimeout(streamFallbackRef.current);
      streamRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (deployReq?.status === "failed" || deployReq?.deploy_status === "failed") {
      setShowDeployDetails(true);
    }
  }, [deployReq?.deploy_status, deployReq?.status]);

  useEffect(() => {
    if (resumeRequestId) monitorDeployRef.current(resumeRequestId);
  }, [resumeRequestId]);

  useEffect(() => {
    if (!designs || subscriptionLoading) return;
    const requested = searchParams.get("design");
    if (!requested) return;
    const design = readyDesigns.find((item) => item.key === requested);
    if (!design) return;
    if (design.tier === "premium" && !hasAccountPremium) {
      localStorage.setItem("showroom-pending-design", design.key);
      navigate(`/membership?design=${encodeURIComponent(design.key)}`, { replace: true });
      return;
    }
    setDesignKey(design.key);
    localStorage.removeItem("showroom-pending-design");
  }, [designs, readyDesigns, hasAccountPremium, navigate, searchParams, subscriptionLoading]);

  const chooseDesign = (design: Design) => {
    if (design.status !== "ready") return;
    if (design.tier === "premium" && !hasAccountPremium) {
      localStorage.setItem("showroom-pending-design", design.key);
      navigate(`/membership?design=${encodeURIComponent(design.key)}`);
      return;
    }
    setDesignKey(design.key);
  };

  const submit = async () => {
    if (busy || !canNext) return;
    const startingPath = deploymentStartingPath(slug);
    setBusy(true);
    setError("");
    setBrandingWarning("");
    setStoreLimitReached(false);
    sessionStorage.removeItem("showroom-active-deployment");
    sessionStorage.setItem("showroom-pending-store-creation", slug);
    window.history.replaceState(window.history.state, "", startingPath);
    try {
      const store = await platform.createStore({
        name: name.trim(),
        slug,
        retail_type: retailTypeId,
        config: {
          brand_color: color,
          currency,
          design: designKey ?? "basic",
        },
      });
      if (logo) {
        try {
          await platform.uploadStoreLogo(store.id, logo);
        } catch {
          setBrandingWarning(t("wizard.logoUploadWarning"));
        }
      }
      if (store.storefront_request_id) {
        const started = await platform.scaffoldRequest(store.storefront_request_id);
        setDeployReq(started);
        sessionStorage.removeItem("showroom-pending-store-creation");
        monitorDeploy(store.storefront_request_id);
      } else {
        setDeployDone(true);
        setPollError(t("deploy.connection"));
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "subscription_required") {
        navigate("/membership", { replace: true });
      } else if (err instanceof ApiError && err.code === "store_limit_reached") {
        setError(t("wizard.err.storeLimit"));
        setStoreLimitReached(true);
      } else if (
        err instanceof ApiError
        && (err.code === "store_address_taken" || err.status === 409)
      ) {
        // A direct 409 belongs to this submission and must remain a visible
        // conflict. Attaching to whichever store already owns the slug makes
        // two concurrent tabs both appear successful. Refresh recovery is a
        // separate route-level flow handled by recoverCreation above.
        setError("");
        setAddressAvailability("taken");
        focusStoreNameAfterConflictRef.current = true;
        setStep(0);
      } else {
        setError(friendlyApiError(err, t, "wizard.err.generic"));
      }
      sessionStorage.removeItem("showroom-pending-store-creation");
      if (window.location.pathname === startingPath) {
        window.history.replaceState(window.history.state, "", "/create");
      }
      setBusy(false);
    }
  };

  const checkLaunchAgain = () => {
    if (!activeRequestId) return;
    setDeployDone(false);
    setPollError("");
    monitorDeploy(activeRequestId);
  };

  const retryLaunch = async () => {
    if (!activeRequestId || retryingDeploy) return;
    setRetryingDeploy(true);
    setDeployDone(false);
    setPollError("");
    try {
      const restarted = await platform.scaffoldRequest(activeRequestId);
      setDeployReq(restarted);
      monitorDeploy(activeRequestId);
    } catch (err) {
      setDeployDone(true);
      setPollError(friendlyApiError(err, t, "wizard.err.generic"));
    } finally {
      setRetryingDeploy(false);
    }
  };

  if (!activeRequestId && (typesLoading || designsLoading || subscriptionLoading)) {
    return <ContentLoader label={t("wizard.loading")} />;
  }

  if (!activeRequestId && subscription?.access.allowed === false) {
    return <Navigate to="/membership" replace />;
  }

  if (!activeRequestId && (designsError || subscriptionError)) {
    return (
      <section className="sr-wizard">
        <div className="sr-container">
          <div className="sr-wizard-panel">
            <div className="sr-auth-error" role="alert">
              {t("error.service")}
            </div>
            <div className="sr-wizard-actions">
              <button type="button" className="sr-btn sr-btn-primary" onClick={() => { refreshTypes(); refreshDesigns(); refreshSubscription(); }}>
                {t("preview.retry")}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const showDeploy = busy && !error;
  const isLive = deployDone && isDeploymentLive(deployReq);
  const deployProgressIndex = pipelineIndex(deployReq?.log || "", deployReq?.pipeline_state);
  const deploymentFailed = deployReq?.status === "failed" || deployReq?.deploy_status === "failed" || deployReq?.pipeline_state === "failed";
  const currentDeployStepIndex = Math.min(
    Math.max(deployProgressIndex + 1, 0),
    DEPLOY_PIPELINE.length - 1,
  );
  const currentDeployStep = DEPLOY_PIPELINE[currentDeployStepIndex];
  const deployProgress = deployReq?.deploy_status === "deployed"
    ? 100
    : Math.max(
        6,
        Math.min(
          deployReq?.progress ?? ((deployProgressIndex + 1) / DEPLOY_PIPELINE.length) * 100,
          95,
        ),
      );
  const deploymentStoreName = deployReq?.name || name || startingStoreSlug || t("deploy.title");

  return (
    <PageTransition>
      <section className="sr-wizard" aria-labelledby="wizard-title">
        <div className="sr-container">
          {!showDeploy ? (
            <>
              <header className="sr-wizard-header">
                <motion.div variants={fadeUp} initial="hidden" animate="show">
                  <div className="sr-wizard-badge">{t("wizard.progress")}</div>
                  <h1 id="wizard-title">{t("wizard.title")}</h1>
                  <p>{t("wizard.subtitle")}</p>
                </motion.div>

                <div className="sr-steps-track">
                  {STEPS.map((label, i) => {
                    const state = i < step ? "done" : i === step ? "active" : "pending";
                    return (
                      <div key={label} className={`sr-step ${state}`}>
                        <div className="sr-step-circle">
                          {state === "done" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          ) : (
                            <span>{i + 1}</span>
                          )}
                        </div>
                        <span className="sr-step-text">{t(label)}</span>
                        {i < STEPS.length - 1 && <div className={`sr-step-line ${i < step ? "filled" : ""}`} />}
                      </div>
                    );
                  })}
                </div>
              </header>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28 }}
                >
                  {error && <div className="sr-auth-error" role="alert">
                    {error}
                    {storeLimitReached && <> <Link to="/membership">{t("wizard.err.explorePlans")}</Link></>}
                  </div>}

                  {/* Screen 1: identity and optional catalog preset */}
                  {step === 0 && (
                    <form className="sr-wizard-panel sr-wizard-form" onSubmit={(e) => { e.preventDefault(); if (canNext) setStep(1); }}>
                      <label className="sr-field">
                        <span>{t("wizard.storeName")}</span>
                        <input
                          ref={storeNameInputRef}
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="TijaraGO Boutique"
                          required
                          autoComplete="off"
                          autoFocus
                          aria-invalid={["taken", "invalid"].includes(addressAvailability)}
                          aria-describedby={slug ? "store-address-feedback" : undefined}
                        />
                        {slug && (
                          <small id="store-address-feedback" className={`sr-field-hint sr-address-hint ${addressAvailability}`}>
                            <span className="sr-address-value">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                              <span>{slug}.{STOREFRONT_BASE_DOMAIN}</span>
                            </span>
                            <span className="sr-address-status" aria-live="polite">
                              {addressAvailability === "checking" && <span className="sr-address-spinner" aria-hidden="true" />}
                              {addressAvailability === "checking" && t("wizard.addressChecking")}
                              {addressAvailability === "available" && t("wizard.addressAvailable")}
                              {addressAvailability === "taken" && t("wizard.addressTaken")}
                              {addressAvailability === "invalid" && t("wizard.addressInvalid")}
                              {addressAvailability === "error" && t("wizard.addressCheckUnavailable")}
                            </span>
                          </small>
                        )}
                      </label>
                      <div className="sr-field">
                        <span>{t("wizard.logo")}</span>
                        <label className="sr-logo-upload">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              if (file && (!LOGO_TYPES.has(file.type) || file.size > MAX_LOGO_SIZE)) {
                                setError(t("wizard.logoInvalid"));
                                event.target.value = "";
                                setLogo(null);
                                return;
                              }
                              setError("");
                              setLogo(file);
                            }}
                          />
                          <span className="sr-logo-upload-preview" style={{ borderColor: color }}>
                            {logoPreview ? <img src={logoPreview} alt="" /> : <RetailIcon type={selectedType?.key} size={26} />}
                          </span>
                          <span>
                            <strong>{logo ? logo.name : t("wizard.logoChoose")}</strong>
                            <small>{t("wizard.logoHint")}</small>
                          </span>
                        </label>
                      </div>
                      <label className="sr-field">
                        <span>{t("wizard.currency")}</span>
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <small className="sr-field-hint">{t("wizard.detailsLater")}</small>
                      </label>
                      <div className="sr-field">
                        <label htmlFor="store-retail-preset">{t("wizard.presetOptional")}</label>
                        <div className="sr-preset-select">
                          <span aria-hidden="true"><RetailIcon type={selectedType?.key} size={24} /></span>
                          <select id="store-retail-preset" value={retailTypeId ?? ""} onChange={(event) => setRetailTypeId(event.target.value ? Number(event.target.value) : null)} aria-describedby="store-retail-preset-hint">
                            <option value="">{t("wizard.presetNone")}</option>
                            {(retailTypes ?? []).map((retail) => <option key={retail.id} value={retail.id}>{retailLabel(retail, t)}</option>)}
                          </select>
                        </div>
                        <small id="store-retail-preset-hint" className="sr-field-hint">{typesError ? t("wizard.retailTypesUnavailable") : selectedType?.description || t("wizard.presetHint")}</small>
                      </div>
                      <div className="sr-wizard-actions">
                        <button type="submit" className="sr-btn sr-btn-primary" disabled={!canNext}>
                          {t("wizard.next")}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Screen 2: design selection and final review */}
                  {step === 1 && (
                    <div className="sr-wizard-panel">
                      <div className="sr-wizard-step-intro">
                        <h2>{t("wizard.designTitle")}</h2>
                        <p>{t("wizard.designDesc")}</p>
                      </div>
                      <div className="sr-design-grid">
                        {readyDesigns.map((d, i) => (
                          <motion.div
                            key={d.key}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                          >
                            <DesignCard
                              design={d}
                              selected={designKey === d.key}
                              locked={d.tier === "premium" && !hasAccountPremium}
                              onClick={() => chooseDesign(d)}
                            />
                          </motion.div>
                        ))}
                      </div>
                      <div className="sr-wizard-step-intro">
                        <h2>{t("wizard.review")}</h2>
                        <p>{t("wizard.reviewDesc")}</p>
                      </div>

                      <div className="sr-review-card">
                        <div className="sr-review-preview" style={{ borderColor: color }}>
                          {logoPreview
                            ? <img className="sr-review-logo" src={logoPreview} alt="" />
                            : <div className="sr-review-icon" style={{ background: color }}><RetailIcon type={selectedType?.key} size={28} /></div>}
                          <div className="sr-review-name">{name || "\u2014"}</div>
                          <div className="sr-review-slug"> @{slug}</div>
                        </div>

                        <dl className="sr-review-details">
                          <div>
                            <dt>{t("wizard.retailType")}</dt>
                            <dd>{selectedType ? retailLabel(selectedType, t) : t("wizard.presetNone")}</dd>
                          </div>
                          <div>
                            <dt>{t("wizard.design")}</dt>
                            <dd>{selectedDesign?.name ?? "\u2014"} {selectedDesign?.tagline ? `\u2014 ${selectedDesign.tagline}` : ""}</dd>
                          </div>
                          <div>
                            <dt>{t("wizard.storeAddress")}</dt>
                            <dd>{slug}.{STOREFRONT_BASE_DOMAIN}</dd>
                          </div>
                          <div>
                            <dt>{t("wizard.currency")}</dt>
                            <dd>{currency}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="sr-wizard-actions">
                        <button type="button" className="sr-btn sr-btn-ghost" onClick={() => setStep(0)} disabled={busy}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                          {t("wizard.back")}
                        </button>
                        <button type="button" className="sr-btn sr-btn-primary sr-btn-lg" onClick={submit} disabled={busy || !canNext}>
                          {t("wizard.create")}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          ) : (
            /* ── Deploy Progress ── */
            <motion.div
              key="deploy"
              className="sr-wizard-panel sr-deploy-panel"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {isLive ? (
                <>
                  <motion.div
                    className="sr-done-icon"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </motion.div>
                  <h2>{t("deploy.doneTitle")}</h2>
                  <p>{t("deploy.doneSubtitle")}</p>

                  <div className="sr-done-preview" style={{ borderColor: color }}>
                    <div className="sr-done-store-icon" style={{ background: color }}>
                      <RetailIcon type={selectedType?.key} size={24} />
                    </div>
                    <strong>{deploymentStoreName}</strong>
                    {deployReq?.deployed_url && (
                      <a href={deployReq.deployed_url} target="_blank" rel="noopener noreferrer" className="sr-done-url">
                        {deployReq.deployed_url}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                      </a>
                    )}
                  </div>

                  <div className="sr-wizard-actions" style={{ justifyContent: "center" }}>
                    {deployReq?.deployed_url && (
                      <a href={deployReq.deployed_url} target="_blank" rel="noopener noreferrer" className="sr-btn sr-btn-ghost sr-btn-lg">
                        {t("wizard.openStore")}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                      </a>
                    )}
                    <Link to="/dashboard" className="sr-btn sr-btn-primary sr-btn-lg">
                      {t("wizard.goDashboard")}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="sr-deploy-header">
                    <div className="sr-deploy-store-badge" style={{ borderColor: color }}>
                      <div className="sr-deploy-store-dot" style={{ background: color }} />
                      <span>{deploymentStoreName}</span>
                    </div>
                    <div className={`sr-deploy-calm-visual${deploymentFailed ? " failed" : ""}`} aria-hidden="true">
                      <span className="sr-deploy-calm-ring sr-deploy-calm-ring-one" />
                      <span className="sr-deploy-calm-ring sr-deploy-calm-ring-two" />
                      <span className="sr-deploy-calm-core">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 10.5 12 4l9 6.5" />
                          <path d="M5 9.5V20h14V9.5" />
                          <path d="M9 20v-6h6v6" />
                        </svg>
                      </span>
                    </div>
                    <h2>{t(deploymentFailed ? "deploy.failed" : "deploy.title")}</h2>
                    <p>{t(deploymentFailed ? "deploy.paused" : "deploy.subtitle")}</p>
                  </div>
                  {brandingWarning && <div className="sr-auth-error" role="status">{brandingWarning}</div>}

                  <div className="sr-deploy-current" role="status" aria-live="polite" aria-atomic="true">
                    <span className="sr-deploy-current-label">{t("deploy.current")}</span>
                    <strong>{deploymentFailed ? t("deploy.failed") : t(`deploy.step.${currentDeployStep.key}`)}</strong>
                    {!deploymentFailed && <span>{t("deploy.steady")}</span>}
                  </div>

                  <div className="sr-deploy-footer">
                    <div className="sr-deploy-progress-copy">{t(deploymentFailed ? "deploy.paused" : "deploy.progressQuiet")}</div>
                    <div
                      className="sr-deploy-progress-bar"
                      role="progressbar"
                      aria-label={t(deploymentFailed ? "deploy.paused" : "deploy.progressQuiet")}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(deployProgress)}
                    >
                      <motion.div
                        className="sr-deploy-progress-fill"
                        animate={{ width: `${deployProgress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {deployReq && (
                    <details
                      className="sr-deploy-details"
                      open={showDeployDetails}
                      onToggle={(event) => setShowDeployDetails(event.currentTarget.open)}
                    >
                      <summary>{t("deploy.details")}</summary>
                      <DeployTimeline req={deployReq} t={t} />
                    </details>
                  )}

                  {deployDone && (pollError || deployReq?.status === "failed" || deployReq?.deploy_status === "failed") && (
                    <div className="sr-deploy-error" role="alert">
                      <p>{pollError || t("deploy.failed")}</p>
                      <div className="sr-wizard-actions">
                        {activeRequestId && deployReq?.pipeline_state === "failed" && (
                          <button type="button" className="sr-btn sr-btn-ghost" onClick={checkLaunchAgain}>
                            {t("deploy.checkAgain")}
                          </button>
                        )}
                        {activeRequestId && (
                          <button type="button" className="sr-btn sr-btn-primary" onClick={() => void retryLaunch()} disabled={retryingDeploy}>
                            {retryingDeploy ? t("redesign.starting") : t("deploy.retry")}
                          </button>
                        )}
                        <Link to="/dashboard" className="sr-btn sr-btn-ghost">
                          {t("wizard.goDashboard")}
                        </Link>
                      </div>
                    </div>
                  )}

                  {!deploymentFailed && (
                    <div className="sr-deploy-reassurance">
                      <div className="sr-deploy-reassurance-icon" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                      <div>
                        <strong>{t("deploy.reassuranceTitle")}</strong>
                        <p>{t("deploy.reassuranceBody")}</p>
                      </div>
                      <Link to="/dashboard" className="sr-deploy-continue">{t("deploy.continue")}</Link>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </div>
      </section>
    </PageTransition>
  );
}
