import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle, FiChevronDown, FiCornerDownRight, FiDownload, FiFileText, FiHelpCircle, FiImage, FiPlus, FiSearch, FiShoppingBag, FiTrash2, FiUpload } from "react-icons/fi";
import { api, type Product } from "../api/client";
import { merchantVariants } from "../lib/catalog";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { EmptyState, PageLoader, Skeleton } from "../components/Skeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";
import { friendlyError } from "../utils/errors";
import { useAuth } from "../auth/AuthContext";
import { t, fmtMoney, useLocale } from "../i18n";
import { OptimizedImage } from "@storefront/core/media";

type TransferStatus = {
  operation: "import" | "export";
  phase: "validating" | "transferring" | "complete" | "error";
  detail?: string;
  processed?: number;
  total?: number;
};

type ExternalImportPolicy = {
  publishProducts: boolean;
  includeUnavailable: boolean;
  defaultAvailableStock: number;
  defaultUnavailableStock: number;
};

type SectionResolution = { keys: string[]; choices: Record<string, string> };

async function jsonNeedsDefaultSection(file: File): Promise<boolean> {
  try {
    const payload = JSON.parse(await file.text()) as { schema?: unknown; products?: unknown };
    if (payload.schema !== "tijarago.catalog") return true;
    if (!Array.isArray(payload.products)) return false;
    return payload.products.some((product) => (
      !product || typeof product !== "object" || !("section" in product) ||
      typeof (product as { section?: unknown }).section !== "string" ||
      !(product as { section: string }).section.trim()
    ));
  } catch {
    return false;
  }
}

export function ProductsPage() {
  const { store } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const locale = useLocale();
  const [view, setView] = useState<"table" | "grid">("table");
  const [q, setQ] = useState("");
  const [sectionFilter, setSectionFilter] = useState<number | "all">("all");
  const importInput = useRef<HTMLInputElement>(null);
  const importMenu = useRef<HTMLDetailsElement>(null);
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const [transferStatus, setTransferStatus] = useState<TransferStatus | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [externalPolicy, setExternalPolicy] = useState<ExternalImportPolicy | null>(null);
  const externalPolicyResolver = useRef<((policy: ExternalImportPolicy | null) => void) | null>(null);
  const [sectionResolution, setSectionResolution] = useState<SectionResolution | null>(null);
  const sectionResolutionResolver = useRef<((choices: Record<string, string> | null) => void) | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteStoreSlug, setDeleteStoreSlug] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState("");
  const [jsonDefaultSection, setJsonDefaultSection] = useState<string | null>(null);
  const jsonSectionResolver = useRef<((section: string | null) => void) | null>(null);
  const expectedDeletePhrase = "delete all products";
  const importFormat = useRef<"csv" | "xlsx" | "json">("xlsx");

  useEffect(() => {
    const closeMenus = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      const target = event.target as Node | null;
      if (event instanceof PointerEvent && (
        importMenu.current?.contains(target) || exportMenu.current?.contains(target)
      )) return;
      importMenu.current?.removeAttribute("open");
      exportMenu.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeMenus);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeMenus);
    };
  }, []);

  const { data: products, loading, error, reload } = useAsync<Product[]>(
    () => (store ? api.listProducts(store.id) : Promise.resolve([])),
    [store?.id],
  );
  const { data: sections } = useAsync(
    () => (store ? api.listSections(store.id) : Promise.resolve([])),
    [store?.id],
  );
  const { data: transferCapabilities } = useAsync(
    () => (store ? api.catalogTransferCapabilities(store.id, locale) : Promise.resolve(null)),
    [store?.id, locale],
  );
  const importAllowed = transferCapabilities?.import.allowed ?? false;
  const isOwner = Boolean(user && store?.members.some((member) => member.email === user.email && member.role === "owner"));

  const requestExternalPolicy = () => new Promise<ExternalImportPolicy | null>((resolve) => {
    externalPolicyResolver.current = resolve;
    setExternalPolicy({ publishProducts: true, includeUnavailable: false, defaultAvailableStock: 1, defaultUnavailableStock: 0 });
  });

  const finishExternalPolicy = (policy: ExternalImportPolicy | null) => {
    externalPolicyResolver.current?.(policy);
    externalPolicyResolver.current = null;
    setExternalPolicy(null);
  };

  const requestSectionResolution = (keys: string[]) => new Promise<Record<string, string> | null>((resolve) => {
    sectionResolutionResolver.current = resolve;
    setSectionResolution({ keys, choices: Object.fromEntries(keys.map((key) => [key, "__create__"])) });
  });

  const finishSectionResolution = (choices: Record<string, string> | null) => {
    sectionResolutionResolver.current?.(choices);
    sectionResolutionResolver.current = null;
    setSectionResolution(null);
  };

  const requestJsonSection = () => new Promise<string | null>((resolve) => {
    jsonSectionResolver.current = resolve;
    setJsonDefaultSection(sections?.[0]?.key ?? "");
  });

  const finishJsonSection = (section: string | null) => {
    jsonSectionResolver.current?.(section);
    jsonSectionResolver.current = null;
    setJsonDefaultSection(null);
  };

  const closeDeleteAll = () => {
    if (deleteAllBusy) return;
    setDeleteAllOpen(false);
    setDeleteStoreSlug("");
    setDeletePhrase("");
    setDeleteAllError("");
  };

  async function deleteAllProducts() {
    if (!store || !products || deleteStoreSlug !== store.slug || deletePhrase !== expectedDeletePhrase) return;
    setDeleteAllBusy(true);
    setDeleteAllError("");
    try {
      const result = await api.deleteAllProducts(store.id, deleteStoreSlug, deletePhrase, products.length);
      setDeleteAllOpen(false);
      setDeleteStoreSlug("");
      setDeletePhrase("");
      toast.push("success", t(locale, "products.deleteAllSuccess", { n: result.deleted }));
      reload();
    } catch (reason) {
      setDeleteAllError(friendlyError(reason, locale, "products.deleteAllFailed"));
      reload();
    } finally {
      setDeleteAllBusy(false);
    }
  }

  const sectionName = (id: number) => sections?.find((s) => s.id === id)?.label ?? "—";

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(needle) || p.ref.toLowerCase().includes(needle));
    }
    if (sectionFilter !== "all") list = list.filter((p) => p.section === sectionFilter);
    return list;
  }, [products, q, sectionFilter]);

  const totalStock = (p: Product) => p.variants.reduce((s, v) => s + v.available_quantity, 0);
  const stockLabel = (p: Product) => {
    if (!p.track_inventory) return <span className="stock-ok">{t(locale, "products.untracked")}</span>;
    const s = totalStock(p);
    if (s === 0) return <span className="stock-out">{t(locale, "products.outOfStock")}</span>;
    if (s <= 5) return <span className="stock-low">{t(locale, "products.low", s)}</span>;
    return <span className="stock-ok">{t(locale, "products.inStock", s)}</span>;
  };

  async function exportProducts(format: "csv" | "xlsx" | "json") {
    if (!store || transferBusy) return;
    setTransferBusy(true);
    setTransferStatus({ operation: "export", phase: "transferring" });
    try {
      const blob = await api.exportCatalog(store.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${store.slug}-products.${format}`; link.click();
      URL.revokeObjectURL(url);
      setTransferStatus({ operation: "export", phase: "complete" });
    } catch (reason) {
      setTransferStatus({ operation: "export", phase: "error", detail: reason instanceof Error ? reason.message : undefined });
    } finally { setTransferBusy(false); }
  }

  async function downloadTemplate(format: "csv" | "xlsx" | "json") {
    if (!store || transferBusy) return;
    setTransferBusy(true);
    try {
      const blob = await api.catalogImportTemplate(store.id, format, locale);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `products-import-template-${locale}.${format}`; link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setTransferStatus({ operation: "export", phase: "error", detail: reason instanceof Error ? reason.message : undefined });
    } finally { setTransferBusy(false); }
  }

  async function importProducts(files: File[]) {
    if (!store || transferBusy) return;
    const file = files[0];
    if (!file) return;
    setTransferBusy(true);
    setTransferStatus({ operation: "import", phase: "validating" });
    try {
      let defaultSection = "";
      if (file.name.toLocaleLowerCase().endsWith(".json") && await jsonNeedsDefaultSection(file)) {
        defaultSection = await requestJsonSection() ?? "";
        if (!defaultSection) { setTransferStatus(null); return; }
      }
      let preview = await api.validateCatalogImport(store.id, files, crypto.randomUUID(), defaultSection);
      let selectedPolicy: ExternalImportPolicy | undefined;
      if (preview.schema === "external-products-json-v1") {
        const policy = await requestExternalPolicy();
        if (!policy) {
          setTransferStatus(null);
          return;
        }
        selectedPolicy = policy;
        preview = await api.validateCatalogImport(store.id, files, crypto.randomUUID(), defaultSection, selectedPolicy);
      }
      const unknownSections = preview.result.unknown_sections ?? [];
      if (unknownSections.length) {
        const choices = await requestSectionResolution(unknownSections);
        if (!choices) {
          setTransferStatus(null);
          return;
        }
        preview = await api.validateCatalogImport(store.id, files, crypto.randomUUID(), defaultSection, selectedPolicy, choices);
      }
      if (!preview.valid) {
        const details = preview.errors.slice(0, 4).map((error) =>
          `${error.sheet ?? "File"}${error.row ? ` ${error.row}` : ""}${error.column ? ` · ${error.column}` : ""}: ${error.message ?? error.code ?? "Invalid value"}`,
        ).join("\n");
        setTransferStatus({ operation: "import", phase: "error", detail: `${t(locale, "products.transfer.validationErrors", { n: preview.errors.length })}\n${details}` });
        return;
      }
      const counts = preview.result.preview;
      const summary = counts
        ? t(locale, "products.transfer.preview", counts)
        : t(locale, "products.transfer.rows", { n: preview.rows });
      const warnings = preview.result.warnings?.join("\n") ?? "";
      const currency = preview.result.currency ? `\n${t(locale, "products.transfer.currency", { currency: preview.result.currency })}` : "";
      setTransferStatus({ operation: "import", phase: "transferring", detail: `${summary}${currency}${warnings ? `\n${warnings}` : ""}` });
      let complete = await api.commitCatalogImport(store.id, preview.id);
      while (complete.status !== "committed") {
        setTransferStatus({ operation: "import", phase: "transferring", processed: complete.result.processed, total: complete.result.total });
        complete = await api.commitCatalogImport(store.id, preview.id);
      }
      setTransferStatus({
        operation: "import", phase: "complete", processed: complete.result.total, total: complete.result.total,
        detail: t(locale, "products.transfer.result", complete.result),
      });
      reload();
    } catch (reason) {
      setTransferStatus({ operation: "import", phase: "error", detail: reason instanceof Error ? reason.message : undefined });
    } finally {
      setTransferBusy(false);
      if (importInput.current) importInput.current.value = "";
    }
  }

  function chooseImportFormat(format: "csv" | "xlsx" | "json") {
    const input = importInput.current;
    if (!input) return;
    importFormat.current = format;
    input.multiple = format === "csv";
    input.accept = format === "xlsx"
      ? ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : format === "json" ? ".json,application/json" : ".csv,text/csv";
    importMenu.current?.removeAttribute("open");
    input.click();
  }

  if (error) {
    return <EmptyState icon={<FiShoppingBag />} title={t(locale, "products.loadError")} sub={error} action={<button className="btn btn-secondary" onClick={reload}>{t(locale, "errors.tryAgain")}</button>} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "products.title")}</h1>
          <p className="d-subtitle">{loading ? <Skeleton style={{ height: 16, width: 200 }} /> : <>{t(locale, "products.subtitle", products?.length ?? 0)}{sectionFilter !== "all" ? ` · ${sectionName(sectionFilter)}` : ""}.</>}</p>
        </div>
        <div className="page-head-actions">
          <details className="catalog-transfer-menu" ref={exportMenu} onToggle={(event) => { if (transferBusy) event.currentTarget.removeAttribute("open"); else if (event.currentTarget.open) importMenu.current?.removeAttribute("open"); }}>
            <summary className={`btn btn-secondary${transferBusy ? " is-disabled" : ""}`} aria-disabled={transferBusy}><FiDownload /> {locale === "fr" ? "Télécharger les produits" : locale === "ar" ? "تنزيل المنتجات" : "Download products"} <FiChevronDown /></summary>
            <div className="catalog-transfer-options" role="menu">
              <button type="button" role="menuitem" disabled={transferBusy} onClick={() => { exportMenu.current?.removeAttribute("open"); void exportProducts("csv"); }}><strong>CSV</strong><small>.csv</small></button>
              <button type="button" role="menuitem" disabled={transferBusy} onClick={() => { exportMenu.current?.removeAttribute("open"); void exportProducts("xlsx"); }}><strong>Excel</strong><small>.xlsx</small></button>
              <button type="button" role="menuitem" disabled={transferBusy} onClick={() => { exportMenu.current?.removeAttribute("open"); void exportProducts("json"); }}><strong>JSON</strong><small>.json</small></button>
            </div>
          </details>
          <details className="catalog-transfer-menu" ref={importMenu} onToggle={(event) => { if (transferBusy || !importAllowed) event.currentTarget.removeAttribute("open"); else if (event.currentTarget.open) exportMenu.current?.removeAttribute("open"); }}>
            <summary className={`btn btn-secondary${transferBusy || !importAllowed ? " is-disabled" : ""}`} aria-disabled={transferBusy || !importAllowed}><FiUpload /> {locale === "fr" ? "Ajouter depuis un fichier" : locale === "ar" ? "إضافة من ملف" : "Add from file"} <FiChevronDown /></summary>
            <div className="catalog-transfer-options" role="menu">
              <button type="button" role="menuitem" disabled={transferBusy} onClick={() => chooseImportFormat("csv")}><strong>CSV</strong><small>.csv</small></button>
              <button type="button" role="menuitem" disabled={transferBusy} onClick={() => chooseImportFormat("xlsx")}><strong>Excel</strong><small>.xlsx</small></button>
              <button type="button" role="menuitem" disabled={transferBusy} onClick={() => chooseImportFormat("json")}><strong>JSON</strong><small>.json</small></button>
            </div>
          </details>
          <input ref={importInput} hidden type="file" onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) void importProducts(files);
          }} />
          {isOwner && Boolean(products?.length) && <button className="btn btn-danger" disabled={transferBusy} onClick={() => setDeleteAllOpen(true)}>
            <FiTrash2 /> {t(locale, "products.deleteAll")}
          </button>}
          <button className="btn btn-primary" onClick={() => navigate("/products/new")}>
            <FiPlus /> {t(locale, "products.newProduct")}
          </button>
        </div>
      </div>
      {transferStatus && (() => {
        const steps = ["validating", "transferring", "complete"] as const;
        const current = transferStatus.phase === "error" ? -1 : steps.indexOf(transferStatus.phase);
        const determinate = Boolean(transferStatus.total);
        const percent = transferStatus.phase === "complete" ? 100 : determinate
          ? Math.min(100, Math.round(((transferStatus.processed ?? 0) / (transferStatus.total ?? 1)) * 100))
          : transferStatus.phase === "validating" ? 18 : 52;
        const titleKey = transferStatus.phase === "error"
          ? "error"
          : transferStatus.operation === "export"
            ? transferStatus.phase === "complete" ? "exportComplete" : "exporting"
            : transferStatus.phase;
        return <section className={`catalog-transfer-progress is-${transferStatus.phase}`} role={transferStatus.phase === "error" ? "alert" : "status"} aria-live="polite">
          <div className="catalog-transfer-progress-icon" aria-hidden="true">
            {transferStatus.phase === "complete" ? <FiCheckCircle /> : transferStatus.phase === "error" ? <FiAlertCircle /> : <FiFileText />}
          </div>
          <div className="catalog-transfer-progress-body">
            <div className="catalog-transfer-progress-heading">
              <div><strong>{t(locale, `products.transfer.${titleKey}`)}</strong><span>{t(locale, `products.transfer.${transferStatus.operation}Hint`)}</span></div>
              {determinate && <b dir="ltr">{new Intl.NumberFormat(locale).format(transferStatus.processed ?? 0)} / {new Intl.NumberFormat(locale).format(transferStatus.total ?? 0)}</b>}
            </div>
            <div className="catalog-transfer-progress-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
            {transferStatus.operation === "import" && <ol className="catalog-transfer-progress-steps">
              {steps.map((step, index) => <li key={step} className={index < current || transferStatus.phase === "complete" ? "is-done" : index === current ? "is-current" : ""}>
                <span>{index < current || transferStatus.phase === "complete" ? "✓" : index + 1}</span>{t(locale, `products.transfer.step.${step}`)}
              </li>)}
            </ol>}
            {transferStatus.detail && <p className="catalog-transfer-progress-detail">{transferStatus.detail}</p>}
          </div>
        </section>;
      })()}

      <ConfirmModal
        open={jsonDefaultSection !== null}
        title={t(locale, "products.transfer.defaultSectionTitle")}
        confirmLabel={t(locale, "products.transfer.defaultSectionConfirm")}
        confirmDisabled={!jsonDefaultSection}
        maxWidth={560}
        onClose={() => finishJsonSection(null)}
        onConfirm={() => finishJsonSection(jsonDefaultSection)}
        body={<div className="json-section-picker">
          <p>{t(locale, "products.transfer.defaultSectionIntro")}</p>
          <div className="json-section-options" role="radiogroup">
            {(sections ?? []).map((section) => <button
              type="button"
              role="radio"
              aria-checked={jsonDefaultSection === section.key}
              className={jsonDefaultSection === section.key ? "is-selected" : ""}
              key={section.key}
              onClick={() => setJsonDefaultSection(section.key)}
            >
              <span>{section.label}</span><small>{section.key}</small>
              <b aria-hidden="true">{jsonDefaultSection === section.key ? "✓" : ""}</b>
            </button>)}
          </div>
        </div>}
      />

      <ConfirmModal
        open={deleteAllOpen}
        title={t(locale, "products.deleteAllTitle")}
        danger
        loading={deleteAllBusy}
        confirmDisabled={deleteStoreSlug !== store?.slug || deletePhrase !== expectedDeletePhrase}
        confirmLabel={t(locale, "products.deleteAllConfirm")}
        onClose={closeDeleteAll}
        onConfirm={deleteAllProducts}
        maxWidth={560}
        body={<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p>{t(locale, "products.deleteAllWarning", { n: products?.length ?? 0 })}</p>
          <div className="field">
            <label className="field-label" htmlFor="delete-products-store">{t(locale, "products.deleteAllTypeStore", { value: store?.slug ?? "" })}</label>
            <input id="delete-products-store" data-modal-autofocus className="input mono" value={deleteStoreSlug} onChange={(event) => setDeleteStoreSlug(event.target.value)} autoComplete="off" spellCheck={false} disabled={deleteAllBusy} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="delete-products-phrase">{t(locale, "products.deleteAllTypePhrase", { value: expectedDeletePhrase })}</label>
            <input id="delete-products-phrase" className="input mono" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} autoComplete="off" spellCheck={false} disabled={deleteAllBusy} />
          </div>
          {deleteAllError && <div className="field-error" role="alert">{deleteAllError}</div>}
        </div>}
      />

      <ConfirmModal
        open={externalPolicy !== null}
        title={t(locale, "products.transfer.externalTitle")}
        confirmLabel={t(locale, "products.transfer.externalConfirm")}
        cancelLabel={t(locale, "confirm.cancel")}
        maxWidth={580}
        dialogClassName="external-import-modal"
        onClose={() => finishExternalPolicy(null)}
        onConfirm={() => { if (externalPolicy) finishExternalPolicy(externalPolicy); }}
        body={externalPolicy && <div className="external-import-policy">
          <p>{t(locale, "products.transfer.externalIntro")}</p>
          <label className="external-policy-toggle">
            <input type="checkbox" checked={externalPolicy.publishProducts} onChange={(event) => setExternalPolicy({ ...externalPolicy, publishProducts: event.target.checked })} />
            <span><strong>{t(locale, "products.transfer.publishProducts")}</strong><small>{t(locale, "products.transfer.publishProductsHint")}</small></span>
          </label>
          <label className="external-policy-field">
            <span><strong>{t(locale, "products.transfer.availableStock")}</strong><small>{t(locale, "products.transfer.exactStockHint")}</small></span>
            <input className="input" type="number" min={0} max={1000000} value={externalPolicy.defaultAvailableStock} onChange={(event) => setExternalPolicy({ ...externalPolicy, defaultAvailableStock: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label className="external-policy-toggle">
            <input type="checkbox" checked={externalPolicy.includeUnavailable} onChange={(event) => setExternalPolicy({ ...externalPolicy, includeUnavailable: event.target.checked })} />
            <span><strong>{t(locale, "products.transfer.includeUnavailable")}</strong><small>{t(locale, "products.transfer.includeUnavailableHint")}</small></span>
          </label>
          {externalPolicy.includeUnavailable && <label className="external-policy-field">
            <span><strong>{t(locale, "products.transfer.unavailableStock")}</strong></span>
            <input className="input" type="number" min={0} max={1000000} value={externalPolicy.defaultUnavailableStock} onChange={(event) => setExternalPolicy({ ...externalPolicy, defaultUnavailableStock: Math.max(0, Number(event.target.value) || 0) })} />
          </label>}
        </div>}
      />

      <ConfirmModal
        open={sectionResolution !== null}
        title={t(locale, "products.transfer.sectionsTitle")}
        confirmLabel={t(locale, "products.transfer.sectionsConfirm")}
        maxWidth={620}
        onClose={() => finishSectionResolution(null)}
        onConfirm={() => { if (sectionResolution) finishSectionResolution(sectionResolution.choices); }}
        body={sectionResolution && <div className="section-resolution-flow">
          <p>{t(locale, "products.transfer.sectionsIntro")}</p>
          {sectionResolution.keys.map((key) => {
            const choice = sectionResolution.choices[key];
            const creating = choice === "__create__";
            const choose = (value: string) => setSectionResolution({
              ...sectionResolution, choices: { ...sectionResolution.choices, [key]: value },
            });
            return <article className="section-resolution-card" key={key}>
              <header><span>{t(locale, "products.transfer.sourceSection")}</span><strong>{key}</strong></header>
              <div className="section-resolution-modes">
                <button type="button" className={creating ? "is-selected" : ""} aria-pressed={creating} onClick={() => choose("__create__")}>
                  <i><FiPlus /></i><span><strong>{t(locale, "products.transfer.createNewSection")}</strong><small>{t(locale, "products.transfer.createNewHint", { name: key })}</small></span>{creating && <FiCheckCircle />}
                </button>
                <button type="button" disabled={!sections?.length} className={!creating ? "is-selected" : ""} aria-pressed={!creating} onClick={() => sections?.[0] && choose(sections[0].key)}>
                  <i><FiCornerDownRight /></i><span><strong>{t(locale, "products.transfer.useExistingSection")}</strong><small>{t(locale, "products.transfer.useExistingHint")}</small></span>{!creating && <FiCheckCircle />}
                </button>
              </div>
              {!creating && <div className="section-resolution-targets" role="radiogroup" aria-label={t(locale, "products.transfer.useExistingSection")}>
                {(sections ?? []).map((section) => <button type="button" role="radio" aria-checked={choice === section.key} className={choice === section.key ? "is-selected" : ""} key={section.key} onClick={() => choose(section.key)}>
                  <span>{section.label}</span><small>{section.key}</small>{choice === section.key && <FiCheckCircle />}
                </button>)}
              </div>}
            </article>;
          })}
        </div>}
      />

      {transferCapabilities?.guide && (
        <section className="card catalog-import-guide" aria-labelledby="catalog-import-guide-title">
          <div className="catalog-import-guide-heading">
            <FiHelpCircle aria-hidden="true" />
            <div>
              <h2 id="catalog-import-guide-title">{transferCapabilities.guide.title}</h2>
              <p>{transferCapabilities.guide.summary}</p>
            </div>
          </div>
          <ol>{transferCapabilities.guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <div className="catalog-template-actions">
            <button className="btn btn-secondary btn-sm" disabled={transferBusy} onClick={() => void downloadTemplate("xlsx")}><FiDownload /> {t(locale, "products.transfer.excelTemplate")}</button>
            <button className="btn btn-secondary btn-sm" disabled={transferBusy} onClick={() => void downloadTemplate("csv")}><FiDownload /> {t(locale, "products.transfer.csvTemplate")}</button>
            <button className="btn btn-secondary btn-sm" disabled={transferBusy} onClick={() => void downloadTemplate("json")}><FiDownload /> {t(locale, "products.transfer.jsonSample")}</button>
          </div>
        </section>
      )}

      <div className="toolbar">
        <div className="search-box">
          <FiSearch />
          <input className="input" placeholder={t(locale, "products.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {(["all", ...(sections?.map((s) => s.id) ?? [])] as (number | "all")[]).map((id) => (
            <button key={String(id)} className={sectionFilter === id ? "active" : ""} onClick={() => setSectionFilter(id)}>
              {id === "all" ? t(locale, "products.all") : sectionName(id as number)}
            </button>
          ))}
        </div>
        <div className="seg" style={{ marginInlineStart: "auto" }}>
          <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>{t(locale, "products.table")}</button>
          <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>{t(locale, "products.grid")}</button>
        </div>
      </div>

      {loading ? (
        <div className="card"><PageLoader /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FiShoppingBag />}
            title={q || sectionFilter !== "all" ? t(locale, "products.noMatch") : t(locale, "products.noneYet")}
            sub={q || sectionFilter !== "all" ? t(locale, "products.noMatchSub") : t(locale, "products.noneYetSub")}
            action={<button className="btn btn-primary" onClick={() => navigate("/products/new")}><FiPlus /> {t(locale, "products.newProduct")}</button>}
          />
        </div>
      ) : (
        <div data-view={view}>
          {/* Grid — always visible on mobile, only in grid mode on desktop */}
          <div className="product-grid product-grid-force products-grid">
            {filtered.map((p) => {
              const img = p.images.find((i) => i.is_primary) ?? p.images[0];
              return (
                <div key={p.id} className="product-tile" onClick={() => navigate(`/products/${p.id}`)}>
                  <div className="product-tile-img">
                    {img ? <OptimizedImage src={api.assetUrl(img.image)} widthHint={160} widths={[80, 120, 160]} sizes="72px" alt="" /> : <FiImage />}
                    {p.images.length > 1 && <span className="img-count">{p.images.length}</span>}
                  </div>
                  <div className="product-tile-body">
                    <b>{p.name}</b>
                    <div className="product-tile-meta">
                      <span className="product-tile-price">{fmtMoney(p.price, undefined, locale)}</span>
                      <span className="badge badge-neutral">{sectionName(p.section)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table — visible in table mode on desktop, hidden on mobile */}
          <div className="card table-wrap product-table-wrap products-table">
            <table className="table product-table">
            <thead>
              <tr>
                <th>{t(locale, "products.thProduct")}</th>
                <th>{t(locale, "products.thRef")}</th>
                <th>{t(locale, "products.thSection")}</th>
                <th>{t(locale, "products.thPrice")}</th>
                <th>{t(locale, "products.thStock")}</th>
                <th>{t(locale, "products.thStatus")}</th>
                <th style={{ textAlign: "end" }}>{t(locale, "products.thActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const img = p.images.find((i) => i.is_primary) ?? p.images[0];
                return (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/products/${p.id}`)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {img ? (
                          <OptimizedImage className="thumb" src={api.assetUrl(img.image)} widthHint={480} widths={[240, 360, 480]} sizes="220px" alt="" />
                        ) : (
                          <div className="thumb-empty"><FiImage /></div>
                        )}
                        <div>
                          <div className="row-main">{p.name}</div>
                          <div className="row-sub">{t(locale, "products.variantCount", merchantVariants(p.variants).length)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>{p.ref}</td>
                    <td><span className="badge badge-neutral">{sectionName(p.section)}</span></td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{fmtMoney(p.price, undefined, locale)}</td>
                    <td>{stockLabel(p)}</td>
                    <td>{!p.inventory_ready
                      ? <span className="badge badge-warning">{t(locale, "products.needsInventory")}</span>
                      : p.is_active
                        ? <span className="badge badge-success">{t(locale, "products.active")}</span>
                        : <span className="badge badge-neutral">{t(locale, "products.hidden")}</span>}</td>
                    <td className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}`); }}>{t(locale, "products.edit")}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
