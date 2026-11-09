import { useCallback, useMemo, useState } from "react";
import { FiCheck, FiSearch, FiShoppingCart, FiTruck, FiPackage, FiX, FiEdit3, FiClock, FiAlertCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { api, type Order, type StoreMember } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { EmptyState, PageLoader, Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { t, fmtMoney, timeAgo, useLocale, type Locale } from "../i18n";
import { friendlyError } from "../utils/errors";
import { ModalShell, useLastPresent } from "../components/ModalShell";

function statusOf(o: Order, locale: Locale): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t(locale, "orders.pending"), cls: "badge-warning" },
    confirmed: { label: t(locale, "orders.confirmed"), cls: "badge-success" },
    shipped: { label: t(locale, "orders.shipped"), cls: "badge-info" },
    delivered: { label: t(locale, "orders.delivered"), cls: "badge-success" },
    cancelled: { label: t(locale, "orders.cancelled"), cls: "badge-danger" },
  };
  return map[o.status] ?? { label: o.status, cls: "" };
}

function modeLabel(o: Order, locale: Locale): string {
  return o.payment_mode === "cod" ? t(locale, "orders.cod") : t(locale, "orders.online");
}

const STEPS = ["pending", "confirmed", "shipped", "delivered"] as const;

function StatusTimeline({ order, locale }: { order: Order; locale: Locale }) {
  const history = order.status_history ?? [];
  if (history.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--ink-faint)", padding: "8px 0" }}>{t(locale, "orders.timelineEmpty")}</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {history.map((h, i) => {
        const from = statusOf({ status: h.from_status } as Order, locale);
        const to = statusOf({ status: h.to_status } as Order, locale);
        return (
          <div key={h.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < history.length - 1 ? "1px solid var(--hairline)" : undefined }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand)", marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>
                <span className={`badge ${from.cls}`} style={{ fontSize: 11 }}>{from.label}</span>
                <span style={{ color: "var(--ink-faint)", margin: "0 4px" }}>→</span>
                <span className={`badge ${to.cls}`} style={{ fontSize: 11 }}>{to.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>
                {h.changed_by?.email && <span>{h.changed_by.email} · </span>}
                {timeAgo(h.created_at, locale)}
                {h.notes && <span> · {h.notes}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type FilterKey = "all" | "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export function OrdersPage() {
  const { store } = useStore();
  const toast = useToast();
  const locale = useLocale();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shipId, setShipId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");

  const { data: orders, loading, error, reload } = useAsync<Order[]>(
    () => (store ? api.listOrders(store.id) : Promise.resolve([])),
    [store?.id],
  );

  const members: StoreMember[] = store?.members ?? [];
  const deliveryMembers = useMemo(() => members.filter((m) => m.role === "delivery"), [members]);

  const filtered = useMemo(() => {
    let list = orders ?? [];
    if (filter !== "all") list = list.filter((o) => o.status === filter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (o) =>
          o.customer_name?.toLowerCase().includes(needle) ||
          o.customer_email?.toLowerCase().includes(needle) ||
          o.order_id.includes(needle) ||
          o.customer_phone?.includes(needle),
      );
    }
    return list;
  }, [orders, filter, q]);

  const pendingCount = (orders ?? []).filter((o) => o.status === "pending").length;

  const withProcessing = useCallback(async (msg: string, fn: () => Promise<void>) => {
    setProcessingMsg(msg);
    setProcessing(true);
    try {
      await fn();
    } finally {
      setProcessing(false);
      setProcessingMsg("");
    }
  }, []);

  async function act(o: Order, action: "confirm" | "fail" | "ship" | "deliver" | "cancel", extra?: Record<string, unknown>): Promise<boolean> {
    if (!store) return false;
    let succeeded = false;
    const msgs: Record<string, string> = {
      confirm: t(locale, "orders.processingConfirm"),
      fail: t(locale, "orders.processingFail"),
      ship: t(locale, "orders.processingShip"),
      deliver: t(locale, "orders.processingDeliver"),
      cancel: t(locale, "orders.processingCancel"),
    };
    await withProcessing(msgs[action] || t(locale, "orders.processing"), async () => {
      try {
        await api.orderAction(store.id, action, { order_id: o.order_id, ...extra });
        const toastKey = { confirm: "confirmedToast", fail: "failedToast", ship: "shippedToast", deliver: "deliveredToast", cancel: "cancelledToast" }[action];
        toast.push("success", t(locale, `orders.${toastKey}`));
        succeeded = true;
        reload();
      } catch (err) {
        toast.push("error", friendlyError(err, locale, "orders.actionFailed"));
      }
    });
    return succeeded;
  }

  async function saveNotes(o: Order, notes: string) {
    if (!store) return;
    try {
      await api.updateOrderNotes(store.id, o.order_id, notes);
      toast.push("success", t(locale, "orders.notesSaved"));
      reload();
    } catch {
      toast.push("error", t(locale, "orders.notesFailed"));
    }
  }

  const open = openId ? (orders ?? []).find((o) => o.order_id === openId) ?? null : null;
  const shipOrder = shipId ? (orders ?? []).find((o) => o.order_id === shipId) ?? null : null;
  const cancelOrder = cancelId ? (orders ?? []).find((o) => o.order_id === cancelId) ?? null : null;
  const renderedOpen = useLastPresent(open);
  const renderedShipOrder = useLastPresent(shipOrder);
  const renderedCancelOrder = useLastPresent(cancelOrder);

  if (error) {
    return <EmptyState icon={<FiShoppingCart />} title={t(locale, "orders.loadError")} sub={error} action={<button className="btn btn-secondary" onClick={reload}>{t(locale, "errors.tryAgain")}</button>} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "orders.title")}</h1>
          <p className="d-subtitle">{loading ? <Skeleton style={{ height: 16, width: 200 }} /> : t(locale, "orders.subtitle", orders?.length ?? 0, pendingCount)}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch />
          <input className="input" placeholder={t(locale, "orders.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {(["all", "pending", "confirmed", "shipped", "delivered", "cancelled"] as const).map((f) => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {t(locale, `orders.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card"><PageLoader /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FiShoppingCart />} title={t(locale, "orders.none")} sub={q || filter !== "all" ? t(locale, "orders.noMatch") : t(locale, "orders.noneSub")} />
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t(locale, "orders.thOrder")}</th>
                <th>{t(locale, "orders.thCustomer")}</th>
                <th>{t(locale, "orders.thItems")}</th>
                <th>{t(locale, "orders.thTotal")}</th>
                <th>{t(locale, "orders.thPayment")}</th>
                <th>{t(locale, "orders.thStatus")}</th>
                <th>{t(locale, "orders.thDate")}</th>
                <th className="th-actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const st = statusOf(o, locale);
                const paidLabel = o.is_paid === "confirmed" ? t(locale, "orders.paid") : o.is_paid === "cod" ? t(locale, "orders.cod") : o.is_paid === "failed" ? t(locale, "orders.failed") : t(locale, "orders.pending");
                const paidCls = o.is_paid === "confirmed" ? "badge-success" : o.is_paid === "cod" ? "badge-info" : o.is_paid === "failed" ? "badge-danger" : "badge-warning";
                return (
                  <tr key={o.order_id} style={{ cursor: "pointer" }} onClick={() => setOpenId(o.order_id === openId ? null : o.order_id)}>
                    <td className="mono" style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>#{o.order_id.slice(0, 8)}</td>
                    <td>
                      <div className="row-main">{o.customer_name || t(locale, "orders.guest")}</div>
                      <div className="row-sub">{o.customer_city || "—"}</div>
                    </td>
                    <td className="tnum">{o.items.reduce((s, i) => s + i.fulfilled_quantity, 0)}</td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{fmtMoney(o.amount, o.currency, locale)}</td>
                    <td><span className={`badge ${paidCls}`}>{paidLabel}</span></td>
                    <td>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {o.exception && <span className="badge badge-warning" style={{ marginInlineStart: 6 }}>{t(locale, "orders.short")}</span>}
                    </td>
                    <td style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>{timeAgo(o.created_at, locale)}</td>
                    <td className="td-actions">
                      <div className="table-actions">
                        {o.status === "pending" && (
                          <>
                            <button className="btn btn-success btn-sm" style={{ background: "var(--success)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); navigate(`/orders/${o.order_id}?review=1`); }}>
                              <FiCheck /> {t(locale, "orders.confirm")}
                            </button>
                            {o.is_paid === "pending" ? <button className="btn btn-danger-ghost btn-sm" onClick={(e) => { e.stopPropagation(); act(o, "fail"); }}><FiX /> {t(locale, "orders.fail")}</button> : <button className="btn btn-danger-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setCancelId(o.order_id); }}><FiX /> {t(locale, "orders.cancel")}</button>}
                          </>
                        )}
                        {o.status === "confirmed" && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setShipId(o.order_id); }}>
                              <FiTruck /> {t(locale, "orders.ship")}
                            </button>
                            <button className="btn btn-danger-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setCancelId(o.order_id); }}>
                              <FiX /> {t(locale, "orders.cancel")}
                            </button>
                          </>
                        )}
                        {o.status === "shipped" && (
                          <button className="btn btn-success btn-sm" style={{ background: "var(--success)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); act(o, "deliver"); }}>
                            <FiPackage /> {t(locale, "orders.deliver")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Mobile cards (visible < 768px) ─────────────────────── */}
          <div className="m-cards">
            {filtered.map((o) => {
              const st = statusOf(o, locale);
              const paidLabel = o.is_paid === "confirmed" ? t(locale, "orders.paid") : o.is_paid === "cod" ? t(locale, "orders.cod") : o.is_paid === "failed" ? t(locale, "orders.failed") : t(locale, "orders.pending");
              const paidCls = o.is_paid === "confirmed" ? "badge-success" : o.is_paid === "cod" ? "badge-info" : o.is_paid === "failed" ? "badge-danger" : "badge-warning";
              return (
                <div className="m-card" key={o.order_id} onClick={() => setOpenId(o.order_id === openId ? null : o.order_id)}>
                  <div className="m-card-head">
                    <span className="m-card-id">#{o.order_id.slice(0, 8)}</span>
                    <span className="m-card-title">{o.customer_name || t(locale, "orders.guest")}</span>
                  </div>
                  <div className="m-card-badges">
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    <span className={`badge ${paidCls}`}>{paidLabel}</span>
                    {o.exception && <span className="badge badge-warning">{t(locale, "orders.short")}</span>}
                  </div>
                  <div className="m-card-row">
                    <span className="m-card-value">{fmtMoney(o.amount, o.currency, locale)}</span>
                    <span className="m-card-label">{timeAgo(o.created_at, locale)}</span>
                  </div>
                  {o.status === "pending" && (
                    <div className="m-card-actions">
                      <button className="btn btn-success btn-sm" style={{ background: "var(--success)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); navigate(`/orders/${o.order_id}?review=1`); }}>
                        <FiCheck /> {t(locale, "orders.confirm")}
                      </button>
                      {o.is_paid === "pending" ? <button className="btn btn-danger-ghost btn-sm" onClick={(e) => { e.stopPropagation(); act(o, "fail"); }}><FiX /> {t(locale, "orders.fail")}</button> : <button className="btn btn-danger-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setCancelId(o.order_id); }}><FiX /> {t(locale, "orders.cancel")}</button>}
                    </div>
                  )}
                  {o.status === "confirmed" && (
                    <div className="m-card-actions">
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setShipId(o.order_id); }}>
                        <FiTruck /> {t(locale, "orders.ship")}
                      </button>
                      <button className="btn btn-danger-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setCancelId(o.order_id); }}>
                        <FiX /> {t(locale, "orders.cancel")}
                      </button>
                    </div>
                  )}
                  {o.status === "shipped" && (
                    <div className="m-card-actions">
                      <button className="btn btn-success btn-sm" style={{ background: "var(--success)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); act(o, "deliver"); }}>
                        <FiPackage /> {t(locale, "orders.deliver")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {renderedOpen && <OrderDetailModal open={Boolean(open)} order={renderedOpen} locale={locale} saveNotes={saveNotes} onViewDetails={() => navigate(`/orders/${renderedOpen.order_id}`)} onClose={() => setOpenId(null)} />}
      {renderedShipOrder && <ShipModal open={Boolean(shipOrder)} order={renderedShipOrder} deliveryMembers={deliveryMembers} locale={locale} act={act} onClose={() => setShipId(null)} />}
      {renderedCancelOrder && <CancelModal open={Boolean(cancelOrder)} order={renderedCancelOrder} locale={locale} act={act} onClose={() => setCancelId(null)} />}

      <ModalShell open={processing} dismissible={false} busy labelledBy="order-processing-title" overlayClassName="order-processing-overlay" panelClassName="order-processing-modal" maxWidth={320}>
          <div style={{ padding: 32, textAlign: "center" }}>
            <div className="spin" style={{ margin: "0 auto 16px", width: 32, height: 32, border: "3px solid var(--hairline)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin .6s linear infinite" }} />
            <div id="order-processing-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{processingMsg}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 6 }}>{t(locale, "orders.pleaseWait")}</div>
          </div>
      </ModalShell>
    </div>
  );
}

/* ── Order Detail Modal ─────────────────────────────────────────────── */

function OrderDetailModal({
  open, order, locale, saveNotes, onViewDetails, onClose,
}: {
  open: boolean;
  order: Order;
  locale: Locale;
  saveNotes: (o: Order, notes: string) => Promise<void>;
  onViewDetails: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(order.merchant_notes || "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [tab, setTab] = useState<"details" | "timeline">("details");
  const stepIdx = STEPS.indexOf(order.status as typeof STEPS[number]);

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="order-detail-title" panelClassName="order-modal">
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="order-detail-title" className="d-card-title">{t(locale, "orders.modalTitle", order.order_id.slice(0, 8))}</div>
            <div className="row-sub" style={{ fontSize: 12 }}>{timeAgo(order.created_at, locale)} · {modeLabel(order, locale)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`badge ${statusOf(order, locale).cls}`}>{statusOf(order, locale).label}</span>
            <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: "6px 8px" }}>
              <FiX size={16} />
            </button>
          </div>
        </div>

        {order.status !== "cancelled" && (
          <div className="order-steps">
            {STEPS.map((s, i) => {
              const done = stepIdx >= i;
              const active = stepIdx === i;
              return (
                <div key={s} className={`order-step${done ? " done" : ""}${active ? " active" : ""}`}>
                  <div className="order-step-dot">{done ? <FiCheck /> : <span>{i + 1}</span>}</div>
                  <div className="order-step-label">{t(locale, `orders.steps${s.charAt(0).toUpperCase() + s.slice(1)}`)}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="order-tabs">
          <button className={`order-tab${tab === "details" ? " active" : ""}`} onClick={() => setTab("details")}>{t(locale, "orders.items")}</button>
          <button className={`order-tab${tab === "timeline" ? " active" : ""}`} onClick={() => setTab("timeline")}><FiClock /> {t(locale, "orders.timeline")}</button>
        </div>

        <div className="modal-body" style={{ maxHeight: "50vh", overflow: "auto" }}>
          {tab === "details" ? (
            <>
              <div className="d-eyebrow" style={{ marginBottom: 10 }}>{t(locale, "orders.items")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 }}>
                {order.items.map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{it.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        {it.ref && <span className="mono">{it.ref}</span>}
                        {it.attributes && Object.keys(it.attributes).length > 0 && (
                          <span style={{ marginInlineStart: 6 }}>
                            {Object.entries(it.attributes).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{fmtMoney(it.price * it.fulfilled_quantity, order.currency, locale)}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        {fmtMoney(it.price, order.currency, locale)} × {it.fulfilled_quantity}
                      </div>
                      {it.fulfilled_quantity !== it.quantity && <div style={{ fontSize: 11.5, color: "var(--warning)", marginTop: 2 }}>{t(locale, "orders.fulfilledOfRequested", it.fulfilled_quantity, it.quantity)}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="ordersum"><span>{t(locale, "orders.subtotal")}</span><b>{fmtMoney(order.subtotal, order.currency, locale)}</b></div>
              {order.discount_amount > 0 && <div className="ordersum" style={{ color: "var(--success)" }}><span>{t(locale, "orders.discount")}{order.coupon_code ? ` · ${order.coupon_code}` : ""}</span><b>−{fmtMoney(order.discount_amount, order.currency, locale)}</b></div>}
              <div className="ordersum"><span>{t(locale, "orders.shipping")}</span><b>{fmtMoney(order.shipping_amount, order.currency, locale)}</b></div>
              <div className="ordersum"><span>{t(locale, "orders.payment")}</span><b>{modeLabel(order, locale)}</b></div>
              <div className="ordersum"><span>{t(locale, "orders.paymentStatus")}</span><b>{order.is_paid === "confirmed" ? t(locale, "orders.paid") : order.is_paid === "cod" ? t(locale, "orders.cod") : order.is_paid === "failed" ? t(locale, "orders.failed") : t(locale, "orders.pending")}</b></div>
              {order.exceptions.length > 0 && (
                <div className="ordersum"><span style={{ color: "var(--warning)" }}>{t(locale, "orders.shortfalls")}</span><b>{order.exceptions.length}</b></div>
              )}
              <div className="ordersum total"><span>{t(locale, "orders.thTotal")}</span><b>{fmtMoney(order.amount, order.currency, locale)}</b></div>

              <div className="d-eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>{t(locale, "orders.customer")}</div>
              <div className="card" style={{ padding: 14, fontSize: 13 }}>
                <div className="row-main">{order.customer_name || t(locale, "orders.guest")}</div>
                <div className="row-sub">{order.customer_email || "—"}</div>
                <div className="row-sub">{[order.customer_phone, order.customer_city, order.customer_address].filter(Boolean).join(" · ") || "—"}</div>
                {order.customer_notes && <div className="row-sub" style={{ marginTop: 6, fontStyle: "italic" }}>"{order.customer_notes}"</div>}
              </div>

              {order.delivery_person && (
                <>
                  <div className="d-eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>{t(locale, "orders.deliveryPerson")}</div>
                  <div className="card" style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{(order.delivery_person.email || "?")[0].toUpperCase()}</div>
                      <div>
                        <div className="row-main" style={{ fontSize: 13 }}>{order.delivery_person.email}</div>
                        <div className="row-sub" style={{ fontSize: 12 }}>{t(locale, `roles.${order.delivery_person.role}`)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {(order.tracking_number || order.carrier) && (
                <>
                  <div className="d-eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>{t(locale, "orders.tracking")}</div>
                  <div className="card" style={{ padding: 14, fontSize: 13 }}>
                    {order.carrier && <div className="row-sub">{order.carrier}</div>}
                    {order.tracking_number && <div className="mono">{order.tracking_number}</div>}
                  </div>
                </>
              )}

              <div className="d-eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>{t(locale, "orders.merchantNotes")}</div>
              <textarea
                className="textarea"
                style={{ minHeight: 60 }}
                placeholder={t(locale, "orders.merchantNotes") + "…"}
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
              />
              {notesDirty && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { saveNotes(order, notes); setNotesDirty(false); }}>
                    <FiEdit3 /> {t(locale, "orders.saveNotes")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <StatusTimeline order={order} locale={locale} />
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-primary" onClick={onViewDetails}>{t(locale, "orders.viewDetails")}</button>
          <button className="btn btn-secondary" onClick={onClose}><FiX style={{ marginInlineEnd: 6 }} />{t(locale, "orders.close")}</button>
        </div>
    </ModalShell>
  );
}

/* ── Ship Modal ─────────────────────────────────────────────────────── */

function ShipModal({
  open, order, deliveryMembers, locale, act, onClose,
}: {
  open: boolean;
  order: Order;
  deliveryMembers: StoreMember[];
  locale: Locale;
  act: (o: Order, action: "ship", extra?: Record<string, unknown>) => Promise<boolean>;
  onClose: () => void;
}) {
  const [tracking, setTracking] = useState(order.tracking_number);
  const [carrier, setCarrier] = useState(order.carrier);
  const [deliveryId, setDeliveryId] = useState<number | null>(order.delivery_person?.id ?? null);
  const [submitted, setSubmitted] = useState(false);

  const trackingMissing = !tracking.trim();
  const carrierMissing = !carrier.trim();
  const deliveryMissing = deliveryId === null;
  const canSubmit = !trackingMissing && !carrierMissing && !deliveryMissing;

  async function submit() {
    setSubmitted(true);
    if (!canSubmit) return;
    const succeeded = await act(order, "ship", { tracking_number: tracking.trim(), carrier: carrier.trim(), delivery_person_id: deliveryId });
    if (succeeded) onClose();
  }

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="ship-order-title" maxWidth={480}>
        <div className="modal-head">
          <div id="ship-order-title" className="d-card-title"><FiTruck style={{ marginInlineEnd: 8 }} />{t(locale, "orders.shipOrder")}</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: "6px 8px" }}>
            <FiX size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 16 }}>
            {t(locale, "orders.modalTitle", order.order_id.slice(0, 8))} · {fmtMoney(order.amount, order.currency, locale)}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="field-label">{t(locale, "orders.assignDelivery")} *</label>
              <select className="input" value={deliveryId ?? ""} onChange={(e) => setDeliveryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{t(locale, "orders.selectDelivery")}</option>
                {deliveryMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.email}</option>
                ))}
              </select>
              {submitted && deliveryMissing && <span className="field-error" role="alert">{t(locale, "orders.deliveryRequired")}</span>}
              {deliveryMembers.length === 0 && (
                <span className="field-hint" style={{ color: "var(--warning)" }}>{t(locale, "orders.noDeliveryMembers")}</span>
              )}
            </div>
            <div className="editor-row">
              <div className="field">
                <label className="field-label">{t(locale, "orders.trackingNumber")} *</label>
                <input className={`input${submitted && trackingMissing ? " is-invalid" : ""}`} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder={t(locale, "orders.trackingPlaceholder")} aria-invalid={submitted && trackingMissing} />
                {submitted && trackingMissing && <span className="field-error" role="alert">{t(locale, "orders.trackingRequired")}</span>}
              </div>
              <div className="field">
                <label className="field-label">{t(locale, "orders.carrier")} *</label>
                <input className={`input${submitted && carrierMissing ? " is-invalid" : ""}`} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={t(locale, "orders.carrierPlaceholder")} aria-invalid={submitted && carrierMissing} />
                {submitted && carrierMissing && <span className="field-error" role="alert">{t(locale, "orders.carrierRequired")}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={onClose}><FiX style={{ marginInlineEnd: 6 }} />{t(locale, "orders.close")}</button>
          <button className="btn btn-primary" onClick={submit}>
            <FiTruck /> {t(locale, "orders.confirmShip")}
          </button>
        </div>
    </ModalShell>
  );
}

/* ── Cancel Modal ───────────────────────────────────────────────────── */

function CancelModal({
  open, order, locale, act, onClose,
}: {
  open: boolean;
  order: Order;
  locale: Locale;
  act: (o: Order, action: "cancel", extra?: Record<string, unknown>) => Promise<boolean>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  const canSubmit = reason.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    const succeeded = await act(order, "cancel", { reason });
    if (succeeded) onClose();
  }

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="cancel-order-title" maxWidth={440}>
        <div className="modal-head">
          <div id="cancel-order-title" className="d-card-title" style={{ color: "var(--danger)" }}><FiAlertCircle style={{ marginInlineEnd: 8 }} />{t(locale, "orders.cancelOrder")}</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: "6px 8px" }}>
            <FiX size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 16 }}>
            {t(locale, "orders.modalTitle", order.order_id.slice(0, 8))} · {fmtMoney(order.amount, order.currency, locale)}
          </p>
          <label className="field-label">{t(locale, "orders.cancelReason")} *</label>
          <textarea
            className="textarea"
            style={{ minHeight: 80 }}
            placeholder={t(locale, "orders.cancelReasonPh")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={onClose}><FiX style={{ marginInlineEnd: 6 }} />{t(locale, "orders.close")}</button>
          <button className="btn btn-danger" onClick={submit} disabled={!canSubmit}>
            <FiX /> {t(locale, "orders.cancelOrder")}
          </button>
        </div>
    </ModalShell>
  );
}
