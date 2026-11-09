import { useEffect, useRef, useState } from "react";
import { api, ApiError, type CatalogConfiguration, type RetailFieldConfig, type RetailType } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { retailLabel, t, useLocale } from "../i18n";
import { FiBox, FiCheck, FiEye, FiLayers } from "react-icons/fi";

type Group = "product_fields" | "variant_fields";

export function CatalogSettings({ storeId, onSaved }: { storeId: number; onSaved: (configuration: CatalogConfiguration, preset: RetailType | null) => void }) {
  const locale = useLocale();
  const { data, loading, error: loadError, reload } = useAsync(
    () => Promise.all([api.getCatalogConfiguration(storeId), api.listRetailTypes()]), [storeId],
  );
  const [form, setForm] = useState<CatalogConfiguration | null>(null);
  const original = useRef<CatalogConfiguration | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"saved" | "failed" | "inUse" | "">("");
  useEffect(() => { original.current = data?.[0] ?? null; setForm(original.current); setMessage(""); }, [data]);
  function change(group: Group, key: string, patch: Partial<RetailFieldConfig>) {
    setMessage("");
    setForm(current => {
      if (!current) return current;
      const old = current.catalog_config[group]?.[key];
      const field = { enabled: Boolean(old), ...(old ?? { visible: false, required: false }), ...patch };
      if (!field.enabled) { field.visible = false; field.required = false; }
      if (!field.visible) field.required = false;
      return { ...current, catalog_config: { ...current.catalog_config, [group]: { ...current.catalog_config[group], [key]: field } } };
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true); setMessage("");
    const controls = (value?: RetailFieldConfig) => ({
      enabled: value ? value.enabled ?? true : false, visible: value?.visible ?? false,
      required: value?.required ?? false, sort_order: value?.sort_order ?? 0,
    });
    const fields = (group: Group) => Object.fromEntries(Object.entries(form.catalog_config[group] ?? {})
      .filter(([key, value]) => JSON.stringify(controls(value)) !== JSON.stringify(controls(original.current?.catalog_config[group]?.[key])))
      .map(([key, value]) => [key, controls(value)]));
    try {
      const result = await api.patchCatalogConfiguration(storeId, {retail_type: form.retail_type, product_fields: fields("product_fields"), variant_fields: fields("variant_fields")});
      original.current = result; setForm(result); setMessage("saved"); onSaved(result, data?.[1].find(preset => preset.id === result.retail_type) ?? null);
    } catch (error) {
      const code = error instanceof ApiError ? error.payload?.code : null;
      setMessage(code === "catalog_fields_in_use" || (Array.isArray(code) && code.includes("catalog_fields_in_use")) ? "inUse" : "failed");
    } finally { setSaving(false); }
  }
  if (loading) return <p role="status">{t(locale, "catalogSettings.loading")}</p>;
  if (loadError || !form) return <div role="alert">{t(locale, "catalogSettings.failed")} <button className="btn" onClick={reload}>{t(locale, "catalogSettings.retry")}</button></div>;
  return <form className="form-section" onSubmit={save}>
    <h2 className="d-card-title">{t(locale, "catalogSettings.title")}</h2>
    <p className="field-hint">{t(locale, "catalogSettings.hint")}</p>
    <div className="field" style={{marginBlock: 16}}>
      <label className="field-label" htmlFor="catalog-preset">{t(locale, "settings.retailType")}</label>
      <select id="catalog-preset" className="select" value={form.retail_type ?? ""} disabled={saving} onChange={event => {setMessage(""); setForm({...form, retail_type: event.target.value ? Number(event.target.value) : null});}}>
        <option value="">{t(locale, "catalogSettings.noPreset")}</option>
        {data?.[1].map(preset => <option key={preset.id} value={preset.id}>{retailLabel(locale, preset.key, preset.label)}</option>)}
      </select>
      <p className="field-hint">{t(locale, "catalogSettings.presetHint")}</p>
    </div>
    <div className="catalog-field-groups">
    {(["product_fields", "variant_fields"] as const).map(group => <details className="catalog-field-group" key={group} open={group === "product_fields"}>
      <summary className="catalog-field-group-summary">
        <span className="catalog-field-group-icon" aria-hidden="true">{group === "product_fields" ? <FiBox /> : <FiLayers />}</span>
        <span><strong>{t(locale, `catalogSettings.${group}`)}</strong><small>{t(locale, `catalogSettings.${group}Hint`)}</small></span>
        <span className="catalog-field-count">{Object.values(form.catalog_config[group] ?? {}).filter(field => field.enabled !== false).length}/{form.registry.length}</span>
      </summary>
      <div className="catalog-field-grid">{form.registry.map(({key}) => {
        const field = form.catalog_config[group]?.[key];
        const enabled = field ? field.enabled !== false : false;
        const label = t(locale, `catalogSettings.fields.${key}`);
        return <fieldset className={`catalog-field-card${enabled ? " is-enabled" : ""}`} key={key} disabled={saving}>
          <div className="catalog-field-card-head">
            <span><strong>{label}</strong><small>{enabled ? t(locale, "catalogSettings.fieldActive") : t(locale, "catalogSettings.fieldInactive")}</small></span>
            <label className="toggle" title={t(locale, "catalogSettings.enabled")}><input type="checkbox" aria-label={`${label}: ${t(locale, "catalogSettings.enabled")}`} checked={enabled} onChange={event => change(group, key, {enabled: event.target.checked, visible: event.target.checked})} /><span className="toggle-track" /><span className="toggle-label">{t(locale, "catalogSettings.enabled")}</span></label>
          </div>
          <div className="catalog-field-card-controls">
            <label className="catalog-option"><input type="checkbox" checked={Boolean(field?.visible)} disabled={!enabled} onChange={event => change(group, key, {visible: event.target.checked})} /><FiEye /><span>{t(locale, "catalogSettings.visible")}</span></label>
            <label className="catalog-option"><input type="checkbox" checked={Boolean(field?.required)} disabled={!enabled || !field?.visible} onChange={event => change(group, key, {required: event.target.checked})} /><FiCheck /><span>{t(locale, "catalogSettings.required")}</span></label>
            <label className="catalog-order"><span>{t(locale, "catalogSettings.order")}</span><input className="input" aria-label={`${label}: ${t(locale, "catalogSettings.order")}`} type="number" min={0} max={1000} step={1} value={field?.sort_order ?? 0} disabled={!enabled} onChange={event => change(group, key, {sort_order: Number(event.target.value)})} /></label>
          </div>
        </fieldset>;
      })}</div>
    </details>)}
    </div>
    {message && <p role={message === "saved" ? "status" : "alert"} className={message === "saved" ? "field-hint" : "field-error"}>{t(locale, `catalogSettings.${message}`)}</p>}
    <button className="btn btn-primary" disabled={saving} type="submit">{saving ? t(locale, "catalogSettings.saving") : t(locale, "catalogSettings.save")}</button>
  </form>;
}
