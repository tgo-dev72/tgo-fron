import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiCheck, FiCreditCard, FiZap } from "react-icons/fi";
import { api, ApiError, type PlanCatalog, type SubscriptionPlan, type SubscriptionStatus } from "../api/client";
import { useStore } from "../Layout";
import { PageLoader } from "../components/Skeleton";
import { BalanceConsentModal } from "../components/BalanceConsentModal";
import { PaymentProgressModal, type PaymentProgressStage } from "../components/PaymentProgressModal";
import { ModalShell } from "../components/ModalShell";
import { t, useLocale } from "../i18n";
import { isPlanActiveForSelection, localizedPlanCopy } from "../lib/subscription";
import { friendlyError } from "../utils/errors";
import { announceSubscriptionStatusUpdate, paymentReturnSearch, readPaymentReturn } from "../../../shared/paymentReturn";

export function SubscriptionPage() {
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const { store } = useStore();
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [upgrading, setUpgrading] = useState<number | null>(null);
  const [balancePlan, setBalancePlan] = useState<SubscriptionPlan | null>(null);
  const [gatewayPlan, setGatewayPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedGateway, setSelectedGateway] = useState("");
  const [paymentProgress, setPaymentProgress] = useState<{ stage: PaymentProgressStage; planName: string } | null>(null);
  const [error, setError] = useState("");
  const [resumeCheckout, setResumeCheckout] = useState<{ url: string; retryMinutes: number } | null>(null);
  const paymentReturn = useRef(readPaymentReturn(window.location.search));
  const paymentResult = paymentReturn.current.result;
  const paymentId = paymentReturn.current.paymentId;
  const trackedPayment = status?.payment;
  const paymentConfirmed = trackedPayment?.status === "confirmed";
  const paymentDuplicate = trackedPayment?.status === "duplicate";
  const paymentTerminalFailure = Boolean(trackedPayment && ["failed", "canceled"].includes(trackedPayment.status));
  const paymentPending = Boolean(paymentId && paymentResult !== "failed" && (!trackedPayment || trackedPayment.status === "pending"));
  const activeSubscriptions = (status?.subscriptions ?? []).filter((item) => item.status === "active");

  useLayoutEffect(() => {
    if (!paymentReturn.current.isReturn) return;
    if (paymentReturnSearch(location.search) === location.search) return;
    navigate({ pathname: location.pathname, search: paymentReturnSearch(location.search), hash: location.hash }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, paymentId, paymentResult]);

  useEffect(() => {
    Promise.all([api.listSubscriptionPlans(), api.subscriptionStatus(paymentId)])
      .then(([plans, current]) => { setCatalog(plans); setStatus(current); })
      .catch((err: unknown) => setError(friendlyError(err, locale, "errors.loadFailed")))
      .finally(() => setLoading(false));
  }, [locale, paymentId]);

  useEffect(() => {
    if (!paymentId) return;
    setCheckingPayment(true);
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      api.subscriptionStatus(paymentId).then((current) => {
        setStatus(current);
        if ((current.payment?.status && current.payment.status !== "pending") || attempts >= 30) {
          if (current.payment?.status && current.payment.status !== "pending") announceSubscriptionStatusUpdate();
          setCheckingPayment(false);
          window.clearInterval(timer);
        }
      }).catch(() => {
        if (attempts >= 30) {
          setCheckingPayment(false);
          window.clearInterval(timer);
        }
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [paymentId]);

  async function performUpgrade(plan: SubscriptionPlan, useBalance: boolean, provider = selectedGateway) {
    if (isPlanActiveForSelection(plan, activeSubscriptions, store?.id ?? null)) return;
    if (plan.entitlement_scope === "one_store" && !store) { setError(t(locale, "subscription.selectStore")); return; }
    setUpgrading(plan.id); setError(""); setResumeCheckout(null);
    setPaymentProgress({ stage: "preparing", planName: localizedPlanCopy(plan, locale).name });
    try {
      const checkout = await api.createSubscriptionCheckout(plan.id, plan.entitlement_scope === "one_store" ? store?.id ?? null : null, locale, useBalance, provider);
      setPaymentProgress({ stage: "redirecting", planName: localizedPlanCopy(plan, locale).name });
      window.setTimeout(() => window.location.assign(checkout.payment_url), 280);
    } catch (err) {
      if (err instanceof ApiError && err.code === "checkout_in_progress") {
        const checkout = err.payload?.checkout as { payment_url?: unknown; retry_after_seconds?: unknown } | undefined;
        const url = typeof checkout?.payment_url === "string" ? checkout.payment_url : "";
        const retryMinutes = Math.max(1, Math.ceil(Number(checkout?.retry_after_seconds ?? 0) / 60));
        setError(t(locale, "subscription.checkoutInProgress", { minutes: retryMinutes }));
        if (url) setResumeCheckout({ url, retryMinutes });
      } else setError(friendlyError(err, locale, "subscription.checkoutFailed"));
      setPaymentProgress(null);
      setUpgrading(null);
    }
  }

  function upgrade(plan: SubscriptionPlan) {
    if (isPlanActiveForSelection(plan, activeSubscriptions, store?.id ?? null)) return;
    if (plan.entitlement_scope === "one_store" && !store) { setError(t(locale, "subscription.selectStore")); return; }
    setGatewayPlan(plan);
  }

  function chooseGateway(code: string) {
    if (!gatewayPlan) return;
    const plan = gatewayPlan;
    setGatewayPlan(null);
    setSelectedGateway(code);
    const available = Number(status?.balances.find((balance) => balance.currency === plan.currency)?.available ?? 0);
    if (available > 0) { setBalancePlan(plan); return; }
    void performUpgrade(plan, false, code);
  }

  if (loading) return <div className="card"><PageLoader /></div>;

  return <div>
    <div className="page-head"><div><h1 className="d-title">{t(locale, "subscription.title")}</h1><p className="d-subtitle">{t(locale, "subscription.subtitle")}</p></div></div>
    {paymentConfirmed && <div className="subscription-notice success"><FiCheck /> {t(locale, "subscription.paymentReceived")}</div>}
    {paymentPending && <div className="subscription-notice warning"><FiAlertTriangle /> {t(locale, "subscription.paymentPending")}</div>}
    {paymentDuplicate && <div className="subscription-notice error"><FiAlertTriangle /> {t(locale, "subscription.paymentReview")}</div>}
    {(paymentTerminalFailure || (paymentResult === "failed" && !paymentId)) && <div className="subscription-notice error"><FiAlertTriangle /> {t(locale, "subscription.paymentFailed")}</div>}
    {activeSubscriptions.map((active) => <section className="card subscription-current" key={`${active.plan?.id}-${active.selected_store?.id ?? "account"}`}>
      <div><span>{t(locale, "subscription.current")}</span><h2>{active.plan ? localizedPlanCopy(active.plan, locale).name : ""}</h2><p>{active.selected_store ? `${active.selected_store.name} · ` : ""}{t(locale, "subscription.activeUntil", { date: active.current_period_end ? new Date(active.current_period_end).toLocaleDateString(locale) : "—" })}</p></div>
      <b><FiCheck /> {t(locale, "subscription.active")}</b>
    </section>)}
    {error && <div className="subscription-notice error subscription-recovery"><FiAlertTriangle /><span>{error}</span>{resumeCheckout && <a className="btn btn-secondary btn-sm" href={resumeCheckout.url}>{t(locale, "subscription.resumeCheckout")}</a>}</div>}
    {(status?.balances ?? []).filter((balance) => Number(balance.balance) > 0).map((balance) => <section className="card subscription-balance" key={balance.currency}>
      <div><span>{t(locale, "subscription.balance")}</span><strong>{Math.floor(Number(balance.balance)).toLocaleString(locale === "ar" ? "en-US" : locale, { maximumFractionDigits: 0 })} <small>{balance.currency}</small></strong></div>
      <p>{Number(balance.reserved) > 0 ? t(locale, "subscription.balanceReserved", { amount: `${Math.floor(Number(balance.reserved))} ${balance.currency}` }) : t(locale, "subscription.balanceAtCheckout")}</p>
    </section>)}
    <section className="subscription-grid">
      {(catalog?.plans ?? []).map((plan) => {
        const copy = localizedPlanCopy(plan, locale);
        const isCurrent = isPlanActiveForSelection(plan, activeSubscriptions, store?.id ?? null);
        const currentScopePlan = activeSubscriptions.find((entry) => (
          entry.plan?.entitlement_scope === plan.entitlement_scope
          && (plan.entitlement_scope === "all_owned_stores" || entry.selected_store?.id === store?.id)
        ))?.plan;
        const isLowerPlan = Boolean(currentScopePlan && !isCurrent && Number(plan.price) <= Number(currentScopePlan.price));
        return <article className={`subscription-card${plan.is_featured ? " featured" : ""}${isCurrent ? " current" : ""}`} data-plan-state={isCurrent ? "current" : "available"} key={plan.id}>
          {plan.is_featured && <span className="subscription-featured"><FiZap /> {t(locale, "subscription.recommended")}</span>}
          <h2>{copy.name}</h2><p>{copy.description}</p>
          <strong>{Number(plan.price).toLocaleString(locale)} <small>{plan.currency}</small></strong>
          <span className="subscription-period">{plan.is_free ? t(locale, "subscription.forever") : t(locale, "subscription.forDays", { days: plan.duration_days })}</span>
          <ul>
            {plan.benefits?.length
              ? plan.benefits.map((benefit) => {
                  const feature = benefit.translations?.[locale]?.display || benefit.display;
                  const detail = [benefit.description, benefit.counting_rules, benefit.reset_window && benefit.reset_window !== "none" ? `Window: ${benefit.reset_window}` : ""].filter(Boolean).join(" ");
                  return <li key={benefit.key} title={detail}><FiCheck /> {feature}</li>;
                })
              : plan.features.map((feature) => <li key={feature}><FiCheck /> {feature}</li>)}
          </ul>
          {plan.is_free ? <button className="btn btn-secondary" disabled>{activeSubscriptions.length ? t(locale, "subscription.freeAvailable") : t(locale, "subscription.currentPlan")}</button> :
            isCurrent ? <button className="btn btn-secondary" disabled><FiCheck /> {t(locale, "subscription.currentPlan")}</button> :
            isLowerPlan ? <button className="btn btn-secondary" disabled>{t(locale, "subscription.availableAtRenewal")}</button> :
            <button className="btn btn-primary" disabled={!catalog?.billing.available || upgrading !== null} onClick={() => upgrade(plan)}><FiCreditCard /> {upgrading === plan.id ? t(locale, "subscription.redirecting") : t(locale, "subscription.upgrade")}</button>}
        </article>;
      })}
    </section>
    <GatewayModal open={Boolean(gatewayPlan)} gateways={catalog?.billing.gateways ?? []} locale={locale} onClose={() => setGatewayPlan(null)} onChoose={chooseGateway} />
    <BalanceConsentModal plan={balancePlan} available={Number(status?.balances.find((balance) => balance.currency === balancePlan?.currency)?.available ?? 0)} busy={upgrading !== null} onClose={() => setBalancePlan(null)} onChoose={(useBalance) => { if (!balancePlan) return; const plan = balancePlan; setBalancePlan(null); void performUpgrade(plan, useBalance); }} />
    <PaymentProgressModal open={Boolean(paymentProgress || (paymentPending && checkingPayment))} stage={paymentProgress?.stage ?? "confirming"} planName={paymentProgress?.planName ?? trackedPayment?.plan_name} />
  </div>;
}

function GatewayModal({ open, gateways, locale, onClose, onChoose }: {
  open: boolean;
  gateways: Array<{ code: string; name: string; sandbox: boolean }>;
  locale: "en" | "fr" | "ar";
  onClose: () => void;
  onChoose: (code: string) => void;
}) {
  const copy = {
    en: { title: "Choose how to pay", detail: "Select an available secure payment method.", sandbox: "Test mode", close: "Cancel", paypal: "Pay with your PayPal account", youcanpay: "Pay securely by card" },
    fr: { title: "Choisissez votre moyen de paiement", detail: "Sélectionnez un moyen de paiement sécurisé disponible.", sandbox: "Mode test", close: "Annuler", paypal: "Payer avec votre compte PayPal", youcanpay: "Payer par carte en toute sécurité" },
    ar: { title: "اختر طريقة الدفع", detail: "اختر إحدى طرق الدفع الآمنة المتاحة.", sandbox: "وضع الاختبار", close: "إلغاء", paypal: "الدفع باستخدام حساب PayPal", youcanpay: "الدفع الآمن بالبطاقة" },
  }[locale];
  return <ModalShell open={open} onClose={onClose} labelledBy="gateway-modal-title" panelClassName="gateway-modal">
    <div className="modal-head"><div><h2 id="gateway-modal-title" className="d-card-title">{copy.title}</h2><p>{copy.detail}</p></div></div>
    <div className="modal-body gateway-options">{gateways.map((gateway) => <button type="button" className="gateway-option" key={gateway.code} onClick={() => onChoose(gateway.code)}>
      <span><strong>{gateway.name}</strong><small>{gateway.code === "paypal" ? copy.paypal : gateway.code === "youcanpay" ? copy.youcanpay : gateway.name}</small></span>
      {gateway.sandbox && <em>{copy.sandbox}</em>}
    </button>)}</div>
    <div className="modal-foot"><button type="button" className="btn btn-secondary" onClick={onClose}>{copy.close}</button></div>
  </ModalShell>;
}
