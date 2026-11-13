import { useEffect, useMemo, useRef, useState } from "react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import type { Value as PhoneValue } from "react-phone-number-input";
import phoneLabelsAr from "react-phone-number-input/locale/ar";
import phoneLabelsEn from "react-phone-number-input/locale/en";
import phoneLabelsFr from "react-phone-number-input/locale/fr";
import "react-phone-number-input/style.css";
import { shippingCharge } from "../config";
import { ApiError } from "../api/client";
import { trackStorefrontEvent } from "../api/analytics";
import { metaConsent, metaTrackingId } from "../api/meta";
import { IconCard, IconCheck, IconClose, IconPackage, IconShield, type CartItem } from "../storefront/components";
import type { Locale } from "../i18n";
import { dir, formatPrice, t, useLocale } from "../i18n";
import { useStoreConfig } from "../storefront/context";
import { useAuth } from "../storefront/auth";
import { fillMissingContact } from "./customer-contact";
import { checkoutFailureMessage } from "./errors";
import { createCheckoutService } from "./service";
import type {
  CheckoutContact,
  CheckoutQuote,
  CheckoutLine,
  CheckoutOrder,
  CheckoutService,
  PaymentMethod,
  PlaceOrderInput,
} from "./types";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

type ContactErrors = Partial<Record<keyof CheckoutContact, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PENDING_KEY = "sf-pending-order";

function readPendingOrder(): CheckoutOrder | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as CheckoutOrder) : null;
  } catch {
    return null;
  }
}

function savePendingOrder(order: CheckoutOrder) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(order));
  } catch {
    // storage unavailable — verification resume still works via getOrder()
  }
}

function clearPendingOrder() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function orderIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("order_id");
}

function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ------------------------------------------------------------------ */
/* small inline icons                                                  */
/* ------------------------------------------------------------------ */

function LockIcon() {
  return <IconShield />;
}

function Spinner() {
  return <span className="sf-co-spinner" aria-hidden="true" />;
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <span className="sf-co-error">{msg}</span> : null;
}

/* ------------------------------------------------------------------ */
/* component                                                          */
/* ------------------------------------------------------------------ */

export function CheckoutFlow({
  open,
  onClose,
  items,
  locale,
  onOrderComplete,
  service,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  locale: Locale;
  onOrderComplete: () => void;
  service?: CheckoutService;
}) {
  const svc = useMemo<CheckoutService>(() => service ?? createCheckoutService(), [service]);
  const config = useStoreConfig();
  const { user } = useAuth();

  const [contact, setContact] = useState<CheckoutContact>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    address: "",
  });
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [locked, setLocked] = useState(false);
  const [policies, setPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [reviewedQuote, setReviewedQuote] = useState<{ fingerprint: string; quote: CheckoutQuote } | null>(null);
  const submittingRef = useRef(false);

  const [method, setMethod] = useState<PaymentMethod | undefined>(undefined);
  const [processing, setProcessing] = useState<PaymentMethod | "verify" | "quote" | null>(null);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [tracking, setTracking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const pollRef = useRef<{ stop: boolean }>({ stop: false });
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const isRtl = dir(locale) === "rtl";

  // Reset the flow when opened — unless we're returning from the hosted
  // payment page (?order_id=), in which case we resume verification.
  useEffect(() => {
    if (!open) return;
    setClosing(false);
    const oid = orderIdFromUrl();
    if (oid) {
      void resumeVerify(oid);
      return;
    }
    clearPendingOrder();
    setContact({ firstName: "", lastName: "", email: "", phone: "", city: "", address: "" });
    setContactErrors({});
    setLocked(false);
    setPolicies(false);
    setPoliciesError(false);
    setMarketingConsent(false);
    setCouponCode("");
    setReviewedQuote(null);
    setCouponError("");
    setCheckoutError("");
    idempotencyRef.current = null;
    setMethod(undefined);
    setProcessing(null);
    setOrder(null);
    setTracking(false);
    setFailed(null);
    setPendingOrderId(null);
  }, [open]);

  // The customer account is the source of truth for details it already knows.
  // `user` can arrive just after checkout opens while the cookie session is
  // being restored, so hydrate reactively and preserve any delivery override.
  useEffect(() => {
    if (!open || !user) return;
    setContact((current) => fillMissingContact(current, user));
  }, [open, user]);

  useEffect(() => {
    pollRef.current.stop = true;
    return () => {
      pollRef.current.stop = true;
    };
  }, []);

  const estimatedSubtotal = useMemo(() => items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0), [items]);

  const lines = useMemo<CheckoutLine[]>(
    () =>
      items.map((it) => {
        const variant = it.variantLabel;
        return {
          id: it.product.id,
          productId: it.product.id,
          productRef: it.product.ref,
          variantId: it.variantId,
          name: it.product.name,
          variant,
          qty: it.qty,
          unitPrice: it.unitPrice,
        };
      }),
    [items],
  );

  const fingerprint = JSON.stringify({ contact, marketingConsent, method,
    couponCode: couponCode.trim().toUpperCase(),
    lines: lines.map((line) => [line.productId, line.variantId, line.qty]),
  });
  const currentFingerprint = useRef(fingerprint);
  currentFingerprint.current = fingerprint;
  const quote = reviewedQuote?.fingerprint === fingerprint ? reviewedQuote.quote : null;
  const subtotal = quote?.subtotal ?? estimatedSubtotal;
  const shipping = quote?.shipping ?? shippingCharge(config, estimatedSubtotal);
  const discount = quote?.discount ?? 0;
  const tax = quote?.tax ?? 0;
  const total = quote?.total ?? subtotal + shipping;

  /* ---- validation ---- */

  function validateContact(c: CheckoutContact): ContactErrors {
    const e: ContactErrors = {};
    const req = t(locale, "checkout.required");
    if (!c.firstName.trim()) e.firstName = req;
    if (!c.lastName.trim()) e.lastName = req;
    if (!c.email.trim()) e.email = req;
    else if (!EMAIL_RE.test(c.email.trim())) e.email = t(locale, "checkout.emailInvalid");
    if (!c.phone.trim()) e.phone = req;
    else if (!isValidPhoneNumber(c.phone)) e.phone = t(locale, "checkout.phoneInvalid");
    if (!c.city.trim()) e.city = req;
    if (!c.address.trim()) e.address = req;
    return e;
  }

  /* ---- payment flow ---- */

  async function pollVerify(oid: string, snapshot: CheckoutOrder) {
    pollRef.current.stop = false;
    let tries = 0;
    while (!pollRef.current.stop && tries < 20) {
      try {
        const status = await svc.verifyOrder(oid);
        if (status === "confirmed") {
          let freshOrder = snapshot;
          try {
            freshOrder = await svc.getOrder(oid);
          } catch {
            // The paid status is authoritative; the saved snapshot still lets
            // the customer continue if the detail refresh is briefly delayed.
          }
          clearPendingOrder();
          setPendingOrderId(null);
          setProcessing(null);
          setOrder(freshOrder);
          trackStorefrontEvent({
            eventId: oid,
            eventType: "order_submitted",
            orderId: oid,
            contentIds: freshOrder.lines.map((line) => line.productRef),
            properties: { cart_value: freshOrder.totals.total, currency: freshOrder.currency, quantity: freshOrder.lines.reduce((sum, line) => sum + line.qty, 0), payment_mode: "online_paid" },
          });
          onOrderComplete();
          return;
        }
        if (status === "failed") {
          // Order is failed — nothing to cancel; keep the snapshot so the
          // customer can retry the payment or fall back to COD.
          setPendingOrderId(null);
          setProcessing(null);
          setFailed(t(locale, "checkout.failedMsg"));
          return;
        }
      } catch {
        // transient network error — keep polling
      }
      tries += 1;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setPendingOrderId(null);
    setProcessing(null);
    setFailed(t(locale, "checkout.genericError"));
  }

  async function resumeVerify(oid: string) {
    const query = new URLSearchParams(window.location.search);
    const failedReturn = [query.get("success"), query.get("is_success")].some((value) => value === "0" || value === "false");
    setProcessing(failedReturn ? null : "verify");
    setFailed(failedReturn ? t(locale, "checkout.failedMsg") : null);
    setPendingOrderId(oid);
    let snapshot = readPendingOrder();
    if (snapshot?.reference !== oid) snapshot = null;
    try {
      snapshot = await svc.getOrder(oid);
    } catch {
      // Keep the matching saved order available during a transient outage.
    }
    if (!snapshot) {
      setProcessing(null);
      setFailed(t(locale, "checkout.genericError"));
      return;
    }
    if (snapshot.paidStatus === "confirmed") {
      clearPendingOrder();
      setPendingOrderId(null);
      setProcessing(null);
      setFailed(null);
      setOrder(snapshot);
      onOrderComplete();
      return;
    }
    if (failedReturn || snapshot.paidStatus === "failed") {
      // Return parameters guide presentation only. Payment truth remains
      // with the backend; an unsigned return never changes the order ledger.
      savePendingOrder(snapshot);
      setProcessing(null);
      setFailed(t(locale, "checkout.failedMsg"));
      return;
    }
    void pollVerify(oid, snapshot);
  }

  function saveContact() {
    const errors = validateContact(contact);
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!policies) {
      setPoliciesError(true);
      return;
    }
    setPoliciesError(false);
    setLocked(true);
    setMethod(undefined);
  }

  async function placeOrder(m: PaymentMethod = method ?? "cod") {
    if (processing || submittingRef.current) return;
    submittingRef.current = true;
    setFailed(null);
    setCouponError("");
    setCheckoutError("");
    setProcessing(quote ? m : "quote");
    try {
      if (idempotencyRef.current?.fingerprint !== fingerprint) {
        idempotencyRef.current = { fingerprint, key: newIdempotencyKey() };
      }
      const input: PlaceOrderInput = {
        contact,
        marketingConsent,
        marketingTrackingConsent: metaConsent(config) === "granted",
        marketingTrackingId: metaTrackingId(config),
        method: m,
        lines,
        totals: { subtotal, discount, shipping, total },
        reviewedTotals: quote ?? undefined,
        currency: config.currency,
        locale,
        couponCode: couponCode.trim(),
        idempotencyKey: idempotencyRef.current.key,
      };
      if (!quote) {
        const freshQuote = await svc.quoteOrder(input);
        // Contact, cart, payment method or coupon changed while the quote was in flight.
        if (currentFingerprint.current !== fingerprint) return;
        setReviewedQuote({ fingerprint, quote: freshQuote });
        return;
      }
      const result = await svc.placeOrder(input);
      trackStorefrontEvent({
        eventType: "order_submitted",
        orderId: result.order.reference,
        contentIds: lines.map((line) => line.productRef),
        properties: { cart_value: result.order.totals.total, currency: result.order.currency, quantity: lines.reduce((sum, line) => sum + line.qty, 0), payment_mode: m === "cod" ? "cod" : "online_pending" },
      });
      if (result.paymentUnavailable) {
        setPendingOrderId(result.order.reference);
        savePendingOrder(result.order);
        setFailed(t(locale, "checkout.genericError"));
        return;
      }
      if (result.paymentUrl) {
        // Hosted payment — keep a snapshot so the return page can render the
        // confirmation, then leave for the gateway.
        setPendingOrderId(result.order.reference);
        savePendingOrder(result.order);
        window.location.href = result.paymentUrl;
        return;
      }
      clearPendingOrder();
      setPendingOrderId(null);
      setOrder(result.order);
      idempotencyRef.current = null;
      onOrderComplete();
    } catch (error) {
      // Keep the reviewed payload after a transport failure so the same
      // idempotency key can recover an order whose response was lost.
      if (error instanceof ApiError && (error.status === 400 || error.status === 409)) setReviewedQuote(null);
      if (error instanceof ApiError && (error.code === "coupon_code" || error.fields.coupon_code)) {
        setCouponError(t(locale, "checkout.couponInvalid"));
      } else {
        setCheckoutError(checkoutFailureMessage(error, locale));
      }
    } finally {
      submittingRef.current = false;
      setProcessing(null);
    }
  }

  async function retryPayment() {
    const oid = pendingOrderId ?? orderIdFromUrl();
    if (!oid || processing) return;
    setFailed(null);
    setProcessing("verify");
    try {
      const url = await svc.retryPayment(oid, locale);
      setPendingOrderId(oid);
      window.location.href = url;
    } catch {
      setProcessing(null);
      setFailed(t(locale, "checkout.genericError"));
    }
  }

  function handleClose() {
    if (closing) return;
    const oid = pendingOrderId ?? orderIdFromUrl();
    if (oid) {
      // Only cancels if the order is still pending — a failed/cancelled order
      // is a no-op server-side, and confirmed orders just return 423.
      void svc.cancelOrder(oid).catch(() => {});
    }
    clearPendingOrder();
    setPendingOrderId(null);
    setOrder(null);
    setTracking(false);
    setFailed(null);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onClose(); return; }
    setClosing(true);
    window.setTimeout(onClose, 220);
  }

  /* ---- render helpers ---- */

  const money = (n: number) => formatPrice(n, locale, quote?.currency ?? config.currency);
  const shippingRow = shipping === 0 ? (
    <span className="sf-co-free">{t(locale, "checkout.shippingFree")}</span>
  ) : (
    money(shipping)
  );

  if (!open) return null;

  return (
    <div className={`sf-root sf-co-root sf-co-overlay is-open${closing ? " is-closing" : ""} ${isRtl ? "sf-rtl" : ""}`} data-design={config.design} dir={dir(locale)}>
      <div className="sf-co-scrim" onClick={handleClose} aria-hidden="true" />
      <section className="sf-co-panel" role="dialog" aria-modal="true" aria-label={t(locale, "checkout.title")}>
        <button className="sf-icon-btn sf-co-close" onClick={handleClose} aria-label="Close">
          <IconClose />
        </button>

        {processing && (
          <div className="sf-co-pay-overlay">
            <div className="sf-co-pay-card">
              <div className="sf-co-pay-icon-wrap">
                <Spinner />
                <span className="sf-co-pay-icon">{processing === "card" || processing === "verify" ? <IconShield /> : <IconPackage />}</span>
              </div>
              <div className="sf-co-pay-title">
                {processing === "quote"
                  ? t(locale, "checkout.processingQuote")
                  : processing === "card"
                  ? t(locale, "checkout.processingCard")
                  : processing === "verify"
                    ? t(locale, "checkout.processingVerify")
                    : t(locale, "checkout.processingCod")}
              </div>
              <div className="sf-co-pay-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {order && tracking ? (
          <TrackingView
            order={order}
            locale={locale}
            money={money}
            onBack={() => setTracking(false)}
          />
        ) : order ? (
          <Confirmation
            order={order}
            locale={locale}
            isRtl={isRtl}
            money={money}
            onClose={onClose}
            onTrack={() => setTracking(true)}
          />
        ) : failed ? (
          <Failure
            message={failed}
            locale={locale}
            onRetry={() => void retryPayment()}
            onCod={() => {
              setFailed(null);
              void placeOrder("cod");
            }}
            onClose={handleClose}
          />
        ) : items.length === 0 ? (
          <div className="sf-co-empty">
            <h2 className="ds-display-3">{t(locale, "checkout.empty")}</h2>
            <button className="ds-btn ds-btn-primary" onClick={handleClose}>
              {t(locale, "checkout.backToStore")}
            </button>
          </div>
        ) : (
          <div className="sf-co-main">
            <div className="sf-co-steps">
              <StepChip n={1} done={locked} active={!locked} label={t(locale, "checkout.stepShipping")} />
              <StepChip n={2} done={false} active={locked} label={t(locale, "checkout.stepPayment")} />
            </div>

            <div className="sf-co-layout">
              <form
                className="sf-co-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveContact();
                }}
              >
                <div className="sf-co-card-head">
                  <div>
                    <div className="sf-co-step-tag">{t(locale, "checkout.stepShipping")}</div>
                    <h2 className="sf-co-card-title">{t(locale, "checkout.title")}</h2>
                  </div>
                  {locked && (
                    <button
                      type="button"
                      className="sf-co-link"
                      onClick={() => {
                        setLocked(false);
                        setMethod(undefined);
                      }}
                    >
                      {t(locale, "checkout.edit")}
                    </button>
                  )}
                </div>

                <div className="sf-co-grid">
                  <Field
                    label={t(locale, "checkout.firstName")}
                    error={contactErrors.firstName}
                    readOnly={locked}
                    value={contact.firstName}
                    onChange={(v) => setContact((c) => ({ ...c, firstName: v }))}
                  />
                  <Field
                    label={t(locale, "checkout.lastName")}
                    error={contactErrors.lastName}
                    readOnly={locked}
                    value={contact.lastName}
                    onChange={(v) => setContact((c) => ({ ...c, lastName: v }))}
                  />
                  <Field
                    label={t(locale, "checkout.email")}
                    type="email"
                    error={contactErrors.email}
                    readOnly={locked}
                    value={contact.email}
                    onChange={(v) => setContact((c) => ({ ...c, email: v }))}
                  />
                  <PhoneField
                    label={t(locale, "checkout.phone")}
                    error={contactErrors.phone}
                    readOnly={locked}
                    value={contact.phone}
                    onChange={(v) => setContact((c) => ({ ...c, phone: v }))}
                  />
                  <Field
                    label={t(locale, "checkout.city")}
                    error={contactErrors.city}
                    readOnly={locked}
                    select={(config.serviceableCities?.length ?? 0) > 0}
                    options={config.serviceableCities ?? []}
                    value={contact.city}
                    placeholder={t(locale, "checkout.selectCity")}
                    onChange={(v) => setContact((c) => ({ ...c, city: v }))}
                  />
                  <Field
                    label={t(locale, "checkout.address")}
                    error={contactErrors.address}
                    readOnly={locked}
                    value={contact.address}
                    onChange={(v) => setContact((c) => ({ ...c, address: v }))}
                  />
                </div>

                {!locked && (
                  <label className={`sf-co-policy ${policies ? "is-checked" : ""} ${policiesError ? "is-error" : ""}`}>
                    <input
                      type="checkbox"
                      checked={policies}
                      onChange={(e) => {
                        setPolicies(e.target.checked);
                        setPoliciesError(false);
                      }}
                    />
                    <span className="sf-co-policy-box">{policies && <IconCheck />}</span>
                    <span>{t(locale, "checkout.policies")}</span>
                  </label>
                )}

                {!locked && (
                  <label className={`sf-co-policy ${marketingConsent ? "is-checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                    />
                    <span className="sf-co-policy-box">{marketingConsent && <IconCheck />}</span>
                    <span>{t(locale, "checkout.marketingConsent")}</span>
                  </label>
                )}

                {!locked && (
                  <button type="submit" className="ds-btn ds-btn-primary sf-co-save">
                    {t(locale, "checkout.saveContinue")}
                  </button>
                )}
                {locked && (
                  <div className="sf-co-saved">
                    <IconCheck />
                    {t(locale, "checkout.contactSaved")}
                  </div>
                )}
              </form>

              <div className="sf-co-side">
                <div className="sf-co-card">
                  <div className="sf-co-card-head">
                    <div>
                      <div className="sf-co-step-tag">{t(locale, "checkout.stepPayment")}</div>
                      <h2 className="sf-co-card-title">{t(locale, "checkout.title")}</h2>
                    </div>
                  </div>

                  {(config.payment?.cod ?? true) && <button
                    type="button"
                    className={`sf-co-method ${method === "cod" ? "is-active" : ""}`}
                    disabled={!locked}
                    onClick={() => setMethod("cod")}
                  >
                    <span className="sf-co-method-icon"><IconPackage /></span>
                    <span className="sf-co-method-copy">
                      <span className="sf-co-method-label">{t(locale, "checkout.cod")}</span>
                      <span className="sf-co-method-sub">{t(locale, "checkout.codSub")}</span>
                    </span>
                    <span className="sf-co-radio">{method === "cod" && <i />}</span>
                  </button>}

                  <button
                    type="button"
                    className={`sf-co-method ${method === "card" ? "is-active" : ""}`}
                    disabled={!locked || !(config.payment?.online ?? true)}
                    onClick={() => setMethod("card")}
                  >
                    <span className="sf-co-method-icon"><IconCard /></span>
                    <span className="sf-co-method-copy">
                      <span className="sf-co-method-label">{t(locale, "checkout.card")}</span>
                      <span className="sf-co-method-sub">{t(locale, "checkout.cardSub")}</span>
                    </span>
                    <span className="sf-co-radio">{method === "card" && <i />}</span>
                  </button>
                </div>

                <div className="sf-co-card sf-co-summary">
                  <h2 className="sf-co-card-title">{t(locale, "checkout.title")}</h2>
                  <label className={`sf-co-coupon${couponError ? " is-error" : ""}`}>
                    <span>{t(locale, "checkout.couponLabel")}</span>
                    <input
                      type="text"
                      value={couponCode}
                      autoComplete="off"
                      placeholder={t(locale, "checkout.couponPlaceholder")}
                      onChange={(event) => {
                        setCouponCode(event.target.value.toLocaleUpperCase());
                        setCouponError("");
                        setCheckoutError("");
                      }}
                    />
                    <small>{couponError || t(locale, "checkout.couponHint")}</small>
                  </label>
                  <div className="sf-co-sumrow">
                    <span>{t(locale, "checkout.subtotal")}</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  {quote && discount > 0 && <div className="sf-co-sumrow">
                    <span>{t(locale, "checkout.discount")}{quote.couponCode ? ` · ${quote.couponCode}` : ""}</span>
                    <span>−{money(discount)}</span>
                  </div>}
                  <div className="sf-co-sumrow">
                    <span>{t(locale, "checkout.shipping")}</span>
                    {shippingRow}
                  </div>
                  {tax > 0 && <div className="sf-co-sumrow"><span>{locale === "fr" ? "TVA" : locale === "ar" ? "الضريبة" : "Tax"}</span><span>{money(tax)}</span></div>}
                  <div className="sf-co-divider" />
                  <div className="sf-co-sumrow sf-co-total">
                    <span>{t(locale, "checkout.total")}</span>
                    <strong>{money(total)}</strong>
                  </div>
                </div>

                {checkoutError && <p className="sf-co-error" role="alert">{checkoutError}</p>}
                <button
                  type="button"
                  className={`ds-btn ds-btn-primary sf-co-pay ${locked && method ? "is-ready" : ""}`}
                  disabled={!locked || !method || processing !== null}
                  onClick={() => void placeOrder()}
                >
                  {!quote ? t(locale, "checkout.reviewOrder")
                    : method === "cod" ? t(locale, "checkout.confirmOrder", money(total))
                      : t(locale, "checkout.pay", money(total))}
                </button>

                {quote && <p className="sf-co-saved" role="status">{t(locale, "checkout.reviewReady")}</p>}
                <div className="sf-co-secure">
                  <LockIcon />
                  {t(locale, "checkout.secure")}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepChip({ n, done, active, label }: { n: number; done: boolean; active: boolean; label: string }) {
  return (
    <div className="sf-co-step">
      <span className={`sf-co-step-circle ${done ? "is-done" : active ? "is-active" : ""}`}>
        {done ? <IconCheck /> : n}
      </span>
      <span className={`sf-co-step-label ${active ? "is-active" : done ? "is-done" : ""}`}>{label}</span>
    </div>
  );
}

function Confirmation({
  order,
  locale,
  isRtl,
  money,
  onClose,
  onTrack,
}: {
  order: CheckoutOrder;
  locale: Locale;
  isRtl: boolean;
  money: (n: number) => string;
  onClose: () => void;
  onTrack: () => void;
}) {
  const isPending = order.status === "pending";
  const timeline = [
    t(locale, isPending ? "checkout.statusReceived" : "checkout.statusConfirmed"),
    t(locale, "checkout.statusPacking"),
    t(locale, "checkout.statusShipped"),
    t(locale, "checkout.statusDelivered"),
  ];
  return (
    <div className="sf-co-success">
      <div className="sf-co-success-icon"><IconCheck /></div>
      <h2 className="ds-display-3">{t(locale, isPending ? "checkout.orderReceived" : "checkout.orderConfirmed")}</h2>
      <p className="sf-co-ref">{order.reference}</p>
      <p className="ds-body sf-co-success-msg">
        {t(locale, isPending ? "checkout.awaitingConfirmation" : "checkout.emailSent", order.contact.email)}
      </p>
      {order.hasAdjustments && <p className="sf-co-adjustment-note" role="status">{t(locale, "checkout.quantityAdjusted")}</p>}

      <div className="sf-co-timeline" dir={isRtl ? "rtl" : "ltr"}>
        {timeline.map((label, i) => (
          <div key={label} className={`sf-co-tl-step ${i === 0 ? "is-active" : ""}`}>
            <span className="sf-co-tl-dot" />
            <span className="sf-co-tl-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="sf-co-card sf-co-success-card">
        <h3 className="sf-co-card-title">{t(locale, "checkout.orderItems")}</h3>
        {order.lines.map((l) => (
          <div key={`${l.id}-${l.variant}`} className="sf-co-line">
            <div className="sf-co-line-name">
              {l.name}
              {l.variant && <span className="sf-co-line-variant">{l.variant}</span>}
            </div>
            <div className="sf-co-line-side">
              <span className="sf-co-line-qty">×{l.qty}</span>
              <span className="sf-co-line-price">{money(l.unitPrice * l.qty)}</span>
            </div>
          </div>
        ))}
        <div className="sf-co-divider" />
        <div className="sf-co-sumrow"><span>{t(locale, "checkout.subtotal")}</span><span>{money(order.totals.subtotal)}</span></div>
        {order.totals.discount > 0 && <div className="sf-co-sumrow sf-co-discount"><span>{t(locale, "checkout.discount")}{order.couponCode ? ` · ${order.couponCode}` : ""}</span><span>−{money(order.totals.discount)}</span></div>}
        <div className="sf-co-sumrow"><span>{t(locale, "checkout.shipping")}</span><span>{money(order.totals.shipping)}</span></div>
        {(order.totals.tax ?? 0) > 0 && <div className="sf-co-sumrow"><span>{locale === "fr" ? "TVA" : locale === "ar" ? "الضريبة" : "Tax"}</span><span>{money(order.totals.tax ?? 0)}</span></div>}
        <div className="sf-co-sumrow sf-co-total"><span>{t(locale, "checkout.total")}</span><strong>{money(order.totals.total)}</strong></div>
      </div>

      <div className="sf-co-card sf-co-success-card">
        <h3 className="sf-co-card-title">{t(locale, "checkout.shipTo")}</h3>
        <p className="sf-co-address">
          {order.contact.firstName} {order.contact.lastName}
          <br />
          {order.contact.address}, {order.contact.city}
          <br />
          {order.contact.phone}
        </p>
        <p className="sf-co-eta">{t(locale, "checkout.eta")}</p>
      </div>

      <div className="sf-co-success-actions">
        <button className="ds-btn ds-btn-secondary" onClick={onTrack}>
          {t(locale, "checkout.trackOrder")}
        </button>
        <button className="ds-btn ds-btn-primary" onClick={onClose}>
          {t(locale, "checkout.backToStore")}
        </button>
      </div>
    </div>
  );
}

function TrackingView({
  order,
  locale,
  money,
  onBack,
}: {
  order: CheckoutOrder;
  locale: Locale;
  money: (n: number) => string;
  onBack: () => void;
}) {
  const svc = useMemo(() => createCheckoutService(), []);
  const [fresh, setFresh] = useState<CheckoutOrder | null>(order);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    svc
      .getOrder(order.reference)
      .then((freshOrder) => {
        if (alive) setFresh(freshOrder);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [svc, order.reference]);

  const activeStage = fresh?.status === "delivered"
    ? 3
    : fresh?.status === "shipped"
      ? 2
      : fresh?.status === "confirmed"
        ? 1
        : fresh?.status === "pending"
          ? 0
          : -1;
  const timeline = [
    t(locale, fresh?.status === "pending" ? "checkout.statusReceived" : "checkout.statusConfirmed"),
    t(locale, "checkout.statusPacking"),
    t(locale, "checkout.statusShipped"),
    t(locale, "checkout.statusDelivered"),
  ];
  return (
    <div className="sf-co-success sf-co-tracking">
      <div className="sf-co-tracking-head">
        <div>
          <h2 className="ds-display-3">{t(locale, "checkout.trackOrder")}</h2>
          <p className="sf-co-ref">{fresh?.reference ?? order.reference}</p>
        </div>
        <button className="ds-btn ds-btn-secondary" onClick={onBack}>
          {t(locale, "checkout.trackBack")}
        </button>
      </div>
      {failed ? (
        <p className="ds-body">{t(locale, "checkout.genericError")}</p>
      ) : (
        <div className="sf-co-timeline" dir="ltr">
          {timeline.map((label, i) => (
            <div key={label} className={`sf-co-tl-step ${i < activeStage ? "is-complete" : ""} ${i === activeStage ? "is-active" : ""}`}>
              <span className="sf-co-tl-dot" />
              <span className="sf-co-tl-label">{label}</span>
            </div>
          ))}
        </div>
      )}
      {fresh?.hasAdjustments && <p className="sf-co-adjustment-note" role="status">{t(locale, "checkout.quantityAdjusted")}</p>}
      <div className="sf-co-card sf-co-success-card">
        <h3 className="sf-co-card-title">{fresh?.reference ?? order.reference}</h3>
        {fresh?.trackingNumber && (
          <p className="sf-co-tracking-reference">
            {t(locale, "auth.tracking", fresh.carrier || "—", fresh.trackingNumber)}
          </p>
        )}
        {(fresh ?? order).lines.map((l) => (
          <div key={`${l.id}-${l.variant}`} className="sf-co-line">
            <div className="sf-co-line-name">
              {l.name}
              {l.variant && <span className="sf-co-line-variant">{l.variant}</span>}
            </div>
            <div className="sf-co-line-side">
              <span className="sf-co-line-qty">×{l.qty}</span>
              <span className="sf-co-line-price">{money(l.unitPrice * l.qty)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Failure({
  message,
  locale,
  onRetry,
  onCod,
  onClose,
}: {
  message: string;
  locale: Locale;
  onRetry: () => void;
  onCod: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sf-co-failure">
      <div className="sf-co-failure-icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.3 3.5 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      </div>
      <h2 className="ds-display-3">{t(locale, "checkout.paymentFailed")}</h2>
      <p className="ds-body">{t(locale, "checkout.failedMsg")}</p>
      <p className="sf-co-error sf-co-failure-msg">{message}</p>
      <div className="sf-co-success-actions">
        <button className="ds-btn ds-btn-secondary" onClick={onRetry}>
          {t(locale, "checkout.tryAgain")}
        </button>
        <button className="ds-btn ds-btn-primary" onClick={onCod}>
          {t(locale, "checkout.useCod")}
        </button>
        <button className="sf-co-link" onClick={onClose}>
          {t(locale, "checkout.backToStore")}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  readOnly,
  type = "text",
  inputMode,
  select,
  options = [],
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  readOnly?: boolean;
  type?: string;
  inputMode?: "numeric" | "email" | "tel";
  select?: boolean;
  options?: readonly string[];
  placeholder?: string;
  className?: string;
}) {
  const cls = `sf-co-field ${error ? "is-error" : ""} ${readOnly ? "is-locked" : ""} ${className}`.trim();
  if (select) {
    return (
      <label className={cls}>
        <span className="sf-co-field-label">{label}</span>
        <select
          value={value}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder ?? ""}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <FieldError msg={error} />
      </label>
    );
  }
  return (
    <label className={cls}>
      <span className="sf-co-field-label">{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError msg={error} />
    </label>
  );
}

function PhoneField({ label, value, onChange, error, readOnly }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}) {
  const locale = useLocale();
  const labels = locale === "ar" ? phoneLabelsAr : locale === "fr" ? phoneLabelsFr : phoneLabelsEn;
  return (
    <label className={`sf-co-field ${error ? "is-error" : ""} ${readOnly ? "is-locked" : ""}`.trim()}>
      <span className="sf-co-field-label">{label}</span>
      <PhoneInput
        international
        defaultCountry="MA"
        countryCallingCodeEditable={false}
        labels={labels}
        value={(value || undefined) as PhoneValue | undefined}
        disabled={readOnly}
        onChange={(next) => onChange(next ?? "")}
      />
      <FieldError msg={error} />
    </label>
  );
}
