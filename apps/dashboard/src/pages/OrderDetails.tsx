import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCheck, FiClock, FiDownload, FiPackage, FiSave, FiTruck, FiUser, FiX } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";
import { api, type Order } from "../api/client";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAsync } from "../hooks/useAsync";
import { useStore } from "../Layout";
import { fmtMoney, t, timeAgo, useLocale } from "../i18n";
import { friendlyError } from "../utils/errors";
import { ModalShell } from "../components/ModalShell";

function statusClass(status: Order["status"]) {
  if (status === "cancelled") return "badge-danger";
  if (status === "pending") return "badge-warning";
  if (status === "shipped") return "badge-info";
  return "badge-success";
}

export function OrderDetailsPage() {
  const { orderId = "" } = useParams();
  const { store } = useStore();
  const locale = useLocale();
  const toast = useToast();
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [invoiceLocale, setInvoiceLocale] = useState<"fr" | "en" | "ar">(
    locale === "ar" ? "ar" : locale === "en" ? "en" : "fr",
  );
  const [savingNotes, setSavingNotes] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: order, loading, error, reload } = useAsync<Order | null>(
    () => (store && orderId ? api.getOrder(store.id, orderId) : Promise.resolve(null)),
    [store?.id, orderId],
  );

  useEffect(() => {
    setNotes(order?.merchant_notes ?? "");
    setReviewed(new Set());
  }, [order?.order_id, order?.merchant_notes]);

  const allReviewed = useMemo(
    () => Boolean(order?.items.length) && order!.items.every((item) => reviewed.has(item.id)),
    [order, reviewed],
  );
  const paymentReady = order?.payment_mode === "cod" || order?.is_paid === "confirmed";

  function toggleItem(id: number) {
    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (!store || !order || !allReviewed || confirming) return;
    setConfirming(true);
    try {
      await api.orderAction(store.id, "confirm", {
        order_id: order.order_id,
        acknowledged_item_ids: order.items.map((item) => item.id),
        invoice_locale: invoiceLocale,
      });
      setConfirmOpen(false);
      toast.push("success", t(locale, "orders.confirmedToast"));
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "orders.actionFailed"));
    } finally {
      setConfirming(false);
    }
  }

  function openConfirm() {
    setInvoiceLocale(order?.invoice_locale || (locale === "ar" ? "ar" : locale === "en" ? "en" : "fr"));
    setConfirmOpen(true);
  }

  async function saveNotes() {
    if (!store || !order || savingNotes) return;
    setSavingNotes(true);
    try {
      await api.updateOrderNotes(store.id, order.order_id, notes);
      toast.push("success", t(locale, "orders.notesSaved"));
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "orders.notesFailed"));
    } finally {
      setSavingNotes(false);
    }
  }

  async function downloadInvoice() {
    if (!store || !order?.invoice || order.invoice.status !== "ready" || downloadingInvoice) return;
    setDownloadingInvoice(true);
    try {
      const blob = await api.downloadMerchantInvoice(store.id, order.order_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${order.invoice.number}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "orders.actionFailed"));
    } finally {
      setDownloadingInvoice(false);
    }
  }

  if (loading) return <div className="card"><PageLoader /></div>;
  if (error || !order) return <EmptyState icon={<FiPackage />} title={t(locale, "orders.loadError")} sub={error ?? t(locale, "orders.notFound")} action={<Link className="btn btn-secondary" to="/orders"><FiArrowLeft /> {t(locale, "orders.backToOrders")}</Link>} />;

  const paidLabel = order.is_paid === "confirmed" ? t(locale, "orders.paid") : order.is_paid === "cod" ? t(locale, "orders.cod") : order.is_paid === "failed" ? t(locale, "orders.failed") : t(locale, "orders.pending");

  return <div className="order-detail-page">
    <div className="page-head">
      <div>
        <Link className="page-back-link" to="/orders"><FiArrowLeft /> {t(locale, "orders.backToOrders")}</Link>
        <h1 className="d-title">{t(locale, "orders.modalTitle", order.order_id.slice(0, 8))}</h1>
        <p className="d-subtitle">{timeAgo(order.created_at, locale)} · {order.payment_mode === "cod" ? t(locale, "orders.cod") : t(locale, "orders.online")}</p>
      </div>
      <div className="page-head-actions">
        {order.invoice?.status === "ready" && <button type="button" className="btn btn-secondary" disabled={downloadingInvoice} onClick={downloadInvoice}>{downloadingInvoice ? <span className="spin" /> : <FiDownload />} {locale === "fr" ? "Télécharger la facture" : locale === "ar" ? "تنزيل الفاتورة" : "Download invoice"}</button>}
        <span className={`badge ${statusClass(order.status)}`}>{t(locale, `orders.${order.status}`)}</span>
        <span className={`badge ${order.is_paid === "failed" ? "badge-danger" : order.is_paid === "pending" ? "badge-warning" : "badge-success"}`}>{paidLabel}</span>
      </div>
    </div>

    {order.status === "pending" && <section className="card order-review-card">
      <div className="d-card-head">
        <div><div className="d-card-title">{t(locale, "orders.reviewTitle")}</div><p>{t(locale, "orders.reviewSubtitle")}</p></div>
        <span className="order-review-count">{reviewed.size}/{order.items.length}</span>
      </div>
      <div className="order-review-list">
        {order.items.map((item) => <label className={`order-review-item${reviewed.has(item.id) ? " is-reviewed" : ""}`} key={item.id}>
          <input type="checkbox" checked={reviewed.has(item.id)} onChange={() => toggleItem(item.id)} />
          <span className="order-review-check">{reviewed.has(item.id) && <FiCheck />}</span>
          <span className="order-review-copy">
            <strong>{item.name}</strong>
            <small>{item.ref} · {Object.entries(item.attributes ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</small>
            {item.fulfilled_quantity !== item.quantity && <small className="order-review-shortfall">{t(locale, "orders.fulfilledOfRequested", item.fulfilled_quantity, item.quantity)}</small>}
          </span>
          <span className="order-review-quantity">×{item.fulfilled_quantity}</span>
          <strong>{fmtMoney(item.price * item.fulfilled_quantity, order.currency, locale)}</strong>
        </label>)}
      </div>
      <div className="order-review-action">
        <p>{!paymentReady ? t(locale, "orders.paymentBeforeConfirm") : !allReviewed ? t(locale, "orders.reviewRequired") : t(locale, "orders.readyToConfirm")}</p>
        <button className="btn btn-primary" disabled={!allReviewed || !paymentReady || confirming} onClick={openConfirm}>{confirming ? <span className="spin" /> : <FiCheck />} {t(locale, "orders.confirmOrder")}</button>
      </div>
    </section>}

    <div className="order-detail-grid">
      <section className="card order-detail-section">
        <div className="d-card-head"><div className="d-card-title"><FiPackage /> {t(locale, "orders.items")}</div></div>
        {order.items.map((item) => <div className="order-line-detail" key={item.id}>
          <div><strong>{item.name}</strong><small>{item.ref}</small><small>{Object.entries(item.attributes ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "—"}</small>{item.fulfilled_quantity !== item.quantity && <small className="order-review-shortfall">{t(locale, "orders.fulfilledOfRequested", item.fulfilled_quantity, item.quantity)}</small>}</div>
          <span>×{item.fulfilled_quantity}</span>
          <strong>{fmtMoney(item.price * item.fulfilled_quantity, order.currency, locale)}</strong>
        </div>)}
        <div className="order-detail-total"><span>{t(locale, "orders.subtotal")}</span><strong>{fmtMoney(order.subtotal, order.currency, locale)}</strong></div>
        {(order.coupon_code || order.discount_amount > 0) && <div className="order-detail-total"><span>{t(locale, "orders.discount")}{order.coupon_code ? ` · ${order.coupon_code}` : ""}</span><strong>−{fmtMoney(order.discount_amount, order.currency, locale)}</strong></div>}
        <div className="order-detail-total"><span>{t(locale, "orders.shipping")}</span><strong>{fmtMoney(order.shipping_amount, order.currency, locale)}</strong></div>
        <div className="order-detail-total"><span>{t(locale, "orders.thTotal")}</span><strong>{fmtMoney(order.amount, order.currency, locale)}</strong></div>
      </section>

      <div className="order-detail-side">
        <section className="card order-detail-section">
          <div className="d-card-head"><div className="d-card-title"><FiUser /> {t(locale, "orders.customer")}</div></div>
          <dl className="detail-list"><div><dt>{t(locale, "customers.thCustomer")}</dt><dd>{order.customer_name || t(locale, "orders.guest")}</dd></div><div><dt>{t(locale, "customers.email")}</dt><dd>{order.customer_email || "—"}</dd></div><div><dt>{t(locale, "customers.phone")}</dt><dd>{order.customer_phone || "—"}</dd></div><div><dt>{t(locale, "customers.address")}</dt><dd>{[order.customer_address, order.customer_city].filter(Boolean).join(", ") || "—"}</dd></div></dl>
        </section>
        {(order.carrier || order.tracking_number) && <section className="card order-detail-section"><div className="d-card-head"><div className="d-card-title"><FiTruck /> {t(locale, "orders.tracking")}</div></div><dl className="detail-list"><div><dt>{t(locale, "orders.carrier")}</dt><dd>{order.carrier || "—"}</dd></div><div><dt>{t(locale, "orders.trackingNumber")}</dt><dd className="mono">{order.tracking_number || "—"}</dd></div></dl></section>}
      </div>
    </div>

    <div className="order-detail-grid">
      <section className="card order-detail-section"><div className="d-card-head"><div className="d-card-title"><FiClock /> {t(locale, "orders.timeline")}</div></div><div className="order-history-list">{order.status_history.length ? order.status_history.map((entry) => <div key={entry.id}><span className="order-history-dot" /><div><strong>{t(locale, `orders.${entry.to_status}`)}</strong><small>{entry.changed_by?.email ? `${entry.changed_by.email} · ` : ""}{timeAgo(entry.created_at, locale)}</small></div></div>) : <p>{t(locale, "orders.timelineEmpty")}</p>}</div></section>
      <section className="card order-detail-section"><div className="d-card-head"><div className="d-card-title">{t(locale, "orders.merchantNotes")}</div></div><div className="order-note-editor"><textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} /><button className="btn btn-secondary" disabled={savingNotes || notes === order.merchant_notes} onClick={saveNotes}>{savingNotes ? <span className="spin" /> : <FiSave />} {t(locale, "orders.saveNotes")}</button></div></section>
    </div>
    <ModalShell open={confirmOpen} onClose={() => setConfirmOpen(false)} busy={confirming} labelledBy="confirm-order-language-title" describedBy="confirm-order-language-description" maxWidth={460}>
      <div className="modal-head">
        <div>
          <h2 id="confirm-order-language-title" className="d-card-title">{t(locale, "orders.confirmOrder")}</h2>
          <p id="confirm-order-language-description" className="d-subtitle">{t(locale, "orders.invoiceLanguageHint")}</p>
        </div>
        <button type="button" className="icon-btn modal-close" onClick={() => setConfirmOpen(false)} disabled={confirming} aria-label={t(locale, "orders.close")}><FiX /></button>
      </div>
      <div className="modal-body">
        <label className="field">
          <span className="field-label">{t(locale, "orders.invoiceLanguage")}</span>
          <select className="select" value={invoiceLocale} onChange={(event) => setInvoiceLocale(event.target.value as "fr" | "en" | "ar")} data-modal-autofocus>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)} disabled={confirming}>{t(locale, "orders.cancel")}</button>
        <button type="button" className="btn btn-primary" onClick={confirm} disabled={confirming}>{confirming ? <span className="spin" /> : <FiCheck />} {t(locale, "orders.confirm")}</button>
      </div>
    </ModalShell>
  </div>;
}
