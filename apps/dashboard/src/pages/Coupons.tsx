import { useMemo, useState } from "react";
import { FiEdit2, FiPause, FiPlay, FiPlus, FiSearch, FiTag, FiTrash2, FiX } from "react-icons/fi";

import { api, type Coupon } from "../api/client";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAsync } from "../hooks/useAsync";
import { fmtMoney, t, useLocale } from "../i18n";
import { useStore } from "../Layout";
import { friendlyError } from "../utils/errors";

type CouponScope = Coupon["scope"];
type DiscountType = Coupon["discount_type"];

interface Draft {
  id: number | null;
  code: string;
  discount_type: DiscountType;
  value: string;
  scope: CouponScope;
  category_ids: number[];
  product_ids: number[];
  minimum_subtotal: string;
  maximum_discount: string;
  total_usage_limit: string;
  per_customer_usage_limit: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

const emptyDraft = (): Draft => ({
  id: null,
  code: "",
  discount_type: "percentage",
  value: "",
  scope: "all_products",
  category_ids: [],
  product_ids: [],
  minimum_subtotal: "0",
  maximum_discount: "",
  total_usage_limit: "",
  per_customer_usage_limit: "1",
  starts_at: "",
  ends_at: "",
  is_active: true,
});

function localDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromCoupon(coupon: Coupon): Draft {
  return {
    id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    value: coupon.value,
    scope: coupon.scope,
    category_ids: coupon.category_ids,
    product_ids: coupon.product_ids,
    minimum_subtotal: coupon.minimum_subtotal,
    maximum_discount: coupon.maximum_discount ?? "",
    total_usage_limit: coupon.total_usage_limit?.toString() ?? "",
    per_customer_usage_limit: coupon.per_customer_usage_limit?.toString() ?? "",
    starts_at: localDateTime(coupon.starts_at),
    ends_at: localDateTime(coupon.ends_at),
    is_active: coupon.is_active,
  };
}

function nullablePositiveInteger(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

export function CouponsPage() {
  const { store } = useStore();
  const locale = useLocale();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Coupon["availability"]>("all");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, loading, error, reload } = useAsync(
    async () => {
      if (!store) return { coupons: [] as Coupon[], currency: "MAD" };
      const [coupons, config] = await Promise.all([api.listCoupons(store.id), api.getConfig(store.id)]);
      return { coupons, currency: config.currency };
    },
    [store?.id],
  );
  const coupons = data?.coupons;
  const currency = data?.currency ?? "MAD";
  const { data: categories } = useAsync(
    () => (store ? api.listSections(store.id) : Promise.resolve([])),
    [store?.id],
  );
  const { data: products } = useAsync(
    () => (store ? api.listProducts(store.id) : Promise.resolve([])),
    [store?.id],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (coupons ?? []).filter((coupon) => (
      (!needle || coupon.code.toLowerCase().includes(needle))
      && (statusFilter === "all" || coupon.availability === statusFilter)
    ));
  }, [coupons, query, statusFilter]);

  function beginCreate() {
    setDraft(emptyDraft());
    setErrors({});
    setEditing(true);
  }

  function beginEdit(coupon: Coupon) {
    setDraft(fromCoupon(coupon));
    setErrors({});
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggleTarget(key: "category_ids" | "product_ids", id: number) {
    const current = draft[key];
    patch(key, current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!draft.code.trim()) next.code = t(locale, "coupons.codeRequired");
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(draft.code.trim())) next.code = t(locale, "coupons.codeInvalid");
    const value = Number(draft.value);
    if (!Number.isFinite(value) || value <= 0) next.value = t(locale, "coupons.valueInvalid");
    if (draft.discount_type === "percentage" && value > 100) next.value = t(locale, "coupons.percentInvalid");
    if (Number(draft.minimum_subtotal || 0) < 0) next.minimum_subtotal = t(locale, "coupons.nonNegative");
    if (draft.maximum_discount && Number(draft.maximum_discount) <= 0) next.maximum_discount = t(locale, "coupons.positiveOnly");
    if (draft.total_usage_limit && Number(draft.total_usage_limit) < 1) next.total_usage_limit = t(locale, "coupons.wholePositive");
    if (draft.per_customer_usage_limit && Number(draft.per_customer_usage_limit) < 1) next.per_customer_usage_limit = t(locale, "coupons.wholePositive");
    if (draft.starts_at && draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) next.ends_at = t(locale, "coupons.endInvalid");
    if (draft.scope === "categories" && draft.category_ids.length === 0) next.category_ids = t(locale, "coupons.categoryRequired");
    if (draft.scope === "products" && draft.product_ids.length === 0) next.product_ids = t(locale, "coupons.productRequired");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!store || !validate()) return;
    setSaving(true);
    const payload = {
      code: draft.code.trim(),
      discount_type: draft.discount_type,
      value: draft.value,
      scope: draft.scope,
      category_ids: draft.scope === "categories" ? draft.category_ids : [],
      product_ids: draft.scope === "products" ? draft.product_ids : [],
      minimum_subtotal: draft.minimum_subtotal || "0",
      maximum_discount: draft.discount_type === "percentage" && draft.maximum_discount ? draft.maximum_discount : null,
      total_usage_limit: nullablePositiveInteger(draft.total_usage_limit),
      per_customer_usage_limit: nullablePositiveInteger(draft.per_customer_usage_limit),
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      is_active: draft.is_active,
    };
    try {
      if (draft.id) await api.updateCoupon(store.id, draft.id, payload);
      else await api.createCoupon(store.id, payload);
      toast.push("success", t(locale, draft.id ? "coupons.updated" : "coupons.created"));
      setEditing(false);
      setDraft(emptyDraft());
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "coupons.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    if (!store) return;
    setBusyId(coupon.id);
    try {
      await api.updateCoupon(store.id, coupon.id, { is_active: !coupon.is_active });
      toast.push("success", t(locale, coupon.is_active ? "coupons.pausedToast" : "coupons.activatedToast"));
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "coupons.saveFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!store || !deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api.deleteCoupon(store.id, deleteTarget.id);
      toast.push("success", t(locale, "coupons.deleted"));
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "coupons.deleteFailed"));
    } finally {
      setBusyId(null);
    }
  }

  const statusLabel = (status: Coupon["availability"]) => t(locale, `coupons.status.${status}`);
  const statusClass = (status: Coupon["availability"]) => status === "active" ? "badge-success" : status === "scheduled" ? "badge-warning" : status === "expired" || status === "exhausted" ? "badge-danger" : "badge-neutral";
  const discountLabel = (coupon: Coupon) => coupon.discount_type === "percentage" ? `${Number(coupon.value)}%` : fmtMoney(Number(coupon.value), currency, locale);
  const scopeLabel = (coupon: Coupon) => {
    if (coupon.scope === "categories") return t(locale, "coupons.categoryCount", coupon.category_ids.length);
    if (coupon.scope === "products") return t(locale, "coupons.productCount", coupon.product_ids.length);
    return t(locale, "coupons.allProducts");
  };

  if (error) {
    return <EmptyState icon={<FiTag />} title={t(locale, "coupons.loadError")} sub={t(locale, "coupons.loadErrorSub")} action={<button className="btn btn-secondary" onClick={reload}>{t(locale, "errors.tryAgain")}</button>} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "coupons.title")}</h1>
          <p className="d-subtitle">{t(locale, "coupons.subtitle")}</p>
        </div>
        {!editing && <button className="btn btn-primary" onClick={beginCreate} disabled={loading}><FiPlus /> {t(locale, "coupons.newCoupon")}</button>}
      </div>

      {editing && (
        <div className="card coupon-editor">
          <div className="d-card-head">
            <div>
              <span className="d-card-title">{t(locale, draft.id ? "coupons.editCoupon" : "coupons.newCoupon")}</span>
              <p>{t(locale, "coupons.editorHint")}</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={saving}><FiX /> {t(locale, "confirm.cancel")}</button>
          </div>
          <div className="coupon-editor-body">
            <section className="coupon-form-section">
              <div className="coupon-section-title"><span>1</span><div><b>{t(locale, "coupons.discountTitle")}</b><small>{t(locale, "coupons.discountHint")}</small></div></div>
              <div className="editor-row coupon-primary-row">
                <div className={`field${errors.code ? " field-error" : ""}`}>
                  <label className="field-label">{t(locale, "coupons.code")}</label>
                  <input className="input coupon-code-input" autoFocus value={draft.code} onChange={(e) => patch("code", e.target.value.toUpperCase().replace(/\s+/g, ""))} placeholder={t(locale, "coupons.codePh")} maxLength={32} />
                  {errors.code ? <span className="field-error-text">{errors.code}</span> : <span className="field-hint">{t(locale, "coupons.codeHint")}</span>}
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "coupons.type")}</label>
                  <div className="select-wrap"><select className="select" value={draft.discount_type} onChange={(e) => patch("discount_type", e.target.value as DiscountType)}><option value="percentage">{t(locale, "coupons.percentage")}</option><option value="fixed">{t(locale, "coupons.fixed")}</option></select></div>
                </div>
                <div className={`field${errors.value ? " field-error" : ""}`}>
                  <label className="field-label">{t(locale, "coupons.value")}</label>
                  <div className="coupon-value-input"><input className="input tnum" type="number" min="0.01" step="0.01" max={draft.discount_type === "percentage" ? 100 : undefined} value={draft.value} onChange={(e) => patch("value", e.target.value)} /><span>{draft.discount_type === "percentage" ? "%" : currency}</span></div>
                  {errors.value && <span className="field-error-text">{errors.value}</span>}
                </div>
              </div>
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-title"><span>2</span><div><b>{t(locale, "coupons.appliesTo")}</b><small>{t(locale, "coupons.appliesHint")}</small></div></div>
              <div className="coupon-scope-options">
                {(["all_products", "categories", "products"] as CouponScope[]).map((scope) => <label key={scope} className={`coupon-scope-card${draft.scope === scope ? " selected" : ""}`}><input type="radio" name="coupon-scope" checked={draft.scope === scope} onChange={() => patch("scope", scope)} /><span><b>{t(locale, `coupons.scope.${scope}`)}</b><small>{t(locale, `coupons.scopeHint.${scope}`)}</small></span></label>)}
              </div>
              {draft.scope === "categories" && <div className="coupon-targets"><div className="field-label">{t(locale, "coupons.chooseCategories")}</div>{categories?.length ? <div className="coupon-target-grid">{categories.map((category) => <label key={category.id} className={draft.category_ids.includes(category.id) ? "selected" : ""}><input type="checkbox" checked={draft.category_ids.includes(category.id)} onChange={() => toggleTarget("category_ids", category.id)} /><span>{category.label}</span></label>)}</div> : <p className="field-hint">{t(locale, "coupons.noCategories")}</p>}{errors.category_ids && <span className="field-error-text">{errors.category_ids}</span>}</div>}
              {draft.scope === "products" && <div className="coupon-targets"><div className="field-label">{t(locale, "coupons.chooseProducts")}</div>{products?.length ? <div className="coupon-target-grid">{products.map((product) => <label key={product.id} className={draft.product_ids.includes(product.id) ? "selected" : ""}><input type="checkbox" checked={draft.product_ids.includes(product.id)} onChange={() => toggleTarget("product_ids", product.id)} /><span>{product.name}</span></label>)}</div> : <p className="field-hint">{t(locale, "coupons.noProducts")}</p>}{errors.product_ids && <span className="field-error-text">{errors.product_ids}</span>}</div>}
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-title"><span>3</span><div><b>{t(locale, "coupons.rulesTitle")}</b><small>{t(locale, "coupons.rulesHint")}</small></div></div>
              <div className="editor-row">
                <div className="field"><label className="field-label">{t(locale, "coupons.minimumSubtotal")}</label><input className="input tnum" type="number" min="0" step="0.01" value={draft.minimum_subtotal} onChange={(e) => patch("minimum_subtotal", e.target.value)} />{errors.minimum_subtotal && <span className="field-error-text">{errors.minimum_subtotal}</span>}</div>
                {draft.discount_type === "percentage" && <div className="field"><label className="field-label">{t(locale, "coupons.maximumDiscount")}</label><input className="input tnum" type="number" min="0.01" step="0.01" value={draft.maximum_discount} onChange={(e) => patch("maximum_discount", e.target.value)} placeholder={t(locale, "coupons.noLimit")} />{errors.maximum_discount && <span className="field-error-text">{errors.maximum_discount}</span>}</div>}
                <div className="field"><label className="field-label">{t(locale, "coupons.totalLimit")}</label><input className="input tnum" type="number" min="1" step="1" value={draft.total_usage_limit} onChange={(e) => patch("total_usage_limit", e.target.value)} placeholder={t(locale, "coupons.noLimit")} />{errors.total_usage_limit && <span className="field-error-text">{errors.total_usage_limit}</span>}</div>
                <div className="field"><label className="field-label">{t(locale, "coupons.customerLimit")}</label><input className="input tnum" type="number" min="1" step="1" value={draft.per_customer_usage_limit} onChange={(e) => patch("per_customer_usage_limit", e.target.value)} placeholder={t(locale, "coupons.noLimit")} />{errors.per_customer_usage_limit && <span className="field-error-text">{errors.per_customer_usage_limit}</span>}</div>
              </div>
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-title"><span>4</span><div><b>{t(locale, "coupons.scheduleTitle")}</b><small>{t(locale, "coupons.scheduleHint")}</small></div></div>
              <div className="editor-row">
                <div className="field"><label className="field-label">{t(locale, "coupons.startsAt")}</label><input className="input tnum" type="datetime-local" value={draft.starts_at} onChange={(e) => patch("starts_at", e.target.value)} /></div>
                <div className="field"><label className="field-label">{t(locale, "coupons.endsAt")}</label><input className="input tnum" type="datetime-local" value={draft.ends_at} onChange={(e) => patch("ends_at", e.target.value)} />{errors.ends_at && <span className="field-error-text">{errors.ends_at}</span>}</div>
              </div>
              <label className="toggle coupon-active-toggle"><input type="checkbox" checked={draft.is_active} onChange={(e) => patch("is_active", e.target.checked)} /><span className="toggle-track" /><span className="toggle-label"><b>{t(locale, "coupons.activeToggle")}</b><small>{t(locale, "coupons.activeToggleHint")}</small></span></label>
            </section>
          </div>
          <div className="coupon-editor-foot"><button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>{t(locale, "confirm.cancel")}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving && <span className="spin" />}{t(locale, draft.id ? "coupons.saveChanges" : "coupons.createCoupon")}</button></div>
        </div>
      )}

      {!editing && <>
        <div className="toolbar">
          <div className="search-box"><FiSearch /><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(locale, "coupons.search")} /></div>
          <div className="seg">{(["all", "active", "scheduled", "paused", "expired", "exhausted"] as const).map((status) => <button key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}>{status === "all" ? t(locale, "coupons.all") : statusLabel(status)}</button>)}</div>
        </div>
        {loading ? <div className="card"><PageLoader /></div> : filtered.length === 0 ? <div className="card"><EmptyState icon={<FiTag />} title={query || statusFilter !== "all" ? t(locale, "coupons.noMatch") : t(locale, "coupons.none")} sub={query || statusFilter !== "all" ? t(locale, "coupons.noMatchSub") : t(locale, "coupons.noneSub")} action={!query && statusFilter === "all" ? <button className="btn btn-primary" onClick={beginCreate} disabled={loading}><FiPlus /> {t(locale, "coupons.newCoupon")}</button> : undefined} /></div> : <div className="card table-wrap coupon-table" tabIndex={0}><table className="table"><thead><tr><th>{t(locale, "coupons.code")}</th><th>{t(locale, "coupons.discount")}</th><th>{t(locale, "coupons.appliesTo")}</th><th>{t(locale, "coupons.usage")}</th><th>{t(locale, "coupons.statusLabel")}</th><th style={{ textAlign: "end" }}>{t(locale, "coupons.actions")}</th></tr></thead><tbody>{filtered.map((coupon) => <tr key={coupon.id}><td><div className="coupon-code"><FiTag /><span><b>{coupon.code}</b><small>{coupon.minimum_subtotal !== "0.00" ? t(locale, "coupons.minimumShort", fmtMoney(Number(coupon.minimum_subtotal), currency, locale)) : t(locale, "coupons.noMinimum")}</small></span></div></td><td><strong className="coupon-discount">{discountLabel(coupon)}</strong></td><td>{scopeLabel(coupon)}</td><td className="tnum">{coupon.usage_count}{coupon.total_usage_limit ? ` / ${coupon.total_usage_limit}` : ""}</td><td><span className={`badge ${statusClass(coupon.availability)}`}>{statusLabel(coupon.availability)}</span></td><td className="table-actions"><button className="btn btn-ghost btn-sm" title={coupon.is_active ? t(locale, "coupons.pause") : t(locale, "coupons.activate")} onClick={() => toggleActive(coupon)} disabled={busyId === coupon.id}>{busyId === coupon.id ? <span className="spin" /> : coupon.is_active ? <FiPause /> : <FiPlay />}</button><button className="btn btn-ghost btn-sm" title={t(locale, "coupons.editCoupon")} onClick={() => beginEdit(coupon)}><FiEdit2 /></button><button className="btn btn-ghost btn-sm danger-icon" title={t(locale, "coupons.delete")} onClick={() => setDeleteTarget(coupon)}><FiTrash2 /></button></td></tr>)}</tbody></table></div>}
      </>}

      <ConfirmModal open={Boolean(deleteTarget)} title={t(locale, "coupons.deleteTitle")} body={t(locale, "coupons.deleteBody", deleteTarget?.code ?? "")} confirmLabel={t(locale, "coupons.delete")} danger loading={busyId === deleteTarget?.id} onClose={() => setDeleteTarget(null)} onConfirm={remove} />
    </div>
  );
}
