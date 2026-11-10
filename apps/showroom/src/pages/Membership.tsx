import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  platform,
  ApiError,
  type Store,
  type SubscriptionCatalog,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "../api/platform";
import { ContentLoader } from "../components/ContentLoader";
import { BalanceConsentDialog } from "../components/BalanceConsentDialog";
import { GatewayChoiceDialog } from "../components/GatewayChoiceDialog";
import { PaymentProgressDialog, type PaymentProgressStage } from "../components/PaymentProgressDialog";
import { PageTransition, fadeUp } from "../components/PageTransition";
import { useLocale } from "../i18n";
import { friendlyApiError } from "../lib/errors";
import { formatPlanPrice, hasUsedFreePlan, isPlanCurrent, localizedPlanCopy, planBenefits, recommendedPlanId } from "../lib/plans";
import { announceSubscriptionStatusUpdate, paymentReturnSearch, readPaymentReturn } from "../../../shared/paymentReturn";

const PENDING_DESIGN_KEY = "showroom-pending-design";
const PENDING_STORE_KEY = "showroom-pending-store";

export default function Membership() {
  const { t, locale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [catalog, setCatalog] = useState<SubscriptionCatalog | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<number | null>(null);
  const [balancePlan, setBalancePlan] = useState<SubscriptionPlan | null>(null);
  const [gatewayPlan, setGatewayPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedGateway, setSelectedGateway] = useState("");
  const [paymentProgress, setPaymentProgress] = useState<{ stage: PaymentProgressStage; planName: string } | null>(null);
  const [error, setError] = useState("");
  const [resumeCheckout, setResumeCheckout] = useState<{ url: string; retryMinutes: number } | null>(null);
  const checkoutLock = useRef(false);
  const paymentReturn = useRef(readPaymentReturn(window.location.search));

  const requestedDesign = params.get("design") || localStorage.getItem(PENDING_DESIGN_KEY) || "";
  const pendingStoreValue = params.get("store") || localStorage.getItem(PENDING_STORE_KEY) || "";
  const parsedPendingStore = Number(pendingStoreValue);
  const requestedStoreId = Number.isInteger(parsedPendingStore) && parsedPendingStore > 0 ? parsedPendingStore : null;
  const paymentResult = paymentReturn.current.result;
  const paymentId = paymentReturn.current.paymentId;
  const trackedPayment = status?.payment;
  const paymentConfirmed = trackedPayment?.status === "confirmed";
  const paymentDuplicate = trackedPayment?.status === "duplicate";
  const paymentTerminalFailure = Boolean(trackedPayment && ["failed", "canceled"].includes(trackedPayment.status));

  useLayoutEffect(() => {
    if (!paymentReturn.current.isReturn) return;
    if (paymentReturnSearch(location.search) === location.search) return;
    navigate({ pathname: location.pathname, search: paymentReturnSearch(location.search), hash: location.hash }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, paymentId, paymentResult]);

  useEffect(() => {
    const design = params.get("design");
    if (design) localStorage.setItem(PENDING_DESIGN_KEY, design);
    const store = params.get("store");
    if (store && Number(store) > 0) localStorage.setItem(PENDING_STORE_KEY, store);
  }, [params]);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [nextCatalog, nextStatus, nextStores] = await Promise.all([
        platform.listSubscriptionPlans(),
        platform.subscriptionStatus(paymentId),
        platform.listStores(),
      ]);
      setCatalog(nextCatalog);
      setStatus(nextStatus);
      setStores(nextStores);
      setSelectedStore((current) => {
        if (current && nextStores.some((store) => store.id === current)) return current;
        if (requestedStoreId && nextStores.some((store) => store.id === requestedStoreId)) return requestedStoreId;
        return nextStores[0]?.id ?? null;
      });
    } catch (err) {
      setError(friendlyApiError(err, t));
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!paymentId) return;
    setChecking(true);
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const next = await platform.subscriptionStatus(paymentId);
        setStatus(next);
        if ((next.payment && next.payment.status !== "pending") || attempts >= 12) {
          if (next.payment && next.payment.status !== "pending") announceSubscriptionStatusUpdate();
          setChecking(false);
          window.clearInterval(timer);
        }
      } catch {
        if (attempts >= 12) {
          setChecking(false);
          window.clearInterval(timer);
        }
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [paymentId, paymentResult]);

  const continuation = requestedStoreId
    ? `/dashboard?store=${requestedStoreId}${requestedDesign ? `&redesign_store=${requestedStoreId}&design=${encodeURIComponent(requestedDesign)}` : ""}`
    : requestedDesign ? `/create?design=${encodeURIComponent(requestedDesign)}` : "/create";

  const performCheckout = async (plan: SubscriptionPlan, useBalance: boolean, provider = selectedGateway) => {
    if (checkoutLock.current || checkoutPlan || plan.is_free) return;
    if (plan.entitlement_scope === "one_store" && !selectedStore) {
      setError(t("membership.storeRequired"));
      return;
    }
    checkoutLock.current = true;
    setCheckoutPlan(plan.id);
    setPaymentProgress({ stage: "preparing", planName: localizedPlanCopy(plan, locale).name });
    setError(""); setResumeCheckout(null);
    try {
      if (plan.entitlement_scope === "one_store" && selectedStore) {
        localStorage.setItem(PENDING_STORE_KEY, String(selectedStore));
      }
      const result = await platform.checkoutSubscription({
        plan: plan.id,
        store: plan.entitlement_scope === "one_store" ? selectedStore ?? undefined : undefined,
        locale,
        useBalance,
        provider,
      });
      setPaymentProgress({ stage: "redirecting", planName: localizedPlanCopy(plan, locale).name });
      window.setTimeout(() => window.location.assign(result.payment_url), 280);
    } catch (err) {
      if (err instanceof ApiError && err.code === "checkout_in_progress") {
        const checkout = err.payload?.checkout as { payment_url?: unknown; retry_after_seconds?: unknown } | undefined;
        const url = typeof checkout?.payment_url === "string" ? checkout.payment_url : "";
        const retryMinutes = Math.max(1, Math.ceil(Number(checkout?.retry_after_seconds ?? 0) / 60));
        setError(t("membership.checkoutInProgress").replace("{minutes}", String(retryMinutes)));
        if (url) setResumeCheckout({ url, retryMinutes });
      } else setError(friendlyApiError(err, t, "membership.checkoutError"));
      checkoutLock.current = false;
      setPaymentProgress(null);
      setCheckoutPlan(null);
    }
  };

  const startCheckout = (plan: SubscriptionPlan) => {
    if (checkoutLock.current || checkoutPlan || plan.is_free) return;
    if (plan.entitlement_scope === "one_store" && !selectedStore) { setError(t("membership.storeRequired")); return; }
    setGatewayPlan(plan);
  };

  const chooseGateway = (code: string) => {
    if (!gatewayPlan) return;
    const plan = gatewayPlan;
    setGatewayPlan(null);
    setSelectedGateway(code);
    const available = Number(status?.balances.find((balance) => balance.currency === plan.currency)?.available ?? 0);
    if (available > 0) { setBalancePlan(plan); return; }
    void performCheckout(plan, false, code);
  };

  if (loading) return <ContentLoader label={t("membership.loading")} />;

  return (
    <PageTransition>
      <section className="sr-membership">
        <div className="sr-container">
          <motion.header className="sr-membership-hero" variants={fadeUp} initial="hidden" animate="show">
            <span className="sr-membership-kicker">{t("membership.kicker")}</span>
            <h1>{t("membership.title")}</h1>
            <p>{t("membership.subtitle")}</p>
          </motion.header>

          {paymentId && (
            <div className={`sr-membership-notice ${paymentConfirmed ? "success" : paymentResult === "failed" || paymentTerminalFailure || paymentDuplicate ? "error" : "pending"}`} role="status">
              <strong>{paymentConfirmed ? t("membership.paymentReady") : paymentDuplicate ? t("membership.paymentReview") : paymentResult === "failed" || paymentTerminalFailure ? t("membership.paymentFailed") : t("membership.paymentChecking")}</strong>
              <span>{paymentConfirmed ? t(requestedStoreId ? "membership.paymentReadyStoreDesc" : "membership.paymentReadyDesc") : paymentDuplicate ? t("membership.paymentReviewDesc") : paymentResult === "failed" || paymentTerminalFailure ? t("membership.paymentFailedDesc") : t("membership.paymentCheckingDesc")}</span>
              {checking && paymentResult !== "failed" && !paymentTerminalFailure && !paymentDuplicate && <span className="sr-btn-spinner" aria-hidden="true" />}
              {paymentConfirmed && (
                <Link to={continuation} className="sr-btn sr-btn-primary">
                  {requestedDesign ? t("membership.continueDesign") : t("membership.createStore")}
                </Link>
              )}
              {!paymentConfirmed && !checking && (
                <button type="button" className="sr-btn sr-btn-ghost" onClick={() => { setChecking(true); void load(true); }}>
                  {t("membership.checkAgain")}
                </button>
              )}
            </div>
          )}

          {paymentResult === "failed" && !paymentId && (
            <div className="sr-membership-notice error" role="alert">
              <strong>{t("membership.paymentFailed")}</strong>
              <span>{t("membership.paymentFailedDesc")}</span>
            </div>
          )}

          {error && (
            <div className="sr-auth-error sr-membership-error" role="alert">
              <span>{error}</span>
              {resumeCheckout ? <a className="sr-btn sr-btn-ghost sr-btn-sm" href={resumeCheckout.url}>{t("membership.resumeCheckout")}</a> : <button className="sr-btn sr-btn-ghost sr-btn-sm" type="button" onClick={() => void load()}>{t("preview.retry")}</button>}
            </div>
          )}

          {catalog && !catalog.billing.available && (
            <div className="sr-membership-notice pending" role="status">{t("membership.billingUnavailable")}</div>
          )}

          {(status?.balances ?? []).map((balance) => (
            <section className="sr-membership-balance" key={balance.currency} aria-label={t("membership.totalBalance")}>
              <div>
                <span>{t("membership.totalBalance")}</span>
                <strong>{Math.floor(Number(balance.balance) || 0).toLocaleString(locale === "ar" ? "en-US" : locale)} <small>{balance.currency}</small></strong>
              </div>
              <dl>
                <div><dt>{t("membership.availableBalance")}</dt><dd>{Math.floor(Number(balance.available) || 0).toLocaleString(locale === "ar" ? "en-US" : locale)} {balance.currency}</dd></div>
                <div><dt>{t("membership.reservedBalance")}</dt><dd>{Math.floor(Number(balance.reserved) || 0).toLocaleString(locale === "ar" ? "en-US" : locale)} {balance.currency}</dd></div>
              </dl>
              {Number(balance.reserved) > 0 && <p>{t("membership.reservedBalanceHelp")}</p>}
            </section>
          ))}

          <div className="sr-plan-grid">
            {(catalog?.plans ?? []).filter((plan) => !plan.is_free || !hasUsedFreePlan(status) || isPlanCurrent(status, plan, selectedStore)).map((plan, index) => {
              const current = isPlanCurrent(status, plan, selectedStore);
              const currentScopePlan = status?.subscriptions.find((entry) => (
                entry.status === "active"
                && entry.plan?.entitlement_scope === plan.entitlement_scope
                && (plan.entitlement_scope === "all_owned_stores" || entry.selected_store?.id === selectedStore)
              ))?.plan;
              const isLowerPlan = Boolean(currentScopePlan && !current && Number(plan.price) <= Number(currentScopePlan.price));
              const needsStore = plan.entitlement_scope === "one_store";
              const benefits = planBenefits(plan, locale);
              const copy = localizedPlanCopy(plan, locale);
              const recommended = plan.id === recommendedPlanId(catalog?.plans ?? []);
              return (
                <motion.article
                  key={plan.id}
                  className={`sr-plan-card${recommended ? " featured" : ""}${current ? " current" : ""}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                >
                  <div className="sr-plan-card-topline">
                    {current ? <span className="sr-plan-current-badge">{t("membership.current")}</span> : recommended ? <span className="sr-plan-recommended">{t("plans.recommended")}</span> : <span />}
                    <span className="sr-plan-scope-pill">{t(needsStore ? "planDetail.scopeStore" : "planDetail.scopeAccount")}</span>
                  </div>
                  <div className="sr-plan-heading">
                    <Link to={`/pricing/${encodeURIComponent(plan.slug)}`}>{copy.name}</Link>
                  </div>
                  <p>{copy.description || t("planDetail.coreIncluded")}</p>
                  <div className="sr-plan-price">
                    <strong>{plan.is_free ? t("membership.free") : formatPlanPrice(plan.price, plan.currency, locale)}</strong>
                    {!plan.is_free && <span>/ {plan.duration_days} {t("membership.days")}</span>}
                  </div>
                  <div className="sr-plan-highlights-heading">
                    <span>{t("plans.highlights")}</span>
                    {benefits.length > 5 && <small>+{benefits.length - 5} {t("plans.more")}</small>}
                  </div>
                  <ul>
                    {benefits.slice(0, 5).map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}
                  </ul>

                  <Link className="sr-plan-details-link" to={`/pricing/${encodeURIComponent(plan.slug)}`}>{t("plans.viewDetails")}</Link>

                  {needsStore && stores.length > 0 && !current && (
                    <label className="sr-field sr-plan-store">
                      <span>{t("membership.chooseStore")}</span>
                      <select value={selectedStore ?? ""} onChange={(event) => setSelectedStore(Number(event.target.value))}>
                        {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                      </select>
                    </label>
                  )}

                  {current ? (
                    <button type="button" className="sr-btn sr-btn-ghost sr-btn-block" disabled>{t("membership.current")}</button>
                  ) : isLowerPlan ? (
                    <button type="button" className="sr-btn sr-btn-ghost sr-btn-block" disabled>{t("membership.availableAtRenewal")}</button>
                  ) : plan.is_free ? (
                    <Link to="/create" className="sr-btn sr-btn-ghost sr-btn-block">{t("membership.startFree")}</Link>
                  ) : (
                    <button
                      type="button"
                      className="sr-btn sr-btn-primary sr-btn-block"
                      disabled={!catalog?.billing.available || checkoutPlan !== null || (needsStore && stores.length === 0)}
                      onClick={() => void startCheckout(plan)}
                    >
                      {checkoutPlan === plan.id ? t("membership.openingCheckout") : needsStore && stores.length === 0 ? t("membership.createStoreFirst") : t("membership.choosePlan")}
                    </button>
                  )}
                </motion.article>
              );
            })}
          </div>

          <BalanceConsentDialog plan={balancePlan} available={Number(status?.balances.find((balance) => balance.currency === balancePlan?.currency)?.available ?? 0)} busy={checkoutPlan !== null} onClose={() => setBalancePlan(null)} onChoose={(useBalance) => { if (!balancePlan) return; const plan = balancePlan; setBalancePlan(null); void performCheckout(plan, useBalance); }} />
          <GatewayChoiceDialog open={Boolean(gatewayPlan)} gateways={catalog?.billing.gateways ?? []} locale={locale} onClose={() => setGatewayPlan(null)} onChoose={chooseGateway} />
          <PaymentProgressDialog open={Boolean(paymentProgress || (checking && paymentResult !== "failed" && paymentId && !paymentConfirmed && !paymentTerminalFailure && !paymentDuplicate))} stage={paymentProgress?.stage ?? "confirming"} planName={paymentProgress?.planName ?? trackedPayment?.plan_name} />

        </div>
      </section>
    </PageTransition>
  );
}
