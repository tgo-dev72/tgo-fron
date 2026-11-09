import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheck,
  FiDroplet,
  FiGrid,
  FiHome,
  FiLink,
  FiMonitor,
  FiPenTool,
  FiShoppingBag,
  FiShoppingCart,
  FiStar,
  FiTool,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { api, type RetailType } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useLocale, t, retailLabel } from "../i18n";
import { useToast } from "../components/Toast";
import { PageLoader } from "../components/Skeleton";
import { friendlyError } from "../utils/errors";

const RETAIL_ICONS: Record<string, IconType> = {
  clothing: FiShoppingBag,
  electronics: FiMonitor,
  food: FiShoppingCart,
  jewelry: FiStar,
  cosmetics: FiDroplet,
  furniture: FiHome,
  books: FiBookOpen,
  art: FiPenTool,
  hardware: FiTool,
  general: FiGrid,
};

function RetailIcon({ type }: { type?: string }) {
  const Icon = RETAIL_ICONS[type ?? ""] ?? FiGrid;
  return <Icon aria-hidden="true" />;
}

const RETAIL_FEATURES: Record<string, string[]> = {
  clothing: ["sizes", "colors", "seasonal"],
  electronics: ["warranty", "specs", "variants"],
  food: ["weight", "expiry", "nutrition"],
  jewelry: ["material", "weight", "gemstone"],
  cosmetics: ["skin_type", "ingredients", "volume"],
  furniture: ["dimensions", "material", "assembly"],
  books: ["author", "isbn", "pages"],
  art: ["medium", "dimensions", "edition"],
  hardware: ["dimensions", "material", "grade"],
  general: ["basic_fields"],
};

const STOREFRONT_BASE_DOMAIN = (import.meta.env.VITE_STOREFRONT_BASE_DOMAIN as string | undefined)?.trim() || "tijarago.com";

const VALID_STORE_SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function StoreCreatorPage() {
  const locale = useLocale();
  const toast = useToast();
  const navigate = useNavigate();

  const { data: retailTypes, loading: typesLoading, error: typesError, reload: reloadTypes } = useAsync<RetailType[]>(
    () => api.listRetailTypes(),
    [],
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [retailTypeId, setRetailTypeId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const autoSlug = useMemo(() => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);
  }, [name]);

  const displaySlug = slug || autoSlug;
  const canNext = name.trim().length >= 2 && displaySlug.length >= 2 && VALID_STORE_SLUG.test(displaySlug);
  const canSubmit = canNext && retailTypeId !== null;

  const selectedType = retailTypes?.find((rt) => rt.id === retailTypeId);

  async function handleCreate() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const store = await api.createStore({
        name: name.trim(),
        slug: displaySlug,
        retail_type: retailTypeId,
      });
      if (!store.storefront_request_id) throw new Error("storefront_request_unavailable");
      await api.startStorefront(store.storefront_request_id);
      toast.push("success", t(locale, "storeCreate.created"));
      navigate("/", { replace: true });
      window.location.reload();
    } catch (err: unknown) {
      toast.push("error", friendlyError(err, locale, "storeCreate.failed"));
      setSaving(false);
    }
  }

  if (typesLoading) {
    return (
      <div className="card"><PageLoader /></div>
    );
  }

  return (
    <div className="store-create">
      <div className="store-create-inner">
        {/* Header */}
        <div className="store-create-header">
          <button className="btn btn-ghost btn-sm" onClick={() => (step === 1 ? navigate("/") : setStep(1))}>
            <FiArrowLeft /> {t(locale, "storeCreate.back")}
          </button>
          <div className="store-create-hero">
            <img src="/brand/logos/tyjara-go-green-lime.svg" alt="" className="store-create-hero-icon" width="80" height="80" />
            <h1>{t(locale, "storeCreate.title")}</h1>
            <p>{t(locale, "storeCreate.subtitle")}</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="store-steps">
          <div className={`store-step ${step >= 1 ? "done" : ""} ${step === 1 ? "active" : ""}`}>
            <div className="store-step-dot">1</div>
            <div className="store-step-label">{t(locale, "storeCreate.stepDetails")}</div>
          </div>
          <div className="store-step-line" />
          <div className={`store-step ${step >= 2 ? "done" : ""} ${step === 2 ? "active" : ""}`}>
            <div className="store-step-dot">2</div>
            <div className="store-step-label">{t(locale, "storeCreate.stepRetail")}</div>
          </div>
        </div>

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="store-create-section">
            <div className="card">
              <div className="store-section-header">
                <h2>{t(locale, "storeCreate.stepDetails")}</h2>
                <span className="store-section-desc">{t(locale, "storeCreate.stepDetailsDesc")}</span>
              </div>
              <div className="store-form-body">
                <div className="field">
                  <label className="field-label">{t(locale, "storeCreate.storeName")}</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t(locale, "storeCreate.storeNamePh")}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "storeCreate.slug")}</label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50))}
                    placeholder={autoSlug}
                    minLength={2}
                    maxLength={50}
                    pattern="[a-z][a-z0-9]*(?:-[a-z0-9]+)*"
                  />
                  {displaySlug && (
                    <div className="store-url-preview">
                      <FiLink />
                      <span>{displaySlug}.{STOREFRONT_BASE_DOMAIN}</span>
                    </div>
                  )}
                  {!displaySlug && (
                    <div className="field-hint">{t(locale, "storeCreate.slugHint")}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="store-create-actions">
              <button className="btn btn-ghost" onClick={() => navigate("/")}>
                {t(locale, "storeCreate.cancel")}
              </button>
              <button
                className="btn btn-primary"
                disabled={!canNext}
                onClick={() => setStep(2)}
              >
                {t(locale, "storeCreate.stepRetail")} <FiArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Retail type */}
        {step === 2 && (
          <div className="store-create-section">
            <div className="card">
              <div className="store-section-header">
                <h2>{t(locale, "storeCreate.retailTypeTitle")}</h2>
                <span className="store-section-desc">{t(locale, "storeCreate.chooseRetailHint")}</span>
              </div>
              <div className="retail-type-grid">
                {typesError && (
                  <div className="retail-type-empty">
                    <p>{typesError}</p>
                    <button className="btn btn-secondary btn-sm" onClick={reloadTypes}>
                      {t(locale, "errors.tryAgain")}
                    </button>
                  </div>
                )}
                {(retailTypes ?? []).map((rt) => (
                  <button
                    key={rt.id}
                    className={`retail-type-card${retailTypeId === rt.id ? " selected" : ""}`}
                    onClick={() => setRetailTypeId(rt.id)}
                  >
                    {retailTypeId === rt.id && (
                      <div className="retail-type-check"><FiCheck /></div>
                    )}
                    <div className="retail-type-icon">
                      <RetailIcon type={rt.key} />
                    </div>
                    <div className="retail-type-label">
                      {retailLabel(locale, rt.key, rt.label)}
                    </div>
                    {rt.description && (
                      <div className="retail-type-desc">{rt.description}</div>
                    )}
                    {RETAIL_FEATURES[rt.key] && (
                      <div className="retail-type-features">
                        {RETAIL_FEATURES[rt.key].map((f) => (
                          <span key={f} className="retail-feature-tag">{f}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
                {!typesError && (!retailTypes || retailTypes.length === 0) && (
                  <div className="retail-type-empty">{t(locale, "storeCreate.noRetailTypes")}</div>
                )}
              </div>
            </div>
            {selectedType && (
              <div className="card store-selected-summary">
                <div className="store-selected-row">
                  <span className="store-selected-label">{t(locale, "storeCreate.storeName")}:</span>
                  <span className="store-selected-value">{name}</span>
                </div>
                <div className="store-selected-row">
                  <span className="store-selected-label">{t(locale, "storeCreate.yourStoreUrl")}:</span>
                  <span className="store-selected-value">{displaySlug}.{STOREFRONT_BASE_DOMAIN}</span>
                </div>
                <div className="store-selected-row">
                  <span className="store-selected-label">{t(locale, "storeCreate.retailTypeTitle")}:</span>
                  <span className="store-selected-value">
                    <RetailIcon type={selectedType.key} />
                    <span>{retailLabel(locale, selectedType.key, selectedType.label)}</span>
                  </span>
                </div>
              </div>
            )}
            <div className="store-create-actions">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                <FiArrowLeft /> {t(locale, "storeCreate.stepDetails")}
              </button>
              <button
                className="btn btn-primary"
                disabled={!canSubmit || saving}
                onClick={handleCreate}
              >
                {saving ? (
                  <>
                    <span className="spin" /> {t(locale, "storeCreate.creating")}
                  </>
                ) : (
                  <>
                    <FiCheck /> {t(locale, "storeCreate.create")}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
