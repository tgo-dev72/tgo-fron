import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FiBookOpen, FiCheck, FiCreditCard, FiEdit2, FiLoader, FiPlus, FiSave, FiShield, FiSliders, FiTrash2, FiZap } from "react-icons/fi";
import { adminApi, ApiError, type BusinessRuleTemplate, type CapabilityInput, type EntitlementDefinition, type EntitlementValue, type PlanInput, type PlatformCommerceSettings, type PricingCatalog, type SubscriberTransition, type SubscriptionPlan, type SupportedLocale } from "../api";
import { ConfirmDialog, ErrorState, Loading, PageHeader, formatDate } from "../components/Ui";
import { useI18n } from "../i18n";
import { normalizePlanEntitlements, validatePlanOffer, type PlanOfferIssue } from "../planEditor";

const capabilityDefaults = (capabilities: EntitlementDefinition[]) => Object.fromEntries(
  capabilities.filter((item) => item.is_active).map((item) => [item.key, item.default_value]),
);

const emptyPlan = (capabilities: EntitlementDefinition[] = []): PlanInput => ({
  name: "", slug: "", description: "", price: "99.00", currency: "MAD", duration_days: 30,
  translations: {
    en: { name: "", description: "" }, fr: { name: "", description: "" }, ar: { name: "", description: "" },
  },
  entitlement_scope: "all_owned_stores", features: [], upgrade_from: null,
  entitlements: capabilityDefaults(capabilities), is_active: false, is_featured: false, sort_order: 10,
});

const emptyCapability = (rule?: BusinessRuleTemplate): CapabilityInput => ({
  key: rule?.key ?? "", name: rule?.name ?? "", description: rule?.description ?? "",
  translations: rule?.translations ?? {
    en: { name: rule?.name ?? "", description: rule?.description ?? "" },
    fr: { name: "", description: "" }, ar: { name: "", description: "" },
  },
  value_type: rule?.value_type ?? "boolean", scope: rule?.scope ?? "account", unit: rule?.unit ?? "",
  allowed_values: rule?.allowed_values ?? [], default_value: rule?.default_value ?? false,
  is_active: true, sort_order: rule?.sort_order ?? 10,
});

function inputFrom(plan: SubscriptionPlan): PlanInput {
  const { id: _id, revision: _revision, benefits: _benefits, grants_premium_designs: _premium, is_free: _free, created_at: _created, updated_at: _updated, ...input } = plan;
  return input;
}

function capabilityInputFrom(item: EntitlementDefinition): CapabilityInput {
  const { id: _id, used_by_plans: _used, created_at: _created, updated_at: _updated, business_rule: _rule, ...input } = item;
  return input;
}

function localizedCopy(item: Pick<EntitlementDefinition, "name" | "description" | "translations">, locale: string) {
  return item.translations?.[locale as SupportedLocale] ?? item.translations?.en ?? { name: item.name, description: item.description };
}

function localizedPlanCopy(plan: Pick<SubscriptionPlan, "name" | "description" | "translations">, locale: string) {
  return plan.translations?.[locale as SupportedLocale] ?? plan.translations?.en ?? { name: plan.name, description: plan.description };
}

function localizedBenefit(plan: SubscriptionPlan, locale: string) {
  return plan.benefits.map((benefit) => benefit.translations?.[locale as SupportedLocale]?.display || benefit.display);
}

function entitlementInput(
  capability: EntitlementDefinition,
  value: EntitlementValue,
  change: (value: EntitlementValue) => void,
  translate?: (key: string) => string,
) {
  if (capability.value_type === "boolean") {
    return <label className="entitlement-toggle"><input type="checkbox" checked={Boolean(value)} onChange={(event) => change(event.target.checked)} aria-label={capability.name} /><i aria-hidden="true" /></label>;
  }
  if (capability.value_type === "choice") {
    return <select aria-label={capability.name} value={String(value)} onChange={(event) => change(event.target.value)}>{capability.allowed_values.map((option) => <option key={option} value={option}>{capability.key === "analytics.level" && translate ? translate(`analyticsLevel.${option}`) : option}</option>)}</select>;
  }
  if (capability.value_type === "integer") {
    return <input type="number" min="0" step="1" value={String(value)} onChange={(event) => change(Number(event.target.value))} />;
  }
  if (capability.value_type === "decimal") {
    return <input type="number" min="0" step="0.01" value={String(value)} onChange={(event) => change(event.target.value)} />;
  }
  return <input value={String(value)} onChange={(event) => change(event.target.value)} />;
}

export function PricingPage() {
  const { locale, tr } = useI18n();
  const [data, setData] = useState<PricingCatalog | null>(null);
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<PlanInput>(emptyPlan());
  const [planStep, setPlanStep] = useState<1 | 2 | 3>(1);
  const [capabilitySelected, setCapabilitySelected] = useState<number | "new" | null>(null);
  const [capabilityForm, setCapabilityForm] = useState<CapabilityInput>(emptyCapability());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [subscriberTransition, setSubscriberTransition] = useState<SubscriberTransition | "">("");
  const [pendingDelete, setPendingDelete] = useState<SubscriptionPlan | null>(null);
  const [commerce, setCommerce] = useState<PlatformCommerceSettings | null>(null);
  const [commerceSaving, setCommerceSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError("");
    return Promise.all([adminApi.pricing(), adminApi.commerceSettings()]).then(([catalog, policy]) => { setData(catalog); setCommerce(policy); }).catch(() => setError(tr("common.unavailableDetail"))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { void load(); }, [load]);

  function edit(plan: SubscriptionPlan) {
    setSelected(plan.id); setForm(inputFrom(plan)); setPlanStep(1); setSaved(false); setError(""); setValidationIssues([]); setPublishConfirmed(false); setSubscriberTransition("");
  }
  function add() {
    setSelected("new"); setForm(emptyPlan(data?.capabilities)); setPlanStep(1); setSaved(false); setError(""); setValidationIssues([]); setPublishConfirmed(false); setSubscriberTransition("");
  }
  function validateOffer() {
    const languageNames = { en: "English", fr: "Français", ar: "العربية" };
    const labelIssue = (issue: PlanOfferIssue) => {
      if (!issue.includes(".")) return tr(`pricing.${issue === "duration" ? "duration" : issue}`);
      const [language, field] = issue.split(".") as [keyof typeof languageNames, "name" | "description"];
      return `${languageNames[language]} — ${tr(`pricing.${field}`)}`;
    };
    const issues = validatePlanOffer(form).map(labelIssue);
    setValidationIssues(issues);
    if (issues.length) {
      setPlanStep(1);
      setError("");
      return false;
    }
    return true;
  }
  function goToStep(step: 1 | 2 | 3) {
    if (step > 1 && !validateOffer()) return;
    if (step === 3) setPublishConfirmed(false);
    setPlanStep(step);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateOffer()) return;
    if (!publishConfirmed) { setError(tr("pricing.confirmBeforeSave")); return; }
    if (selected !== "new" && !editing?.is_free && !subscriberTransition) {
      setPlanStep(3);
      setError(tr("pricing.subscriberTransitionRequired"));
      return;
    }
    setSaving(true); setSaved(false); setError("");
    const payload = {
      ...form,
      name: form.translations.en.name,
      description: form.translations.en.description,
      currency: form.currency.trim().toUpperCase(), duration_days: Number(form.duration_days), sort_order: Number(form.sort_order),
      features: [],
      entitlements: normalizePlanEntitlements(form.entitlements, data?.capabilities ?? []),
    };
    try {
      if (selected === "new") await adminApi.createPlan(payload);
      else await adminApi.updatePlan(selected as number, {
        ...payload,
        subscriber_transition: editing?.is_free ? "existing_and_new" : subscriberTransition as SubscriberTransition,
      });
      await load(); setSelected(null); setPlanStep(1); setPublishConfirmed(false); setSubscriberTransition(""); setValidationIssues([]); setSaved(true);
    } catch (reason) {
      const detail = reason instanceof ApiError ? reason.message : "";
      if (detail.includes("entitlements")) setPlanStep(2);
      setError(detail ? `${tr("pricing.saveFailed")} ${detail}` : tr("pricing.saveFailed"));
    }
    finally { setSaving(false); }
  }
  async function remove(plan: SubscriptionPlan) {
    try { await adminApi.deletePlan(plan.id); setSelected(null); await load(); }
    catch { setError(tr("pricing.deleteFailed")); }
  }

  function addCapability() {
    const rule = data?.rule_templates.find((item) => !item.configured);
    if (!rule) { setError(tr("pricing.allBenefitsReady")); return; }
    setCapabilitySelected("new"); setCapabilityForm(emptyCapability(rule)); setSaved(false); setError("");
  }
  function editCapability(item: EntitlementDefinition) {
    setCapabilitySelected(item.id); setCapabilityForm(capabilityInputFrom(item)); setSaved(false); setError("");
  }
  async function submitCapability(event: FormEvent) {
    event.preventDefault(); setSaving(true); setSaved(false); setError("");
    try {
      const english = capabilityForm.translations.en;
      const payload = { ...capabilityForm, name: english.name, description: english.description };
      if (capabilitySelected === "new") await adminApi.createCapability(payload);
      else await adminApi.updateCapability(capabilitySelected as number, payload);
      setCapabilitySelected(null); await load(); setSaved(false);
    } catch (reason) {
      const detail = reason instanceof ApiError ? reason.message : "";
      setError(detail ? `${tr("pricing.capabilitySaveFailed")} ${detail}` : tr("pricing.capabilitySaveFailed"));
    }
    finally { setSaving(false); }
  }
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} retry={load} />;
  if (!data) return null;
  const editing = typeof selected === "number" ? data.plans.find((plan) => plan.id === selected) : null;
  const activeCapabilities = data.capabilities.filter((item) => item.is_active);
  const availableRules = data.rule_templates.filter((item) => !item.configured);
  const trialCopy = {
    en: { eyebrow: "Conversion policy", title: "Free trial deadline", detail: "New Free accounts receive one trial. When it ends, dashboard features and the public storefront stay paused until a paid pack is confirmed.", length: "Trial length", days: "days", save: "Save trial policy" },
    fr: { eyebrow: "Politique de conversion", title: "Échéance de l’essai gratuit", detail: "Les nouveaux comptes gratuits reçoivent un seul essai. À son terme, le tableau de bord et la boutique publique restent suspendus jusqu’à confirmation d’un forfait payant.", length: "Durée de l’essai", days: "jours", save: "Enregistrer la politique" },
    ar: { eyebrow: "سياسة التحويل", title: "مدة التجربة المجانية", detail: "يحصل كل حساب مجاني جديد على تجربة واحدة. عند انتهائها، تتوقف ميزات لوحة التحكم والمتجر العام إلى أن يتم تأكيد باقة مدفوعة.", length: "مدة التجربة", days: "يومًا", save: "حفظ سياسة التجربة" },
  }[locale];

  return <>
    <PageHeader eyebrow={tr("pricing.eyebrow")} title={tr("nav.pricing")} detail={tr("pricing.detail")} />
    {commerce && <section className="panel free-trial-policy">
      <div><span className="eyebrow">{trialCopy.eyebrow}</span><h2>{trialCopy.title}</h2><p>{trialCopy.detail}</p></div>
      <label><span>{trialCopy.length}</span><div><input type="number" min="1" max="365" value={commerce.free_trial_days} onChange={(event) => setCommerce({ ...commerce, free_trial_days: Number(event.target.value) })} /><small>{trialCopy.days}</small></div></label>
      <button className="button" disabled={commerceSaving} onClick={async () => { setCommerceSaving(true); setError(""); try { setCommerce(await adminApi.updateCommerceSettings({ free_trial_days: commerce.free_trial_days })); setSaved(true); } catch (reason) { setError(reason instanceof Error ? reason.message : tr("pricing.saveFailed")); } finally { setCommerceSaving(false); } }}><FiSave /> {commerceSaving ? tr("pricing.saving") : trialCopy.save}</button>
    </section>}
    <section className="pricing-toolbar">
      <article className="provider-card">
        <span className="provider-icon"><FiCreditCard /></span>
        <div><small>{tr("pricing.provider")}</small><strong>{data.provider.configured ? tr("pricing.paymentReady") : tr("pricing.paymentNeedsSetup")}</strong></div>
        <span className={`provider-state ${data.provider.configured ? "ready" : "missing"}`}>{data.provider.configured ? tr("pricing.configured") : tr("pricing.missingKeys")}</span>
        <p><FiShield /> {data.provider.sandbox ? tr("pricing.customerChargesPaused") : tr("pricing.customerChargesReady")}</p>
        <p><FiShield /> {data.provider.transaction_verification_configured
          ? tr("pricing.confirmationReady")
          : data.provider.transaction_verification_required
            ? tr("pricing.confirmationNeedsAttention")
            : tr("pricing.confirmationReady")}</p>
      </article>
      <Link className="button secondary" to="/plans/capabilities"><FiBookOpen /> {tr("pricing.capabilityGuide")}</Link>
      <button className="button" onClick={add}><FiPlus /> {tr("pricing.addPack")}</button>
    </section>

    {saved && <div className="pricing-message success pricing-page-message" role="status"><FiCheck /> {tr("pricing.saved")}</div>}

    <section className="pricing-plan-grid">
      {data.plans.map((plan) => <article key={plan.id} className={`plan-card ${plan.is_featured ? "premium-plan" : "free-plan"} ${plan.is_active ? "active" : "paused"}`}>
        <span className="plan-label">{plan.grants_premium_designs && <FiZap />} {localizedPlanCopy(plan, locale).name}</span>
        <strong>{plan.price} {plan.currency}</strong>
        <p>{localizedPlanCopy(plan, locale).description || tr("pricing.period", { days: plan.duration_days })}</p>
        <ul>{localizedBenefit(plan, locale).slice(0, 4).map((feature) => <li key={feature}><FiCheck /> {feature}</li>)}</ul>
        <div className="plan-card-actions">
          <b>{plan.is_active ? tr("pricing.available") : tr("pricing.paused")}</b>
          <button className="icon-button" type="button" title={tr("pricing.editPack")} onClick={() => edit(plan)}><FiEdit2 /></button>
          {!plan.is_free && <button className="icon-button danger" type="button" title={tr("pricing.deletePack")} onClick={() => setPendingDelete(plan)}><FiTrash2 /></button>}
        </div>
      </article>)}
    </section>

    {selected !== null && <form className="panel pricing-form" onSubmit={submit}>
      <div className="panel-head"><div><h2>{selected === "new" ? tr("pricing.newPack") : tr("pricing.editingPack", { name: editing ? localizedPlanCopy(editing, locale).name : "" })}</h2><p>{tr("pricing.offerDetail")}</p></div><button type="button" className="button secondary" onClick={() => { setSelected(null); setValidationIssues([]); setPublishConfirmed(false); setSubscriberTransition(""); }}>{tr("common.cancel")}</button></div>
      <nav className="pricing-stepper" aria-label={tr("pricing.editorSteps")}>
        <button type="button" className={planStep === 1 ? "active" : ""} onClick={() => goToStep(1)}><span>1</span>{tr("pricing.stepOffer")}</button>
        <i />
        <button type="button" className={planStep === 2 ? "active" : ""} onClick={() => goToStep(2)}><span>2</span>{tr("pricing.stepBenefits")}</button>
        <i />
        <button type="button" className={planStep === 3 ? "active" : ""} onClick={() => goToStep(3)}><span>3</span>{tr("pricing.stepPublish")}</button>
      </nav>
      {validationIssues.length > 0 && <div className="pricing-validation-summary" role="alert"><strong>{tr("pricing.completeRequired")}</strong><ul>{validationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
      {planStep === 1 && <div className="pricing-fields">
        <label><span>{tr("pricing.price")}</span><input type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
        <label><span>{tr("pricing.currency")}</span><input minLength={3} maxLength={3} required value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></label>
        <label><span>{tr("pricing.duration")}</span><input type="number" min="1" max="3650" required value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: Number(event.target.value) })} /></label>
        <label><span>{tr("pricing.scope")}</span><select value={form.entitlement_scope} disabled={Boolean(editing?.is_free)} onChange={(event) => setForm({ ...form, entitlement_scope: event.target.value as PlanInput["entitlement_scope"] })}><option value="all_owned_stores">{tr("pricing.allStores")}</option><option value="one_store">{tr("pricing.oneStore")}</option></select></label>
        <label><span>{tr("pricing.upgradeFrom")}</span><select value={form.upgrade_from ?? ""} onChange={(event) => setForm({ ...form, upgrade_from: event.target.value ? Number(event.target.value) : null })}><option value="">{tr("pricing.noPredecessor")}</option>{(data?.plans ?? []).filter((plan) => plan.id !== editing?.id).map((plan) => <option value={plan.id} key={plan.id}>{localizedPlanCopy(plan, locale).name}</option>)}</select></label>
        <label><span>{tr("pricing.order")}</span><input type="number" min="0" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></label>
        {(["en", "fr", "ar"] as const).map((language) => <div className="pricing-wide capability-language" key={language} dir={language === "ar" ? "rtl" : "ltr"}>
          <strong>{language === "en" ? "English" : language === "fr" ? "Français" : "العربية"}</strong>
          <div className="pricing-fields">
            <label><span>{tr("pricing.name")}</span><input required value={form.translations[language].name} onChange={(event) => {
              const name = event.target.value;
              setForm({
                ...form,
                translations: { ...form.translations, [language]: { ...form.translations[language], name } },
                ...(language === "en" ? { name } : {}),
                ...(language === "en" && selected === "new" ? { slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") } : {}),
              });
            }} /></label>
            <label><span>{tr("pricing.description")}</span><input required value={form.translations[language].description} onChange={(event) => {
              const description = event.target.value;
              setForm({
                ...form,
                translations: { ...form.translations, [language]: { ...form.translations[language], description } },
                ...(language === "en" ? { description } : {}),
              });
            }} /></label>
          </div>
        </div>)}
      </div>}
      {planStep === 2 && <div className="entitlement-editor pricing-editor-stage">
        <div className="entitlement-heading"><FiSliders /><div><strong>{tr("pricing.entitlements")}</strong><small>{tr("pricing.entitlementsHelp")}</small></div></div>
        <div className="entitlement-grid">{activeCapabilities.map((capability) => <article key={capability.key} title={capability.business_rule?.counting_rules || localizedCopy(capability, locale).description}>
          <div><strong>{localizedCopy(capability, locale).name}</strong><small>{localizedCopy(capability, locale).description}</small>{capability.business_rule && <small>{capability.business_rule.scope} · {capability.business_rule.counting_rules}{capability.business_rule.reset_window !== "none" ? ` · ${capability.business_rule.reset_window}` : ""}</small>}</div>
          {entitlementInput(capability, form.entitlements[capability.key] ?? capability.default_value, (value) => setForm({ ...form, entitlements: { ...form.entitlements, [capability.key]: value } }), tr)}
        </article>)}</div>
      </div>}
      {planStep === 3 && <div className="pricing-publish-stage">
      <div className="pricing-publish-summary"><strong>{form.translations[locale as SupportedLocale]?.name || form.translations.en.name || tr("pricing.unnamedPack")}</strong><span>{form.price} {form.currency} · {form.duration_days} {tr("pricing.days")}</span><small>{activeCapabilities.length} {tr("pricing.configuredBenefits")}</small></div>
      <div className="pricing-checks">
        <label><input type="checkbox" checked={form.is_featured} onChange={(event) => setForm({ ...form, is_featured: event.target.checked })} /> {tr("pricing.featured")}</label>
        <label><input type="checkbox" disabled={Boolean(editing?.is_free)} checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> {tr("pricing.enable")}</label>
        {editing && !editing.is_free && <fieldset className="subscriber-transition">
          <legend><strong>{tr("pricing.subscriberTransition")}</strong><small>{tr("pricing.subscriberTransitionHelp")}</small></legend>
          <label className={subscriberTransition === "existing_and_new" ? "selected" : ""}>
            <input type="radio" name="subscriber-transition" value="existing_and_new" checked={subscriberTransition === "existing_and_new"} onChange={() => setSubscriberTransition("existing_and_new")} />
            <span><strong>{tr("pricing.existingAndNew")}</strong><small>{tr("pricing.existingAndNewHelp")}</small></span>
          </label>
          <label className={subscriberTransition === "new_only" ? "selected" : ""}>
            <input type="radio" name="subscriber-transition" value="new_only" checked={subscriberTransition === "new_only"} onChange={() => setSubscriberTransition("new_only")} />
            <span><strong>{tr("pricing.newOnly")}</strong><small>{tr("pricing.newOnlyHelp")}</small></span>
          </label>
        </fieldset>}
        <label className="pricing-save-confirm"><input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} /> <span><strong>{tr("pricing.confirmSave")}</strong><small>{tr("pricing.confirmSaveHelp")}</small></span></label>
      </div>
      </div>}
      {error && <div className="pricing-message error" role="alert">{error}</div>}
      <footer className="pricing-footer"><span>{editing ? tr("pricing.lastUpdatedSimple", { date: formatDate(editing.updated_at, true, locale) }) : tr("pricing.newPackHelp")}</span><div className="pricing-step-actions">{planStep > 1 && <button type="button" className="button secondary" onClick={() => setPlanStep((planStep - 1) as 1 | 2)}>{tr("common.back")}</button>}{planStep < 3 ? <button type="button" className="button" onClick={() => goToStep((planStep + 1) as 2 | 3)}>{tr("common.next")}</button> : <button className="button" disabled={saving || !publishConfirmed}>{saving ? <FiLoader className="spin" aria-hidden="true" /> : <FiSave />} {saving ? tr("pricing.saving") : tr("pricing.confirmAndSave")}</button>}</div></footer>
    </form>}

    <section className="panel capability-panel">
      <div className="panel-head"><div><h2>{tr("pricing.capabilityRegistry")}</h2><p>{tr("pricing.capabilityRegistryHelp")}</p></div><button className="button secondary" type="button" disabled={availableRules.length === 0} onClick={addCapability}><FiPlus /> {availableRules.length ? tr("pricing.addCapability") : tr("pricing.allBenefitsReady")}</button></div>
      <div className="capability-list">{data.capabilities.map((item) => <article key={item.id} className={item.is_active ? "" : "archived"}>
        <span className="capability-type"><FiCheck /></span>
        <div><strong>{localizedCopy(item, locale).name}</strong><small>{localizedCopy(item, locale).description} · {tr("pricing.plansUsing", { count: item.used_by_plans })}</small></div>
        <button className="icon-button" type="button" title={tr("pricing.editCapability")} onClick={() => editCapability(item)}><FiEdit2 /></button>
      </article>)}</div>
    </section>

    {capabilitySelected !== null && <form className="panel pricing-form capability-form" onSubmit={submitCapability}>
      <div className="panel-head"><div><h2>{capabilitySelected === "new" ? tr("pricing.newCapability") : tr("pricing.editCapability")}</h2><p>{tr("pricing.capabilityFormHelp")}</p></div></div>
      <div className="pricing-fields">
        {capabilitySelected === "new" && <label className="pricing-wide"><span>{tr("pricing.selectBenefit")}</span><select value={capabilityForm.key} onChange={(event) => {
          const rule = availableRules.find((item) => item.key === event.target.value);
          if (rule) setCapabilityForm(emptyCapability(rule));
        }}>{availableRules.map((rule) => <option key={rule.key} value={rule.key}>{rule.name}</option>)}</select></label>}
        <label><span>{tr("pricing.defaultValue")}</span>{entitlementInput({ ...capabilityForm, id: 0, used_by_plans: 0, created_at: "", updated_at: "", business_rule: null }, capabilityForm.default_value, (value) => setCapabilityForm({ ...capabilityForm, default_value: value }), tr)}</label>
        {(["en", "fr", "ar"] as const).map((language) => <div className="pricing-wide capability-language" key={language} dir={language === "ar" ? "rtl" : "ltr"}>
          <strong>{language === "en" ? "English" : language === "fr" ? "Français" : "العربية"}</strong>
          <div className="pricing-fields">
            <label><span>{tr("pricing.capabilityName")}</span><input required value={capabilityForm.translations[language].name} onChange={(event) => setCapabilityForm({ ...capabilityForm, translations: { ...capabilityForm.translations, [language]: { ...capabilityForm.translations[language], name: event.target.value } } })} /></label>
            <label><span>{tr("pricing.description")}</span><input required value={capabilityForm.translations[language].description} onChange={(event) => setCapabilityForm({ ...capabilityForm, translations: { ...capabilityForm.translations, [language]: { ...capabilityForm.translations[language], description: event.target.value } } })} /></label>
          </div>
        </div>)}
      </div>
      {error && <div className="pricing-message error" role="alert">{error}</div>}
      <footer className="pricing-footer"><span>{tr("pricing.capabilitySafety")}</span><button className="button" disabled={saving}>{saving ? <FiLoader className="spin" aria-hidden="true" /> : <FiSave />} {saving ? tr("pricing.saving") : tr("pricing.saveCapability")}</button></footer>
    </form>}
    <ConfirmDialog open={Boolean(pendingDelete)} title={tr("pricing.deleteTitle")} detail={tr("pricing.deleteConfirm", { name: pendingDelete ? localizedPlanCopy(pendingDelete, locale).name : "" })} confirmLabel={tr("pricing.deletePack")} danger onCancel={() => setPendingDelete(null)} onConfirm={() => { if (!pendingDelete) return; const plan = pendingDelete; setPendingDelete(null); void remove(plan); }} />
  </>;
}
