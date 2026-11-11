import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheck, FiChevronDown, FiDownload, FiEdit2, FiLayers, FiPlus, FiSave, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import { FaBoxOpen, FaGem, FaHeart, FaLeaf, FaShoePrints, FaTshirt } from "react-icons/fa";
import { FaBagShopping } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { api, ApiError, type AttributeDef, type CatalogSection } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";
import { t, useLocale } from "../i18n";
import { friendlyError } from "../utils/errors";

const ICONS: Array<{ value: string; key: string; Icon: IconType }> = [
  { value: "FaTshirt:fa", key: "shirt", Icon: FaTshirt },
  { value: "FaBagShopping:fa6", key: "bag", Icon: FaBagShopping },
  { value: "FaBoxOpen:fa", key: "box", Icon: FaBoxOpen },
  { value: "FaShoePrints:fa", key: "shoe", Icon: FaShoePrints },
  { value: "FaLeaf:fa", key: "leaf", Icon: FaLeaf },
  { value: "FaGem:fa", key: "gem", Icon: FaGem },
  { value: "FaHeart:fa", key: "heart", Icon: FaHeart },
];

const iconOf = (value: string) => ICONS.find((i) => i.value === value) ?? ICONS[2];

const ATTR_TYPES = ["select", "multi", "color", "text", "number", "boolean", "date"] as const;
const ATTR_LEVELS = ["variant", "product"] as const;

const TYPE_LABELS: Record<(typeof ATTR_TYPES)[number], string> = {
  select: "sections.typeSelect",
  multi: "sections.typeMulti",
  color: "sections.typeColor",
  text: "sections.typeText",
  number: "sections.typeNumber",
  boolean: "sections.typeBoolean",
  date: "sections.typeDate",
};

const LEVEL_LABELS: Record<(typeof ATTR_LEVELS)[number], string> = {
  variant: "sections.levelVariant",
  product: "sections.levelProduct",
};

interface AttrDraft {
  key: string;
  label: string;
  type: string;
  level: "product" | "variant";
  required: boolean;
  options: string;
}

interface SectionDraft {
  id: number | null;
  label: string;
  label_translations: Record<"en" | "fr" | "ar", string>;
  key: string;
  icon: string;
  sort_order: number;
  is_visible: boolean;
  thumbnail: string;
  attrs: AttrDraft[];
}

interface SectionRouteState {
  createSection?: boolean;
  returnTo?: string;
  productDraftKey?: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toAttrs(defs: AttributeDef[]): AttrDraft[] {
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    type: d.type,
    level: (d.level as "product" | "variant") || "variant",
    required: d.required,
    options: Array.isArray(d.options)
      ? d.options
          .map((o) => (typeof o === "object" ? (o as { value: string }).value : o))
          .join(", ")
      : "",
  }));
}

function toDefs(attrs: AttrDraft[]): Partial<AttributeDef>[] {
  return attrs.map((a) => ({
    key: a.key || slugify(a.label) || `attr-${Math.random().toString(36).slice(2, 6)}`,
    label: a.label,
    type: a.type,
    level: a.level || "variant",
    required: a.required,
    options: ["select", "multi", "color"].includes(a.type)
      ? a.options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
          .map((o) => ({ value: o, label: o }))
      : [],
  }));
}

const emptyNames = (): Record<"en" | "fr" | "ar", string> => ({ en: "", fr: "", ar: "" });
const emptyDraft = (): SectionDraft => ({ id: null, label: "", label_translations: emptyNames(), key: "", icon: "FaTshirt:fa", sort_order: 0, is_visible: true, thumbnail: "", attrs: [] });
const emptyAttr = (): AttrDraft => ({ key: "", label: "", type: "select", level: "variant", required: false, options: "" });

function translatedName(section: Pick<CatalogSection, "label" | "label_translations">, locale: "en" | "fr" | "ar"): string {
  const translations = section.label_translations ?? emptyNames();
  return translations[locale]?.trim() || translations.en?.trim() || Object.values(translations).find((value) => value?.trim()) || section.label;
}

export function SectionsPage() {
  const { store } = useStore();
  const toast = useToast();
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as SectionRouteState | null;
  const [open, setOpen] = useState(Boolean(routeState?.createSection));
  const [draft, setDraft] = useState<SectionDraft>(emptyDraft());
  const [nameLanguage, setNameLanguage] = useState<"en" | "fr" | "ar">(locale);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerProgress, setBannerProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CatalogSection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const templateMenu = useRef<HTMLDetailsElement>(null);

  const { data: sections, loading, error, reload } = useAsync<CatalogSection[]>(
    () => (store ? api.listSections(store.id) : Promise.resolve([])),
    [store?.id],
  );

  function beginCreate() {
    setDraft(emptyDraft());
    setNameLanguage(locale);
    setOpen(true);
  }

  function beginEdit(s: CatalogSection) {
    const names = { ...emptyNames(), ...(s.label_translations ?? {}), en: s.label_translations?.en || s.label };
    setDraft({ id: s.id, label: names.en || s.label, label_translations: names, key: s.key, icon: s.icon, sort_order: s.sort_order, is_visible: s.is_visible ?? true, thumbnail: s.thumbnail ?? "", attrs: toAttrs(s.attribute_defs ?? []) });
    setNameLanguage(locale);
    setOpen(true);
  }

  function closeEditor() {
    if (routeState?.returnTo) {
      navigate(routeState.returnTo, {
        replace: true,
        state: { productDraftKey: routeState.productDraftKey },
      });
      return;
    }
    setOpen(false);
  }

  async function save() {
    if (!store) return;
    const availableName = draft.label_translations.en.trim() || Object.values(draft.label_translations).find((value) => value.trim()) || "";
    if (!availableName) {
      toast.push("error", t(locale, "sections.nameRequired"));
      return;
    }
    const key = draft.key || slugify(availableName);
    const payload = { label: availableName, label_translations: draft.label_translations, key, icon: draft.icon, sort_order: draft.sort_order, is_visible: draft.is_visible, attribute_defs: toDefs(draft.attrs) };
    setSaving(true);
    try {
      if (draft.id) {
        await api.updateSection(store.id, draft.id, payload);
        toast.push("success", t(locale, "sections.updated"));
      } else {
        const created = await api.createSection(store.id, payload);
        toast.push("success", t(locale, "sections.created"));
        if (routeState?.returnTo) {
          navigate(routeState.returnTo, {
            replace: true,
            state: {
              productDraftKey: routeState.productDraftKey,
              createdSectionId: created.id,
            },
          });
          return;
        }
      }
      setOpen(false);
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "sections.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: CatalogSection) {
    if (!store) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteSection(store.id, s.id);
      toast.push("success", t(locale, "sections.deleted"));
      setDeleteTarget(null);
      reload();
    } catch (err) {
      const detail = err instanceof ApiError && err.payload && typeof err.payload === "object"
        ? (err.payload as { detail?: unknown }).detail : null;
      setDeleteError(err instanceof ApiError && err.status === 400 && detail === "Section still has products — move or delete them first."
        ? t(locale, "sections.inUse") : friendlyError(err, locale, "sections.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  async function uploadCategoryBanner(file: File) {
    if (!store || !draft.id) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      toast.push("error", locale === "ar" ? "استخدم صورة PNG أو JPG أو WebP بحجم أقل من 8 ميغابايت." : locale === "fr" ? "Utilisez une image PNG, JPG ou WebP de moins de 8 Mo." : "Use a PNG, JPG, or WebP image under 8 MB.");
      return;
    }
    setUploadingBanner(true);
    setBannerProgress(0);
    try {
      const updated = await api.uploadSectionBanner(store.id, draft.id, file, setBannerProgress);
      setDraft((current) => ({ ...current, thumbnail: updated.thumbnail ?? "" }));
      toast.push("success", locale === "ar" ? "تم حفظ بانر الفئة." : locale === "fr" ? "Bannière de catégorie enregistrée." : "Category banner saved.");
      reload();
    } catch (error) {
      toast.push("error", friendlyError(error, locale, "sections.saveFailed"));
    } finally {
      setUploadingBanner(false);
      setBannerProgress(0);
    }
  }

  async function importSections(file: File) {
    if (!store) return;
    setImporting(true);
    try {
      const result = await api.importSections(store.id, file);
      toast.push("success", t(locale, "sections.importComplete", result));
      reload();
    } catch (error) {
      toast.push("error", friendlyError(error, locale, "sections.importFailed"));
    } finally {
      setImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  }

  async function downloadImportTemplate(format: "xlsx" | "csv" | "json") {
    if (!store) return;
    templateMenu.current?.removeAttribute("open");
    try {
      const blob = await api.sectionImportTemplate(store.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sections-import-template.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.push("error", friendlyError(error, locale, "sections.templateFailed"));
    }
  }

  function patchAttr(i: number, patch: Partial<AttrDraft>) {
    setDraft((d) => ({ ...d, attrs: d.attrs.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }));
  }

  if (error) {
    return <EmptyState icon={<FiLayers />} title={t(locale, "sections.loadError")} sub={error} action={<button className="btn btn-secondary" onClick={reload}>{t(locale, "errors.tryAgain")}</button>} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "sections.title")}</h1>
          <p className="d-subtitle">{t(locale, "sections.subtitle")}</p>
        </div>
        <div className="page-head-actions">
          <details className="catalog-transfer-menu" ref={templateMenu}>
            <summary className="btn btn-secondary"><FiDownload /> {t(locale, "sections.downloadTemplate")} <FiChevronDown /></summary>
            <div className="catalog-transfer-options" role="menu">
              <button type="button" role="menuitem" onClick={() => void downloadImportTemplate("xlsx")}><strong>Excel</strong><small>.xlsx</small></button>
              <button type="button" role="menuitem" onClick={() => void downloadImportTemplate("csv")}><strong>CSV</strong><small>.csv</small></button>
              <button type="button" role="menuitem" onClick={() => void downloadImportTemplate("json")}><strong>JSON</strong><small>.json</small></button>
            </div>
          </details>
          <button className="btn btn-secondary" onClick={() => importInput.current?.click()} disabled={importing || saving || deleting}>
            {importing ? <span className="spin" /> : <FiUpload />} {importing ? t(locale, "sections.importing") : t(locale, "sections.importFile")}
          </button>
          <input
            ref={importInput}
            hidden
            type="file"
            accept=".xlsx,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSections(file); }}
          />
          <button className="btn btn-primary" onClick={beginCreate} disabled={saving || deleting}>
            <FiPlus /> {t(locale, "sections.newSection")}
          </button>
        </div>
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="d-card-head">
            <span className="d-card-title">{draft.id ? t(locale, "sections.editSection") : t(locale, "sections.newSection")}</span>
            <button className="btn btn-ghost btn-sm" onClick={closeEditor}><FiX /> {t(locale, "sections.cancel")}</button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="editor-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="field">
                <label className="field-label">{t(locale, "sections.nameLabel")}</label>
                <div className="theme-language-tabs section-language-tabs"><div>{(["en", "fr", "ar"] as const).map((language) => {
                  const active = nameLanguage === language;
                  return <button key={language} type="button" className={active ? "is-active" : ""} aria-pressed={active} onClick={() => setNameLanguage(language)}>{active && <FiCheck aria-hidden="true" />}<span>{t(locale, `sections.language_${language}`)}</span><small>{language.toUpperCase()}</small></button>;
                })}</div></div>
                <input
                  className="input"
                  dir={nameLanguage === "ar" ? "rtl" : "ltr"}
                  value={draft.label_translations[nameLanguage]}
                  onChange={(e) => setDraft((d) => { const label_translations = { ...d.label_translations, [nameLanguage]: e.target.value }; const fallback = label_translations.en.trim() || Object.values(label_translations).find((value) => value.trim()) || ""; return { ...d, label: fallback, label_translations, key: d.id ? d.key : slugify(fallback) }; })}
                  placeholder={t(locale, "sections.namePh")}
                />
                <span className="field-hint">{t(locale, "sections.nameHint")}</span>
              </div>
              <div className="field">
                <label className="field-label">{t(locale, "sections.iconLabel")}</label>
                <div className="select-wrap">
                  <select className="select" value={draft.icon} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}>
                    {ICONS.map((i) => (
                      <option key={i.value} value={i.value}>{t(locale, `icons.${i.key}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {draft.id && <div className="field section-banner-field">
              <label className="field-label" htmlFor="section-banner-upload">{locale === "ar" ? "بانر صفحة الفئة" : locale === "fr" ? "Bannière de la catégorie" : "Category page banner"}</label>
              {draft.thumbnail && <img className="section-banner-preview" src={api.assetUrl(draft.thumbnail)} alt="" />}
              <label className={`btn btn-secondary${uploadingBanner ? " is-disabled" : ""}`} htmlFor="section-banner-upload">
                {uploadingBanner ? `${bannerProgress}%` : locale === "ar" ? "رفع صورة البانر" : locale === "fr" ? "Importer la bannière" : "Upload banner image"}
              </label>
              <input id="section-banner-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploadingBanner} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCategoryBanner(file); event.currentTarget.value = ""; }} />
              <span className="field-hint">{locale === "ar" ? "تظهر هذه الصورة أعلى صفحة الفئة على الهاتف وسطح المكتب." : locale === "fr" ? "Cette image apparaît en haut de la page catégorie sur mobile et ordinateur." : "Shown at the top of this category page on mobile and desktop."}</span>
            </div>}

            <div className="editor-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="field">
                <label className="field-label" htmlFor="section-display-order">{t(locale, "sections.displayOrder")}</label>
                <input id="section-display-order" className="input" type="number" min="0" step="1"
                  value={draft.sort_order} aria-describedby="section-order-hint"
                  onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))} />
                <span id="section-order-hint" className="field-hint">{t(locale, "sections.displayOrderHint")}</span>
              </div>
              <label className="field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={draft.is_visible}
                  onChange={(e) => setDraft((d) => ({ ...d, is_visible: e.target.checked }))} />
                {t(locale, "sections.visibleInStorefront")}
              </label>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="field-label" style={{ marginBottom: 0 }}>{t(locale, "sections.attributes")}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setDraft((d) => ({ ...d, attrs: [...d.attrs, emptyAttr()] }))}>
                  <FiPlus /> {t(locale, "sections.addAttribute")}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {draft.attrs.length === 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0 }}>{t(locale, "sections.noAttrs")}</p>
                )}
                {draft.attrs.map((a, i) => (
                  <div className="editor-row section-attribute-row" key={i}>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">{t(locale, "sections.attrLabel")}</label>
                      <input className="input" value={a.label} onChange={(e) => patchAttr(i, { label: e.target.value, key: a.key || slugify(e.target.value) })} placeholder={t(locale, "sections.namePh")} />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">{t(locale, "sections.type")}</label>
                      <div className="select-wrap">
                        <select className="select" value={a.type} onChange={(e) => patchAttr(i, { type: e.target.value })}>
                          {ATTR_TYPES.map((tpe) => (
                            <option key={tpe} value={tpe}>{t(locale, TYPE_LABELS[tpe])}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">{t(locale, "sections.level")}</label>
                      <div className="select-wrap">
                        <select className="select" value={a.level} onChange={(e) => patchAttr(i, { level: e.target.value as "product" | "variant" })}>
                          {ATTR_LEVELS.map((lv) => (
                            <option key={lv} value={lv}>{t(locale, LEVEL_LABELS[lv])}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <label className="field-label" style={{ margin: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={a.required} onChange={(e) => patchAttr(i, { required: e.target.checked })} />
                      {t(locale, "sections.required")}
                    </label>
                    <button className="btn btn-ghost btn-sm" aria-label={t(locale, "sections.delete")} style={{ color: "var(--danger)" }} onClick={() => setDraft((d) => ({ ...d, attrs: d.attrs.filter((_, idx) => idx !== i) }))}>
                      <FiTrash2 />
                    </button>
                    {["select", "multi", "color"].includes(a.type) && (
                      <div className="field" style={{ gridColumn: "1 / -1", margin: 0 }}>
                        <label className="field-label">{t(locale, "sections.optionsLabel")}</label>
                        <input className="input" value={a.options} onChange={(e) => patchAttr(i, { options: e.target.value })} placeholder={t(locale, "sections.optionsPh")} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={save} disabled={saving || !Object.values(draft.label_translations).some((value) => value.trim()) || !Number.isSafeInteger(draft.sort_order) || draft.sort_order < 0}>
                {saving ? <span className="spin spin-dark" /> : <FiSave />} {draft.id ? t(locale, "sections.saveChanges") : t(locale, "sections.createSection")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card"><PageLoader /></div>
      ) : (sections ?? []).length === 0 && !open ? (
        <div className="card">
          <EmptyState
            icon={<FiLayers />}
            title={t(locale, "sections.noneYet")}
            sub={t(locale, "sections.noneYetSub")}
            action={<button className="btn btn-primary" onClick={beginCreate} disabled={saving || deleting}><FiPlus /> {t(locale, "sections.newSection")}</button>}
          />
        </div>
      ) : (
        <div className="product-grid">
          {(sections ?? []).map((s) => {
            const Icon = iconOf(s.icon).Icon;
            const isProcessing = deleting && deleteTarget?.id === s.id;
            return (
              <div className={`card section-card${isProcessing ? " card-processing" : ""}`} key={s.id}>
                <div className="section-card-head">
                  <div className="section-card-icon">
                    <Icon />
                  </div>
                  <div className="section-card-info">
                    <div className="section-card-name">{translatedName(s, locale)}</div>
                    <div className="section-card-key">@{s.key}</div>
                    {s.is_visible === false && <span className="field-hint">{t(locale, "sections.hidden")}</span>}
                  </div>
                </div>
                <div className="section-card-attrs">
                  {(s.attribute_defs ?? []).map((d) => (
                    <span className="section-card-attr" key={d.id}>
                      {d.label}
                      {d.required && <span className="section-card-attr-required">*</span>}
                      <span style={{ fontSize: 10, color: "var(--ink-faint)", marginInlineStart: 4 }}>
                        {d.level === "product" ? "(info)" : "(SKU)"}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="section-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => beginEdit(s)} disabled={saving || deleting}>
                    <FiEdit2 /> {t(locale, "sections.edit")}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={deleting} onClick={() => { setDeleteError(""); setDeleteTarget(s); }}>
                    <FiTrash2 /> {t(locale, "sections.delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title={t(locale, "sections.delete")}
        body={<>
          <p>{deleteTarget ? t(locale, "sections.deleteConfirm", translatedName(deleteTarget, locale)) : ""}</p>
          {deleteError && <p className="field-error" role="alert">{deleteError}</p>}
        </>}
        danger
        loading={deleting}
        onConfirm={() => { if (deleteTarget) remove(deleteTarget); }}
        onClose={() => { setDeleteTarget(null); setDeleting(false); setDeleteError(""); }}
      />
    </div>
  );
}
