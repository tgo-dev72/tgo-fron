import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft, FiChevronRight, FiEdit2, FiExternalLink, FiRefreshCw, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import {
  adminApi, type Deployment, type MembershipPaymentRow, type OrderRow, type Paginated, type PaymentRow,
  type PlatformGateway, type StoreRow, type UserRow,
} from "../api";
import { useAuth } from "../AuthContext";
import { ConfirmDialog, Empty, ErrorState, Loading, PageHeader, Status, formatDate, money, useModalFocus } from "../components/Ui";
import { useI18n } from "../i18n";
import { buildResourceQuery, type AdminResource } from "../resourceQuery";
import "./GatewayControls.css";

type Resource = AdminResource;
type Row = StoreRow | UserRow | OrderRow | PaymentRow | MembershipPaymentRow | Deployment;
type PaymentSource = "store" | "membership";

function paymentMethod(value: string, tr: (key: string) => string) {
  return /cash|cod|delivery/i.test(value) ? tr("common.cashOnDelivery") : tr("common.onlinePayment");
}

const config: Record<Resource, { eyebrowKey: string; titleKey: string; detailKey: string; filters: Array<[string, string]> }> = {
  stores: { eyebrowKey: "resources.stores.eyebrow", titleKey: "nav.stores", detailKey: "resources.stores.detail", filters: [] },
  users: { eyebrowKey: "resources.users.eyebrow", titleKey: "nav.users", detailKey: "resources.users.detail", filters: [["staff", "status.staff"], ["merchant", "status.merchant"], ["customer", "status.customer"]] },
  orders: { eyebrowKey: "resources.orders.eyebrow", titleKey: "nav.orders", detailKey: "resources.orders.detail", filters: [["pending", "status.pending"], ["confirmed", "status.confirmed"], ["shipped", "status.shipped"], ["delivered", "status.delivered"], ["cancelled", "status.cancelled"]] },
  payments: { eyebrowKey: "resources.payments.eyebrow", titleKey: "nav.payments", detailKey: "resources.payments.detail", filters: [["pending", "status.pending"], ["confirmed", "status.confirmed"], ["failed", "status.failed"]] },
  deployments: { eyebrowKey: "resources.deployments.eyebrow", titleKey: "nav.deployments", detailKey: "resources.deployments.detail", filters: [["not_deployed", "status.not-deployed"], ["deploying", "status.deploying"], ["deployed", "status.deployed"], ["failed", "status.failed"]] },
};

export function ResourcePage({ resource }: { resource: Resource }) {
  const { locale, tr } = useI18n();
  const { user } = useAuth();
  const canViewStorePayments = Boolean(user?.access.payments);
  const canViewMembershipPayments = Boolean(user?.access.membership_payments);
  const [urlParams, setUrlParams] = useSearchParams();
  const requestedPaymentSource = urlParams.get("ledger");
  const initialPaymentSource: PaymentSource = requestedPaymentSource === "membership" && canViewMembershipPayments ? "membership" : canViewStorePayments ? "store" : "membership";
  const [paymentSource, setPaymentSource] = useState<PaymentSource>(initialPaymentSource);
  const [data, setData] = useState<Paginated<Row> | null>(null);
  const [searchInput, setSearchInput] = useState(urlParams.get("search") || "");
  const [search, setSearch] = useState(urlParams.get("search") || "");
  const [filter, setFilter] = useState(urlParams.get("status") || urlParams.get("role") || "");
  const [page, setPage] = useState(Math.max(1, Number(urlParams.get("page")) || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deploymentAction, setDeploymentAction] = useState<number | null>(null);
  const [pendingDeployment, setPendingDeployment] = useState<Deployment | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const [userAction, setUserAction] = useState(false);
  const [gateways, setGateways] = useState<PlatformGateway[]>([]);
  const [gatewayAction, setGatewayAction] = useState("");
  const deploymentStreams = useRef<Map<number, EventSource>>(new Map());
  const spec = config[resource];

  const load = useCallback((background = false) => {
    if (!background) setLoading(true);
    setError("");
    const params = { search, page, ...(resource === "users" ? { role: filter } : { status: filter }) };
    const call = resource === "payments" && paymentSource === "membership"
      ? adminApi.membershipPayments as (values: Record<string, string | number | undefined>) => Promise<Paginated<Row>>
      : adminApi[resource] as (values: Record<string, string | number | undefined>) => Promise<Paginated<Row>>;
    call(params).then(setData).catch(() => setError(tr("common.unavailableDetail"))).finally(() => setLoading(false));
  }, [filter, page, paymentSource, resource, search, tr]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (resource !== "payments") return;
    adminApi.paymentGateways().then((result) => setGateways(result.gateways)).catch(() => setGateways([]));
  }, [resource]);

  async function updateGateway(gateway: PlatformGateway, payload: { enabled?: boolean; sandbox_enabled?: boolean }) {
    setGatewayAction(gateway.code); setError("");
    try {
      const updated = await adminApi.updatePaymentGateway(gateway.code, payload);
      setGateways((items) => items.map((item) => item.code === updated.code ? updated : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr("common.unavailableDetail"));
    } finally { setGatewayAction(""); }
  }

  useEffect(() => {
    const next = buildResourceQuery({ resource, search, filter, page, paymentSource });
    if (next.toString() !== urlParams.toString()) setUrlParams(next, { replace: true });
  }, [filter, page, paymentSource, resource, search, setUrlParams, urlParams]);

  const activeDeploymentIds = resource === "deployments"
    ? (data?.results as Deployment[] | undefined)?.filter((item) => item.release_status === "updating").map((item) => item.id) ?? []
    : resource === "stores"
      ? (data?.results as StoreRow[] | undefined)?.flatMap((item) => item.deployment?.release_status === "updating" ? [item.deployment.id] : []) ?? []
      : [];
  const activeDeploymentKey = activeDeploymentIds.join(",");
  useEffect(() => {
    const streams = deploymentStreams.current;
    const wanted = new Set(activeDeploymentIds);
    for (const [id, source] of streams) {
      if (!wanted.has(id)) { source.close(); streams.delete(id); }
    }
    if (!activeDeploymentIds.length) return;
    if (typeof EventSource === "undefined") {
      const timer = window.setInterval(() => load(true), 5000);
      return () => window.clearInterval(timer);
    }
    let fallbackTimer: number | null = null;
    const startFallback = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(() => load(true), 5000);
    };
    for (const id of activeDeploymentIds) {
      if (streams.has(id)) continue;
      const source = new EventSource(adminApi.deploymentEventsUrl(id), { withCredentials: true });
      streams.set(id, source);
      source.addEventListener("deployment.updated", () => load(true));
      source.onerror = () => { source.close(); streams.delete(id); startFallback(); };
    }
    return () => {
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
    };
  // The stable ID key prevents reconnecting streams after every background refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeploymentKey, load]);
  useEffect(() => () => {
    for (const source of deploymentStreams.current.values()) source.close();
    deploymentStreams.current.clear();
  }, []);

  async function confirmRelease() {
    if (!pendingDeployment) return;
    const deployment = pendingDeployment;
    setPendingDeployment(null);
    setDeploymentAction(deployment.id);
    setError("");
    try {
      await adminApi.releaseDeployment(deployment.id);
      load(true);
    } catch {
      setError(tr("resources.deployments.updateFailed"));
    } finally {
      setDeploymentAction(null);
    }
  }

  async function saveUser(payload: { email: string; first_name: string; last_name: string; is_active: boolean; email_verified: boolean }) {
    if (!selectedUser) return;
    setUserAction(true); setError("");
    try {
      await adminApi.updateUser(selectedUser.id, payload);
      setSelectedUser(null); load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr("resources.users.updateFailed"));
    } finally { setUserAction(false); }
  }

  async function deleteUser() {
    if (!pendingDelete) return;
    setUserAction(true); setError("");
    try {
      await adminApi.deleteUser(pendingDelete.id);
      setPendingDelete(null); setSelectedUser(null); load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr("resources.users.deleteFailed"));
      setPendingDelete(null);
    } finally { setUserAction(false); }
  }

  return <>
    <PageHeader eyebrow={tr(spec.eyebrowKey)} title={tr(spec.titleKey)} detail={tr(spec.detailKey)} actions={<button className="button secondary" type="button" disabled={loading} onClick={() => load()}><FiRefreshCw className={loading ? "spin" : ""} /> {tr("common.refresh")}</button>} />
    {resource === "payments" && gateways.length > 0 && <section className="panel gateway-control-panel">
      <div className="gateway-control-head"><div><h2>{locale === "ar" ? "طرق دفع الاشتراكات" : locale === "fr" ? "Moyens de paiement des abonnements" : "Membership payment gateways"}</h2><p>{locale === "ar" ? "فعّل فقط طرق الدفع التي تريد عرضها للتجار عند الترقية." : locale === "fr" ? "Activez uniquement les moyens à proposer aux marchands lors d’une mise à niveau." : "Enable only the methods merchants should see when upgrading."}</p></div></div>
      <div className="gateway-control-grid">{gateways.map((gateway) => <article key={gateway.code} className="gateway-control-card"><div className="gateway-control-copy"><strong>{gateway.name}</strong><span>{gateway.configured ? (locale === "ar" ? "مُعدّ" : locale === "fr" ? "Configuré" : "Configured") : (locale === "ar" ? "يحتاج إلى إعداد" : locale === "fr" ? "Configuration requise" : "Needs configuration")}</span></div><div className="gateway-control-actions"><button type="button" className={`gateway-switch${gateway.sandbox ? " active" : ""}`} role="switch" aria-checked={gateway.sandbox} disabled={!gateway.sandbox_configurable || gatewayAction === gateway.code} title={!gateway.sandbox_configurable ? (locale === "ar" ? "وضع الاختبار ثابت لهذا المزود" : locale === "fr" ? "Le mode test est fixe pour ce fournisseur" : "Sandbox mode is fixed for this gateway") : undefined} onClick={() => void updateGateway(gateway, { sandbox_enabled: !gateway.sandbox })}><span />{locale === "ar" ? "اختبار" : locale === "fr" ? "Test" : "Sandbox"}</button><button type="button" className={`gateway-switch${gateway.enabled ? " active" : ""}`} role="switch" aria-checked={gateway.enabled} disabled={!gateway.configured || gatewayAction === gateway.code} onClick={() => void updateGateway(gateway, { enabled: !gateway.enabled })}><span />{gateway.enabled ? (locale === "ar" ? "مفعّل" : locale === "fr" ? "Activé" : "Enabled") : (locale === "ar" ? "متوقف" : locale === "fr" ? "Désactivé" : "Disabled")}</button></div></article>)}</div>
    </section>}
    <section className="panel resource-panel">
      {resource === "payments" && canViewStorePayments && canViewMembershipPayments && <div className="payment-source" role="tablist" aria-label={tr("resources.payments.sourceLabel")}>
        <button type="button" role="tab" aria-selected={paymentSource === "store"} className={paymentSource === "store" ? "active" : ""} onClick={() => { setData(null); setFilter(""); setPage(1); setPaymentSource("store"); }}>{tr("resources.payments.storePayments")}</button>
        <button type="button" role="tab" aria-selected={paymentSource === "membership"} className={paymentSource === "membership" ? "active" : ""} onClick={() => { setData(null); setFilter(""); setPage(1); setPaymentSource("membership"); }}>{tr("resources.payments.memberships")}</button>
      </div>}
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <label className="search"><FiSearch /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={tr("resources.searchPlaceholder", { resource: tr(spec.titleKey).toLocaleLowerCase() })} /></label>
        {spec.filters.length > 0 && <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="">{tr("common.allStatuses")}</option>{[...spec.filters, ...(resource === "payments" && paymentSource === "membership" ? [["duplicate", "status.duplicate"], ["canceled", "status.canceled"]] as Array<[string, string]> : [])].map(([value, labelKey]) => <option value={value} key={value}>{tr(labelKey)}</option>)}</select>}
        <button className="button" type="submit">{tr("common.search")}</button>
        <span className="record-count">{tr("common.records", { count: data?.count ?? 0 })}</span>
      </form>
      {error && data && <p className="inline-error" role="alert">{error}</p>}
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} retry={load} /> : <ResourceTable
        resource={resource}
        paymentSource={paymentSource}
        rows={data?.results || []}
        deploymentAction={deploymentAction}
        releaseDeployment={async (deployment) => setPendingDeployment(deployment)}
        canManageUsers={Boolean(user?.is_superuser && user.permissions.manage_users)}
        editUser={setSelectedUser}
      />}
      {data && <div className="pagination"><span>{tr("common.page", { page })}</span><div><button disabled={!data.previous || loading} onClick={() => setPage((value) => value - 1)}><FiChevronLeft /> {tr("common.previous")}</button><button disabled={!data.next || loading} onClick={() => setPage((value) => value + 1)}>{tr("common.next")} <FiChevronRight /></button></div></div>}
    </section>
    <ConfirmDialog open={Boolean(pendingDeployment)} title={tr("resources.deployments.updateTitle")} detail={tr("resources.deployments.updateConfirm", { store: pendingDeployment?.name || "" })} confirmLabel={tr("resources.deployments.update")} busy={deploymentAction !== null} onCancel={() => setPendingDeployment(null)} onConfirm={() => void confirmRelease()} />
    <UserEditor user={selectedUser} busy={userAction} onClose={() => setSelectedUser(null)} onSave={saveUser} onDelete={(account) => { setSelectedUser(null); setPendingDelete(account); }} />
    <ConfirmDialog open={Boolean(pendingDelete)} danger title={tr("resources.users.deleteTitle")} detail={tr("resources.users.deleteConfirm", { email: pendingDelete?.email || "" })} confirmLabel={tr("resources.users.deleteAction")} busy={userAction} onCancel={() => setPendingDelete(null)} onConfirm={() => void deleteUser()} />
  </>;
}

function ResourceTable({ resource, paymentSource, rows, deploymentAction, releaseDeployment, canManageUsers, editUser }: {
  resource: Resource;
  paymentSource: PaymentSource;
  rows: Row[];
  deploymentAction: number | null;
  releaseDeployment: (deployment: Deployment) => Promise<void>;
  canManageUsers: boolean;
  editUser: (user: UserRow) => void;
}) {
  const { locale, tr } = useI18n();
  if (!rows.length) return <Empty />;
  if (resource === "stores") return <Table headers={[tr("header.store"), tr("header.owner"), tr("header.retailModel"), tr("header.catalog"), tr("header.ordersVolume"), tr("header.deployment"), tr("header.actions")]}>{(rows as StoreRow[]).map((row) => <tr key={row.id}>
    <Cell title={row.name} sub={row.slug} /><td>{row.owner_email || "—"}</td><td>{row.retail_type}<small>{row.design || tr("common.noDesign")}</small></td><td><strong>{row.products_count}</strong> {tr("common.products")}<small>{row.customers_count} {tr("common.customers")} · {row.members_count} {tr("common.staff")}</small></td><td><strong>{row.orders_count}</strong> {tr("common.orders")}<small>{money(row.gross_volume, row.currency, locale)}</small></td><td>{row.deployment ? <Status value={row.deployment.release_status || row.deployment.deploy_status} /> : <Status value="not deployed" />}</td><td><StorefrontUpdateAction deployment={row.deployment} busy={deploymentAction === row.deployment?.id} onUpdate={releaseDeployment} /></td>
  </tr>)}</Table>;
  if (resource === "users") return <Table headers={[tr("header.identity"), tr("header.type"), tr("header.stores"), tr("header.customerAt"), tr("header.joined"), tr("header.lastActive"), tr("header.actions")]}>{(rows as UserRow[]).map((row) => <tr key={row.id}>
    <Cell title={row.name} sub={row.email} /><td>{(row.principal_types?.length ? row.principal_types : [row.is_staff ? "platform_staff" : row.stores_count ? "merchant_account" : "store_customer"]).map((type) => <Status key={type} value={type} />)}{!row.is_active && <Status value="suspended" />}{row.store_roles?.length > 0 && <small>{row.store_roles.join(" · ")}</small>}</td><td>{row.stores_count}</td><td>{row.customer_stores_count}</td><td>{formatDate(row.date_joined, false, locale)}</td><td>{formatDate(row.last_login, true, locale)}</td><td>{canManageUsers ? <button className="icon-button" type="button" aria-label={tr("resources.users.editAction")} title={tr("resources.users.editAction")} onClick={() => editUser(row)}><FiEdit2 /></button> : "—"}</td>
  </tr>)}</Table>;
  if (resource === "orders") return <Table headers={[tr("header.order"), tr("header.store"), tr("header.customer"), tr("header.status"), tr("header.payment"), tr("header.items"), tr("header.amount"), tr("header.created")]}>{(rows as OrderRow[]).map((row) => <tr key={row.id}>
    <Cell title={`#${row.order_id.slice(0, 8)}`} sub={row.order_id} mono /><Cell title={row.store.name} sub={row.store.slug} /><Cell title={row.customer_name || tr("common.guest")} sub={row.customer_email || row.customer_city || tr("common.noEmail")} /><td><Status value={row.status} />{row.exception && <small className="danger-text">{tr("common.stockException")}</small>}</td><td><Status value={row.payment_status} /><small>{paymentMethod(row.payment_mode, tr)}</small></td><td>{row.items_count ?? 0}</td><td className="amount">{money(row.amount, row.currency, locale)}</td><td>{formatDate(row.created_at, true, locale)}</td>
  </tr>)}</Table>;
  if (resource === "payments" && paymentSource === "membership") return <Table headers={[tr("header.transaction"), tr("header.merchant"), tr("header.plan"), tr("header.scope"), tr("header.status"), tr("header.amount"), tr("header.processed")]}>{(rows as MembershipPaymentRow[]).map((row) => <tr key={row.id}>
    <Cell title={tr("common.transaction", { id: String(row.id).slice(0, 8) })} sub={tr("common.membershipPayment")} mono /><td>{row.merchant_email}</td><Cell title={row.plan_name} sub={row.selected_store?.name || tr(row.entitlement_scope === "one_store" ? "resources.payments.oneStore" : "resources.payments.allStores")} /><td>{tr(row.entitlement_scope === "one_store" ? "resources.payments.storeScope" : "resources.payments.accountScope")}</td><td><Status value={row.status} /></td><Cell title={money(row.amount, row.currency, locale)} sub={row.balance_applied > 0 ? tr("resources.payments.balanceApplied", { amount: money(row.balance_applied, row.currency, locale) }) : ""} /><td>{formatDate(row.processed_at || row.updated_at, true, locale)}</td>
  </tr>)}</Table>;
  if (resource === "payments") return <Table headers={[tr("header.transaction"), tr("header.store"), tr("header.order"), tr("header.customer"), tr("header.status"), tr("header.amount"), tr("header.updated")]}>{(rows as PaymentRow[]).map((row) => <tr key={row.id}>
    <Cell title={tr("common.transaction", { id: String(row.id).slice(0, 8) })} sub={tr("common.paymentRecord")} mono /><Cell title={row.store.name} sub={row.store.slug} /><td className="mono">#{row.order_id.slice(0, 8)}</td><td>{row.customer_email || tr("common.guest")}</td><td><Status value={row.status} /></td><td className="amount">{money(row.amount, row.currency, locale)}</td><td>{formatDate(row.updated_at, true, locale)}</td>
  </tr>)}</Table>;
  return <Table headers={[tr("header.storefront"), tr("header.design"), tr("header.build"), tr("header.deployment"), tr("header.destination"), tr("header.created"), tr("header.actions")]}>{(rows as Deployment[]).map((row) => <tr key={row.id}>
    <Cell title={row.name} sub={row.slug} /><td>{row.design}</td><td><Status value={row.pipeline_state} /><small>{row.progress}% · {tr("common.launchAttempts", { count: row.attempt_count })}</small></td><td><Status value={row.release_status || row.deploy_status} />{row.last_error && <small className="danger-text">{tr("common.launchNeedsAttention")}</small>}</td><td>{row.deployed_url ? <a className="external" href={row.deployed_url} target="_blank" rel="noreferrer">{tr("common.openSite")} <FiExternalLink /></a> : row.domain || "—"}</td><td>{formatDate(row.last_heartbeat_at || row.created_at, true, locale)}</td><td><StorefrontUpdateAction deployment={row} busy={deploymentAction === row.id} onUpdate={releaseDeployment} /></td>
  </tr>)}</Table>;
}

function StorefrontUpdateAction({ deployment, busy, onUpdate }: { deployment: Deployment | null; busy: boolean; onUpdate: (deployment: Deployment) => Promise<void> }) {
  const { tr } = useI18n();
  if (!deployment || !["current", "update_available", "updating", "update_failed"].includes(deployment.release_status)) return <>—</>;
  const current = deployment.release_status === "current";
  const updating = busy || deployment.release_status === "updating";
  return <button className="button button-compact" type="button" disabled={current || updating} onClick={() => void onUpdate(deployment)}><FiRefreshCw className={updating ? "spin" : ""} /> {tr(current ? "resources.deployments.upToDate" : updating ? "resources.deployments.updating" : "resources.deployments.update")}</button>;
}

function UserEditor({ user, busy, onClose, onSave, onDelete }: { user: UserRow | null; busy: boolean; onClose: () => void; onSave: (payload: { email: string; first_name: string; last_name: string; is_active: boolean; email_verified: boolean }) => Promise<void>; onDelete: (user: UserRow) => void }) {
  const { locale, tr } = useI18n();
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", is_active: true, email_verified: false });
  const [tab, setTab] = useState<"profile" | "access" | "activity">("profile");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (user) {
      setForm({ email: user.email, first_name: user.first_name, last_name: user.last_name, is_active: user.is_active, email_verified: user.email_verified });
      setTab("profile");
      setConfirmDiscard(false);
      setClosing(false);
    }
  }, [user]);
  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); }, []);
  const initial = user ? { email: user.email, first_name: user.first_name, last_name: user.last_name, is_active: user.is_active, email_verified: user.email_verified } : form;
  const dirty = user ? JSON.stringify(form) !== JSON.stringify(initial) : false;
  const finishClose = () => {
    if (busy || closing) return;
    setConfirmDiscard(false);
    setClosing(true);
    closeTimer.current = window.setTimeout(() => { closeTimer.current = null; onClose(); }, 240);
  };
  const requestClose = () => { if (busy || closing) return; if (dirty) setConfirmDiscard(true); else finishClose(); };
  const editorRef = useModalFocus(Boolean(user), requestClose, busy || closing);
  if (!user) return null;
  const blockers = user.delete_blockers.map((key) => tr(`resources.users.blocker.${key}`)).join(" · ");
  return createPortal(<div className={`dialog-backdrop user-editor-backdrop${closing ? " is-closing" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <section ref={editorRef} className={`user-editor${closing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="user-editor-title">
      <header><div><span className="eyebrow">{tr("resources.users.manageEyebrow")}</span><h2 id="user-editor-title">{tr("resources.users.editTitle")}</h2><p dir="ltr">{user.email}</p></div><button className="icon-button" type="button" disabled={busy || closing} onClick={requestClose} aria-label={tr("common.cancel")}><FiX /></button></header>
      <nav className="user-editor-tabs" aria-label={tr("resources.users.editTitle")}>
        {(["profile", "access", "activity"] as const).map((item) => <button key={item} type="button" className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{tr(`resources.users.tab.${item}`)}</button>)}
      </nav>
      <form onSubmit={(event) => { event.preventDefault(); void onSave(form); }}>
        <div className="user-editor-content">
        {tab === "profile" && <div className="staff-form-grid">
          <label>{tr("resources.users.firstName")}<input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
          <label>{tr("resources.users.lastName")}<input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
          <label className="staff-form-wide">{tr("resources.users.email")}<input dir="ltr" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        </div>}
        {tab === "access" && <><div className="user-account-summary"><div><span>{tr("header.type")}</span><strong>{user.principal_types.map((type) => tr(`status.${type.replace(/_/g, "-")}`, {}, type)).join(" · ")}</strong></div><div><span>{tr("header.stores")}</span><strong>{user.stores_count}</strong></div></div><div className="user-switches">
          <label><input type="checkbox" checked={form.is_active} disabled={user.is_self} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /><span><strong>{tr("resources.users.active")}</strong><small>{tr("resources.users.activeHelp")}</small></span></label>
          <label><input type="checkbox" checked={form.email_verified} onChange={(event) => setForm({ ...form, email_verified: event.target.checked })} /><span><strong>{tr("resources.users.verified")}</strong><small>{tr("resources.users.verifiedHelp")}</small></span></label>
        </div></>}
        {tab === "activity" && <><div className="user-activity"><div><span>{tr("header.joined")}</span><strong>{formatDate(user.date_joined, true, locale)}</strong></div><div><span>{tr("header.lastActive")}</span><strong>{formatDate(user.last_login, true, locale)}</strong></div><div><span>{tr("header.customerAt")}</span><strong>{user.customer_stores_count}</strong></div></div><div className="user-editor-delete"><div><strong>{tr("resources.users.deleteTitle")}</strong><small>{user.can_delete ? tr("resources.users.deleteHelp") : blockers || tr("resources.users.selfProtected")}</small></div><button className="button danger-button" type="button" disabled={busy || !user.can_delete} onClick={() => onDelete(user)}><FiTrash2 /> {tr("resources.users.deleteAction")}</button></div></>}
        </div>
        {confirmDiscard && <div className="discard-prompt" role="alert"><span><strong>{tr("resources.users.discardTitle")}</strong><small>{tr("resources.users.discardHelp")}</small></span><div><button className="button secondary" type="button" onClick={() => setConfirmDiscard(false)}>{tr("resources.users.keepEditing")}</button><button className="button danger-button" type="button" onClick={finishClose}>{tr("resources.users.discardAction")}</button></div></div>}
        <footer><span className="editor-save-state" aria-live="polite">{dirty ? tr("resources.users.unsaved") : tr("resources.users.noChanges")}</span><button className="button secondary" type="button" disabled={busy || closing} onClick={requestClose}>{tr("common.cancel")}</button><button className="button" type="submit" disabled={busy || closing || !dirty}>{busy && <span className="spin" />} {tr("resources.users.saveAction")}</button></footer>
      </form>
    </section>
  </div>, document.body);
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
function Cell({ title, sub, mono = false }: { title: string; sub: string; mono?: boolean }) {
  return <td className={mono ? "mono" : ""}><strong>{title}</strong><small title={sub}>{sub}</small></td>;
}
