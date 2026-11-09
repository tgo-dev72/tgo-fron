import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  platform,
  ApiError,
  type Store,
  type SubscriptionCatalog,
  type SubscriptionStatus,
} from "../api/platform";
import { useAuth } from "../auth/AuthContext";
import { ContentLoader } from "../components/ContentLoader";
import { BalanceConsentDialog } from "../components/BalanceConsentDialog";
import { GatewayChoiceDialog } from "../components/GatewayChoiceDialog";
import { PaymentProgressDialog, type PaymentProgressStage } from "../components/PaymentProgressDialog";
import { IconCard, IconShield, IconStore } from "../components/ShowroomIcons";
import { PageTransition, fadeUp } from "../components/PageTransition";
import { useLocale } from "../i18n";
import { friendlyApiError } from "../lib/errors";
import { loadPlanCatalog, readPlanCatalogCache } from "../lib/planCatalog";
import { formatPlanPrice, isMembershipResolved, isPlanCurrent, localizedPlanBenefit, localizedPlanCopy, planBenefits, recommendedPlanId } from "../lib/plans";

export default function PlanDetail() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const [catalog, setCatalog] = useState<SubscriptionCatalog | null>(readPlanCatalogCache);
  const [catalogLoading, setCatalogLoading] = useState(() => !readPlanCatalogCache());
  const [catalogError, setCatalogError] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [accountLoading, setAccountLoading] = useState(Boolean(user));
  const [accountError, setAccountError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState("");
  const [paymentProgress, setPaymentProgress] = useState<{ stage: PaymentProgressStage; planName: string } | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [resumeCheckout, setResumeCheckout] = useState<string | null>(null);
  const checkoutLock = useRef(false);

  const loadCatalog = async () => {
    if (!catalog) setCatalogLoading(true);
    setCatalogError("");
    try {
      setCatalog(await loadPlanCatalog());
    } catch (error) {
      if (!catalog) setCatalogError(friendlyApiError(error, t));
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadAccount = async () => {
    if (!user) return;
    setAccountLoading(true);
    setAccountError("");
    try {
      const [nextStatus, nextStores] = await Promise.all([
        platform.subscriptionStatus(),
        platform.listStores(),
      ]);
      setStatus(nextStatus);
      setStores(nextStores);
      const subscribedStore = nextStatus.subscriptions.find((entry) => (
        entry.status === "active" && entry.plan?.slug === slug && entry.selected_store
      ))?.selected_store?.id;
      setSelectedStore((current) => current && nextStores.some((store) => store.id === current)
        ? current
        : subscribedStore ?? nextStores[0]?.id ?? null);
    } catch (error) {
      setAccountError(friendlyApiError(error, t));
    } finally {
      setAccountLoading(false);
    }
  };

  useEffect(() => { void loadCatalog(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadAccount(); }, [user, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (catalogLoading && !catalog) return <ContentLoader label={t("plans.loading")} />;

  const plan = catalog?.plans.find((item) => item.slug === slug);
  if (!catalog || !plan) {
    return (
      <PageTransition>
        <section className="sr-plan-detail-state">
          <h1>{catalogError ? t("planDetail.unavailable") : t("planDetail.notFound")}</h1>
          <p>{catalogError || t("planDetail.notFoundDesc")}</p>
          <div>
            {catalogError && <button type="button" className="sr-btn sr-btn-primary" onClick={() => void loadCatalog()}>{t("preview.retry")}</button>}
            <Link to="/pricing" className="sr-btn sr-btn-ghost">{t("planDetail.back")}</Link>
          </div>
        </section>
      </PageTransition>
    );
  }

  const needsStore = plan.entitlement_scope === "one_store";
  const current = isPlanCurrent(status, plan, selectedStore);
  const currentScopePlan = status?.subscriptions.find((entry) => (
    entry.status === "active"
    && entry.plan?.entitlement_scope === plan.entitlement_scope
    && (plan.entitlement_scope === "all_owned_stores" || entry.selected_store?.id === selectedStore)
  ))?.plan;
  const isLowerPlan = Boolean(currentScopePlan && !current && Number(plan.price) <= Number(currentScopePlan.price));
  const benefits = planBenefits(plan, locale);
  const copy = localizedPlanCopy(plan, locale);
  const recommended = plan.id === recommendedPlanId(catalog.plans);
  const membershipResolved = isMembershipResolved(Boolean(user), accountLoading, Boolean(accountError));
  const canPurchase = Boolean(user && membershipResolved && !plan.is_free && !current && !isLowerPlan && catalog?.billing.available && (!needsStore || selectedStore));

  const performPurchase = async (useBalance: boolean, provider = selectedGateway) => {
    if (!canPurchase || checkoutLock.current) return;
    checkoutLock.current = true;
    setCheckoutLoading(true);
    setPaymentProgress({ stage: "preparing", planName: copy.name });
    setCheckoutError(""); setResumeCheckout(null);
    try {
      const result = await platform.checkoutSubscription({
        plan: plan.id,
        store: needsStore ? selectedStore ?? undefined : undefined,
        locale,
        useBalance,
        provider,
      });
      setPaymentProgress({ stage: "redirecting", planName: copy.name });
      window.setTimeout(() => window.location.assign(result.payment_url), 280);
    } catch (error) {
      if (error instanceof ApiError && error.code === "checkout_in_progress") {
        const checkout = error.payload?.checkout as { payment_url?: unknown; retry_after_seconds?: unknown } | undefined;
        const url = typeof checkout?.payment_url === "string" ? checkout.payment_url : "";
        const retryMinutes = Math.max(1, Math.ceil(Number(checkout?.retry_after_seconds ?? 0) / 60));
        setCheckoutError(t("membership.checkoutInProgress").replace("{minutes}", String(retryMinutes)));
        setResumeCheckout(url || null);
      } else setCheckoutError(friendlyApiError(error, t, "membership.checkoutError"));
      checkoutLock.current = false;
      setPaymentProgress(null);
      setCheckoutLoading(false);
    }
  };
  const purchase = () => {
    if (!canPurchase || checkoutLock.current) return;
    setGatewayDialogOpen(true);
  };
  const chooseGateway = (code: string) => {
    setGatewayDialogOpen(false);
    setSelectedGateway(code);
    const available = Number(status?.balances.find((balance) => balance.currency === plan.currency)?.available ?? 0);
    if (available > 0) { setBalanceDialogOpen(true); return; }
    void performPurchase(false, code);
  };

  const loginState = { from: `${location.pathname}${location.search}` };
  const rememberPlan = () => {
    window.sessionStorage.setItem("showroom-post-auth-return", loginState.from);
  };

  return (
    <PageTransition>
      <section className="sr-plan-detail-page">
        <div className="sr-container">
          <nav className="sr-account-breadcrumb" aria-label={t("planDetail.breadcrumb")}>
            <Link to="/pricing">{t("planDetail.back")}</Link><span aria-hidden="true">/</span><span>{copy.name}</span>
          </nav>

          <motion.header className="sr-plan-detail-hero" variants={fadeUp} initial="hidden" animate="show">
            <div className="sr-plan-detail-hero-copy">
              <div className="sr-plan-detail-labels">
                <span>{recommended ? t("plans.recommended") : t("planDetail.eyebrow")}</span>
                <span>{t(needsStore ? "planDetail.scopeStore" : "planDetail.scopeAccount")}</span>
              </div>
              <h1>{copy.name}</h1>
              <p>{copy.description || t("planDetail.coreIncluded")}</p>
            </div>
            <div className="sr-plan-detail-glance" aria-label={t("planDetail.glance")}>
              <div><strong>{benefits.length}</strong><span>{t("planDetail.benefitsCount")}</span></div>
              <div><strong>{plan.is_free ? t("planDetail.noBilling") : `${plan.duration_days}`}</strong><span>{plan.is_free ? t("planDetail.alwaysFree") : t("membership.days")}</span></div>
            </div>
          </motion.header>

          <div className="sr-plan-detail-layout">
            <motion.main className="sr-plan-detail-main" variants={fadeUp} initial="hidden" animate="show">
              {(plan.benefits ?? []).length === 0 && <section className="sr-plan-detail-section">
                <h2>{t("planDetail.included")}</h2>
                <ul className="sr-plan-detail-features">
                  {benefits.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}
                  {benefits.length === 0 && <li>{t("planDetail.coreIncluded")}</li>}
                </ul>
              </section>}

              {(plan.benefits ?? []).length > 0 && (
                <section className="sr-plan-detail-section">
                  <h2>{t("planDetail.capabilities")}</h2>
                  <div className="sr-plan-capabilities">
                    {(plan.benefits ?? []).map((benefit) => {
                      const copy = localizedPlanBenefit(benefit, locale);
                      return <article key={`${benefit.key}-${copy.display}`}>
                        <div><strong>{copy.name}</strong>{copy.description && <p>{copy.description}</p>}</div>
                        <span>{copy.display}</span>
                      </article>;
                    })}
                  </div>
                </section>
              )}

              <Link to="/pricing" className="sr-plan-detail-back-link">{t("planDetail.otherPlans")}</Link>
            </motion.main>

            <aside className="sr-plan-purchase-card" aria-labelledby="plan-selection-title">
              <span className="sr-plan-purchase-eyebrow" id="plan-selection-title">{t("planDetail.selectionTitle")}</span>
              <div className="sr-plan-purchase-price">
                <strong>{plan.is_free ? t("membership.free") : formatPlanPrice(plan.price, plan.currency, locale)}</strong>
                <small>{plan.is_free ? t("planDetail.noBillingDesc") : `${plan.duration_days} ${t("membership.days")}`}</small>
              </div>

              <dl className="sr-plan-purchase-facts">
                <div><dt><IconCard />{t("planDetail.duration")}</dt><dd>{plan.is_free ? t("planDetail.noBilling") : `${plan.duration_days} ${t("membership.days")}`}</dd></div>
                <div><dt><IconStore />{t("planDetail.scope")}</dt><dd>{t(needsStore ? "planDetail.scopeStore" : "planDetail.scopeAccount")}</dd></div>
              </dl>
              <p className="sr-plan-scope-note">{t(needsStore ? "planDetail.scopeStoreDesc" : "planDetail.scopeAccountDesc")}</p>

              {user && needsStore && stores.length > 0 && !current && (
                <label className="sr-field sr-plan-detail-store">
                  <span>{t("planDetail.selectStore")}</span>
                  <select value={selectedStore ?? ""} onChange={(event) => setSelectedStore(Number(event.target.value))} disabled={checkoutLoading}>
                    {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                  </select>
                </label>
              )}

              {accountError && <div className="sr-plan-inline-error" role="alert"><span>{accountError}</span><button type="button" onClick={() => void loadAccount()}>{t("preview.retry")}</button></div>}
              {checkoutError && <div className="sr-plan-inline-error sr-checkout-recovery" role="alert"><span>{checkoutError}</span>{resumeCheckout && <a className="sr-btn sr-btn-ghost sr-btn-sm" href={resumeCheckout}>{t("membership.resumeCheckout")}</a>}</div>}
              {!catalog.billing.available && !plan.is_free && <div className="sr-plan-inline-note">{t("membership.billingUnavailable")}</div>}
              {accountLoading && user && <div className="sr-plan-account-loading" role="status"><span />{t("planDetail.checkingAccount")}</div>}
              {current && <div className="sr-plan-current-note"><IconShield /><span>{t("planDetail.currentNote")}</span></div>}

              {user && accountLoading ? (
                <button type="button" className="sr-btn sr-btn-ghost sr-btn-block" disabled>{t("planDetail.checkingAccount")}</button>
              ) : user && accountError ? (
                <button type="button" className="sr-btn sr-btn-ghost sr-btn-block" disabled>{t("planDetail.accountUnavailable")}</button>
              ) : !user && plan.is_free ? (
                <Link to="/signup" className="sr-btn sr-btn-primary sr-btn-block">{t("planDetail.startFree")}</Link>
              ) : current ? (
                <button type="button" className="sr-btn sr-btn-ghost sr-btn-block" disabled>{t("membership.current")}</button>
              ) : user && isLowerPlan ? (
                <button type="button" className="sr-btn sr-btn-ghost sr-btn-block" disabled>{t("membership.availableAtRenewal")}</button>
              ) : plan.is_free ? (
                <Link to="/create" className="sr-btn sr-btn-primary sr-btn-block">{t("planDetail.startFree")}</Link>
              ) : !user ? (
                <Link to="/login" state={loginState} onClick={rememberPlan} className="sr-btn sr-btn-primary sr-btn-block">{t("planDetail.signInPurchase")}</Link>
              ) : needsStore && stores.length === 0 && !accountLoading ? (
                <Link to="/create" className="sr-btn sr-btn-primary sr-btn-block">{t("membership.createStoreFirst")}</Link>
              ) : (
                <button type="button" className="sr-btn sr-btn-primary sr-btn-block" disabled={!canPurchase || checkoutLoading} onClick={() => void purchase()}>
                  {checkoutLoading ? <><span className="sr-btn-spinner" />{t("membership.openingCheckout")}</> : t("planDetail.purchase")}
                </button>
              )}

              {!user && !plan.is_free && <Link to="/signup" onClick={rememberPlan} className="sr-plan-create-account">{t("planDetail.createAccount")}</Link>}
              <div className="sr-plan-secure-note"><IconShield /><span>{t("planDetail.secure")}</span></div>
              {!plan.is_free && (
                <div className="sr-plan-next-steps">
                  <strong>{t("planDetail.next")}</strong>
                  <ol>
                    <li><span>1</span>{t(needsStore ? "planDetail.nextStore" : "planDetail.nextAccount")}</li>
                    <li><span>2</span>{t("planDetail.nextReview")}</li>
                    <li><span>3</span>{t("planDetail.nextActivate")}</li>
                  </ol>
                </div>
              )}
            </aside>
          </div>
          <BalanceConsentDialog plan={balanceDialogOpen ? plan : null} available={Number(status?.balances.find((balance) => balance.currency === plan.currency)?.available ?? 0)} busy={checkoutLoading} onClose={() => setBalanceDialogOpen(false)} onChoose={(useBalance) => { setBalanceDialogOpen(false); void performPurchase(useBalance); }} />
          <GatewayChoiceDialog open={gatewayDialogOpen} gateways={catalog.billing.gateways ?? []} locale={locale} onClose={() => setGatewayDialogOpen(false)} onChoose={chooseGateway} />
          <PaymentProgressDialog open={Boolean(paymentProgress)} stage={paymentProgress?.stage ?? "preparing"} planName={paymentProgress?.planName} />
        </div>
      </section>
    </PageTransition>
  );
}
