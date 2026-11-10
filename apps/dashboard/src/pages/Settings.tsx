import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheck, FiDollarSign, FiFileText, FiSave, FiSettings, FiShoppingBag, FiLayout, FiUsers, FiTrash2, FiUserPlus, FiUpload, FiX, FiShield, FiMessageCircle } from "react-icons/fi";
import { api, ApiError, type StoreMember, type StoreConfig, type StoreEmailForwarding } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { PageLoader } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { t, useLocale, type Locale } from "../i18n";
import { friendlyError } from "../utils/errors";
import { ConfirmModal } from "../components/ConfirmModal";
import { ModalShell, useLastPresent } from "../components/ModalShell";
import { useAuth } from "../auth/AuthContext";
import { CatalogSettings } from "../components/CatalogSettings";
import { DomainSettings } from "../components/DomainSettings";
import { OptimizedImage } from "@storefront/core/media";
import PhoneInput from "react-phone-number-input";
import arPhoneLabels from "react-phone-number-input/locale/ar.json";
import enPhoneLabels from "react-phone-number-input/locale/en.json";
import frPhoneLabels from "react-phone-number-input/locale/fr.json";

type Section = "general" | "contacts" | "catalog" | "invoicing" | "payment" | "storefront" | "team" | "danger";

const SETTINGS_GROUPS = {
  en: { profile: "Store profile", commerce: "Commerce", access: "People & access", advanced: "Advanced" },
  fr: { profile: "Profil de la boutique", commerce: "Commerce", access: "Équipe et accès", advanced: "Avancé" },
  ar: { profile: "ملف المتجر", commerce: "التجارة", access: "الفريق والصلاحيات", advanced: "متقدم" },
} as const;

const PAYMENT_COPY = {
  en: { title: "Payment settings", intro: "Choose how customers can pay at checkout.", methods: "Payment methods", cod: "Cash on delivery (COD)", codHelp: "Customers pay when their order arrives.", default: "Default", online: "Online payment", onlineHelp: "Online gateways will become available in a future release.", active: "Selected provider", configured: "Ready", needsSetup: "Setup required", future: "Future feature", futureHelp: "This provider is planned but cannot be connected yet.", choose: "Use this provider", credentials: "Provider credentials", safety: "Payment credentials are encrypted and never shown to customers." },
  fr: { title: "Paramètres de paiement", intro: "Choisissez comment vos clients peuvent payer lors de la commande.", methods: "Moyens de paiement", cod: "Paiement à la livraison", codHelp: "Le client paie lorsque sa commande arrive.", default: "Par défaut", online: "Paiement en ligne", onlineHelp: "Les passerelles en ligne seront disponibles dans une prochaine version.", active: "Fournisseur sélectionné", configured: "Prêt", needsSetup: "Configuration requise", future: "Fonctionnalité future", futureHelp: "Ce fournisseur est prévu mais ne peut pas encore être connecté.", choose: "Utiliser ce fournisseur", credentials: "Identifiants du fournisseur", safety: "Les identifiants sont chiffrés et ne sont jamais visibles par les clients." },
  ar: { title: "إعدادات الدفع", intro: "اختر طرق الدفع المتاحة للعملاء عند إتمام الطلب.", methods: "طرق الدفع", cod: "الدفع عند الاستلام", codHelp: "يدفع العميل عند وصول طلبه.", default: "الافتراضي", online: "الدفع الإلكتروني", onlineHelp: "ستتوفر بوابات الدفع الإلكتروني في إصدار مستقبلي.", active: "المزود المحدد", configured: "جاهز", needsSetup: "يتطلب الإعداد", future: "ميزة مستقبلية", futureHelp: "هذا المزود مخطط له ولكن لا يمكن ربطه حالياً.", choose: "استخدام هذا المزود", credentials: "بيانات اعتماد المزود", safety: "تُشفّر بيانات الدفع ولا تظهر للعملاء أبداً." },
} as const;

const INVOICE_COPY = {
  en: { title: "Invoicing", intro: "Configure the legal identity and tax basis captured when an invoice is issued.", active: "Issue invoices automatically", activeHint: "The invoice language is selected when the merchant confirms the order. Online and cash-on-delivery invoices are issued when delivery is confirmed.", identity: "Billing identity", legalName: "Legal seller name", address: "Billing address", country: "Country", email: "Billing contact email", issuer: "Approved issuer scope", issuerHint: "Stores belonging to the same legal issuer must use the same scope to share one sequence.", series: "Series prefix", taxes: "VAT and tax treatment", taxRate: "Store tax rate (%)", taxRateHint: "Use 0% when all products are tax-exempt.", taxRateRequired: "Enter the store tax percentage. Use 0% if all products are exempt.", taxRateInvalid: "The store tax percentage must be between 0% and 100%.", inclusive: "Entered prices include tax", wording: "Exemption or tax wording", shipping: "Shipping", threshold: "Free-shipping threshold", thresholdHint: "Applied only when the discounted merchandise subtotal, excluding shipping and tax, is strictly greater than the threshold.", preview: "PDF preview", previewAction: "Refresh preview", identifiers: "Legal identifiers", reviewTitle: "Review invoice information", reviewIntro: "Please confirm the information entered. Empty fields will remain blank on future invoices until you complete them.", completed: "Completed fields", missing: "Empty fields", noMissing: "All invoice fields are completed.", confirmSave: "Confirm and save" },
  fr: { title: "Facturation", intro: "Configurez l’identité légale et la base fiscale capturées lors de l’émission.", active: "Émettre automatiquement les factures", activeHint: "La langue est choisie lorsque le marchand confirme la commande. Les factures en ligne et à la livraison sont émises après confirmation de la livraison.", identity: "Identité de facturation", legalName: "Raison sociale", address: "Adresse de facturation", country: "Pays", email: "E-mail de facturation", issuer: "Périmètre émetteur approuvé", issuerHint: "Les boutiques du même émetteur légal doivent partager ce périmètre et la même séquence.", series: "Préfixe de série", taxes: "TVA et traitement fiscal", taxRate: "Taux de taxe de la boutique (%)", taxRateHint: "Utilisez 0 % lorsque tous les produits sont exonérés.", taxRateRequired: "Saisissez le taux de taxe de la boutique. Utilisez 0 % si tous les produits sont exonérés.", taxRateInvalid: "Le taux de taxe de la boutique doit être compris entre 0 % et 100 %.", inclusive: "Les prix saisis incluent la taxe", wording: "Mention d’exonération ou fiscale", shipping: "Livraison", threshold: "Seuil de livraison gratuite", thresholdHint: "S’applique uniquement lorsque le sous-total articles remisé, hors livraison et taxes, est strictement supérieur au seuil.", preview: "Aperçu PDF", previewAction: "Actualiser l’aperçu", identifiers: "Identifiants légaux", reviewTitle: "Vérifier les informations de facturation", reviewIntro: "Veuillez confirmer les informations saisies. Les champs vides resteront absents des prochaines factures jusqu’à ce que vous les complétiez.", completed: "Champs renseignés", missing: "Champs vides", noMissing: "Toutes les informations de facturation sont renseignées.", confirmSave: "Confirmer et enregistrer" },
  ar: { title: "الفوترة", intro: "إعداد الهوية القانونية والأساس الضريبي المحفوظ عند إصدار الفاتورة.", active: "إصدار الفواتير تلقائياً", activeHint: "يختار التاجر لغة الفاتورة عند تأكيد الطلب. تُصدر فواتير الدفع الإلكتروني والدفع عند الاستلام بعد تأكيد التوصيل.", identity: "هوية الفوترة", legalName: "الاسم القانوني للبائع", address: "عنوان الفوترة", country: "البلد", email: "بريد الفوترة", issuer: "نطاق المُصدر المعتمد", issuerHint: "يجب أن تستخدم المتاجر التابعة لنفس المُصدر القانوني النطاق نفسه لتشارك تسلسلاً واحداً.", series: "بادئة السلسلة", taxes: "الضريبة والمعالجة الجبائية", taxRate: "نسبة ضريبة المتجر (%)", taxRateHint: "استخدم 0٪ عندما تكون جميع المنتجات معفاة من الضريبة.", taxRateRequired: "أدخل نسبة ضريبة المتجر، واستخدم 0٪ إذا كانت جميع المنتجات معفاة.", taxRateInvalid: "يجب أن تكون نسبة ضريبة المتجر بين 0٪ و100٪.", inclusive: "الأسعار المدخلة تشمل الضريبة", wording: "صيغة الإعفاء أو الضريبة", shipping: "الشحن", threshold: "حد الشحن المجاني", thresholdHint: "يُطبق فقط عندما يكون مجموع المنتجات بعد الخصم، دون الشحن والضريبة، أكبر بشكل صارم من الحد.", preview: "معاينة PDF", previewAction: "تحديث المعاينة", identifiers: "المعرفات القانونية", reviewTitle: "مراجعة معلومات الفوترة", reviewIntro: "يرجى تأكيد المعلومات المدخلة. ستبقى الحقول الفارغة غير ظاهرة في الفواتير القادمة إلى أن تستكملها.", completed: "الحقول المكتملة", missing: "الحقول الفارغة", noMissing: "جميع معلومات الفوترة مكتملة.", confirmSave: "تأكيد وحفظ" },
} as const;

const SEO_COPY = {
  en: {
    title: "Search engine visibility",
    seoTitle: "Homepage title in search results",
    socialImage: "Social sharing image URL",
    description: "Homepage description in search results",
    characters: "characters",
    allowIndexing: "Allow search engines to show this store in search results",
    indexingHint: "This is an indexing request. TijaraGO will publish the store to search engines only when it is live, healthy, linked to its official address, and production indexing is enabled.",
  },
  fr: {
    title: "Visibilité dans les moteurs de recherche",
    seoTitle: "Titre de la page d’accueil dans les résultats de recherche",
    socialImage: "URL de l’image de partage social",
    description: "Description de la page d’accueil dans les résultats de recherche",
    characters: "caractères",
    allowIndexing: "Autoriser les moteurs de recherche à afficher cette boutique",
    indexingHint: "Il s’agit d’une demande d’indexation. TijaraGO ne publiera la boutique dans les moteurs de recherche que lorsqu’elle sera en ligne, opérationnelle, liée à son adresse officielle et que l’indexation en production sera activée.",
  },
  ar: {
    title: "الظهور في محركات البحث",
    seoTitle: "عنوان الصفحة الرئيسية في نتائج البحث",
    socialImage: "رابط صورة المشاركة على مواقع التواصل",
    description: "وصف الصفحة الرئيسية في نتائج البحث",
    characters: "حرفًا",
    allowIndexing: "السماح لمحركات البحث بإظهار هذا المتجر في نتائج البحث",
    indexingHint: "هذا طلب لفهرسة المتجر. لن تسمح TijaraGO بظهوره في محركات البحث إلا بعد نشره والتأكد من أنه يعمل بشكل سليم ومرتبط بعنوانه الرسمي، وبعد تفعيل الفهرسة في المنصة.",
  },
} as const;

const SOCIAL_CHANNELS = ["instagram", "facebook", "tiktok", "youtube", "x", "pinterest", "linkedin"] as const;

const ROLE_KEYS = ["owner", "admin", "staff", "delivery"] as const;

function roleLabels(locale: Locale): Record<string, string> {
  return Object.fromEntries(ROLE_KEYS.map((k) => [k, t(locale, `roles.${k}`)]));
}

function initial(email: string): string {
  return (email || "?")[0].toUpperCase();
}

function paymentFieldLabel(locale: Locale, key: string, secret: boolean): string {
  const normalized = key.toLowerCase();
  if (normalized.includes("sandbox") || normalized.includes("test")) return t(locale, "settings.paymentPractice");
  if (secret || normalized.includes("token") || normalized.includes("private")) return t(locale, "settings.paymentSecureCode");
  if (normalized.includes("public") || normalized.includes("account")) return t(locale, "settings.paymentAccountId");
  return t(locale, "settings.paymentAccountDetail");
}

export function SettingsPage() {
  const { store, reload: reloadStores, updateStore } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const locale = useLocale();
  const settingsGroups = SETTINGS_GROUPS[locale];
  const paymentCopy = PAYMENT_COPY[locale];
  const invoiceCopy = INVOICE_COPY[locale];
  const seoCopy = SEO_COPY[locale];
  const phoneLabels = locale === "ar" ? arPhoneLabels : locale === "fr" ? frPhoneLabels : enPhoneLabels;
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("general");
  const [form, setForm] = useState<StoreConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceReviewOpen, setInvoiceReviewOpen] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [emailRoute, setEmailRoute] = useState<StoreEmailForwarding | null>(null);
  const [forwardDestination, setForwardDestination] = useState("");
  const [emailRouteBusy, setEmailRouteBusy] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStoreName, setDeleteStoreName] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  deletingRef.current = deleting;

  const expectedStoreName = store?.slug ?? "";
  const expectedConfirmation = "delete my store";
  const isOwner = Boolean(
    user && store?.members.some((member) => member.email === user.email && member.role === "owner"),
  );

  const { data: config, loading, reload } = useAsync<StoreConfig | null>(
    () => (store ? api.getConfig(store.id) : Promise.resolve(null)),
    [store?.id],
  );

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  useEffect(() => {
    if (form && !form.invoice_issuance_available && section === "invoicing") setSection("general");
  }, [form?.invoice_issuance_available, section]);

  useEffect(() => () => { if (invoicePreview) URL.revokeObjectURL(invoicePreview); }, [invoicePreview]);

  async function refreshInvoicePreview() {
    if (!store || previewBusy) return;
    setPreviewBusy(true);
    try {
      const blob = await api.invoicePreview(store.id);
      const next = URL.createObjectURL(blob);
      setInvoicePreview((current) => { if (current) URL.revokeObjectURL(current); return next; });
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "settings.saveFailed"));
    } finally { setPreviewBusy(false); }
  }

  useEffect(() => {
    setEmailRoute(null);
    setForwardDestination("");
    if (!store || !isOwner) return;
    let cancelled = false;
    api.getEmailForwarding(store.id).then((route) => {
      if (!cancelled) {
        setEmailRoute(route);
        setForwardDestination(route.pending_destination || route.active_destination);
      }
    }).catch(() => { if (!cancelled) setEmailRoute(null); });
    return () => { cancelled = true; };
  }, [store?.id, isOwner]);

  async function changeEmailRoute(action: "set" | "activate" | "disable") {
    if (!store || !isOwner) return;
    setEmailRouteBusy(true);
    try {
      const route = action === "set"
        ? await api.setEmailForwarding(store.id, forwardDestination.trim())
        : action === "activate"
          ? await api.activateEmailForwarding(store.id)
          : await api.disableEmailForwarding(store.id);
      setEmailRoute(route);
      setForwardDestination(route.pending_destination || route.active_destination);
      toast.push("success", action === "set" && route.pending_destination
        ? t(locale, "settings.emailForwardVerifyToast")
        : t(locale, "settings.emailForwardSavedToast"));
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "settings.emailForwardFailed"));
    } finally {
      setEmailRouteBusy(false);
    }
  }

  async function persistSave() {
    if (!store || !form) return;
    if (form.invoice_tax_rate !== null && (form.invoice_tax_rate < 0 || form.invoice_tax_rate > 100)) {
      setInvoiceError(invoiceCopy.taxRateInvalid);
      return;
    }
    setSaving(true);
    setInvoiceError("");
    try {
      const payload: Partial<StoreConfig> = {
        ...form,
        social_links: Object.fromEntries(
          Object.entries(form.social_links ?? {}).filter(([, url]) => url.trim()).map(([channel, url]) => [channel, url.trim()]),
        ),
      };
      if (!isOwner) {
        delete payload.payment_keys;
        delete payload.payment_provider;
        delete payload.payment_gateway;
      }
      if (form.payment_gateway.available_providers.every((provider) => provider.selectable === false)) {
        delete payload.payment_keys;
        delete payload.payment_provider;
        delete payload.payment_gateway;
      }
      delete payload.invoice_tax_regime;
      delete payload.invoice_shipping_tax_rate;
      await api.patchConfig(store.id, payload);
      toast.push("success", t(locale, "settings.saved"));
      reload();
      return true;
    } catch (err) {
      if (section === "invoicing" && err instanceof ApiError) {
        const messages = Object.entries(err.payload ?? {}).flatMap(([field, value]) => Array.isArray(value) ? value.map((message) => field === "invoice_tax_rate" ? `${invoiceCopy.taxRate}: ${String(message)}` : String(message)) : []);
        setInvoiceError(messages.join(" · ") || err.detail);
      }
      toast.push("error", friendlyError(err, locale, "settings.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (!form) return;
    if (section === "invoicing") {
      if (form.invoice_tax_rate !== null && (form.invoice_tax_rate < 0 || form.invoice_tax_rate > 100)) {
        setInvoiceError(invoiceCopy.taxRateInvalid);
        return;
      }
      setInvoiceError("");
      setInvoiceReviewOpen(true);
      return;
    }
    void persistSave();
  }

  const closeDelete = useCallback((force = false) => {
    if (deletingRef.current && !force) return;
    setDeleteOpen(false);
    setDeleteStoreName("");
    setDeleteConfirmation("");
    setDeleteError("");
  }, []);

  async function deleteStore() {
    if (!store || !isOwner || deleteStoreName !== expectedStoreName || deleteConfirmation !== expectedConfirmation) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteStore(store.id, deleteStoreName, deleteConfirmation);
      if (localStorage.getItem("dash.storeId") === String(store.id)) {
        localStorage.removeItem("dash.storeId");
      }
      toast.push("success", t(locale, "settings.deleteSuccess"));
      closeDelete(true);
      reloadStores();
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(friendlyError(err, locale, "settings.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const set = <K extends keyof StoreConfig>(key: K, value: StoreConfig[K]) => {
    if (key === "invoice_tax_rate") setInvoiceError("");
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  if (loading || !form) {
    return <div className="card"><PageLoader /></div>;
  }

  const invoiceFields = [
    [invoiceCopy.legalName, form.invoice_legal_name],
    [invoiceCopy.email, form.invoice_contact_email],
    [invoiceCopy.country, form.invoice_country],
    [invoiceCopy.address, form.invoice_billing_address],
    [invoiceCopy.issuer, form.invoice_issuer_scope],
    [invoiceCopy.series, form.invoice_series_prefix],
    [invoiceCopy.taxRate, form.invoice_tax_rate],
    ...["ice", "if", "tp", "rc"].map((key) => [key.toUpperCase(), form.invoice_identifiers?.[key]]),
  ] as Array<[string, string | number | null | undefined]>;
  const completedInvoiceFields = invoiceFields.filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "").map(([label]) => label);
  const missingInvoiceFields = invoiceFields.filter(([, value]) => value === null || value === undefined || String(value).trim() === "").map(([label]) => label);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "settings.title")}</h1>
          <p className="d-subtitle">{t(locale, "settings.subtitle", store?.name)}.</p>
        </div>
        {section !== "team" && section !== "danger" && (
          <div className="page-head-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <span className="spin" /> : <FiSave />} {t(locale, "settings.saveChanges")}
            </button>
          </div>
        )}
      </div>

      <div className="settings-grid">
        <div className="settings-nav">
          <div className="settings-nav-group">
          <div className="settings-nav-label">{settingsGroups.profile}</div>
          <a className={`settings-link${section === "general" ? " active" : ""}`} href="#general" onClick={(e) => { e.preventDefault(); setSection("general"); }}>
            <FiSettings style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {t(locale, "settings.general")}
          </a>
          <a className={`settings-link${section === "contacts" ? " active" : ""}`} href="#contacts" onClick={(e) => { e.preventDefault(); setSection("contacts"); }}>
            <FiMessageCircle style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {t(locale, "settings.contactsSocial")}
          </a>
          </div>
          <div className="settings-nav-group">
          <div className="settings-nav-label">{settingsGroups.commerce}</div>
          <a className={`settings-link${section === "catalog" ? " active" : ""}`} href="#catalog" onClick={(e) => { e.preventDefault(); setSection("catalog"); }}>
            <FiShoppingBag style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {t(locale, "settings.catalogCommerce")}
          </a>
          {isOwner && <a className={`settings-link${section === "payment" ? " active" : ""}`} href="#payment" onClick={(e) => { e.preventDefault(); setSection("payment"); }}>
            <FiDollarSign style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {paymentCopy.title}
          </a>}
          {form.invoice_issuance_available && <a className={`settings-link${section === "invoicing" ? " active" : ""}`} href="#invoicing" onClick={(e) => { e.preventDefault(); setSection("invoicing"); }}>
            <FiFileText style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {invoiceCopy.title}
          </a>}
          <a className={`settings-link${section === "storefront" ? " active" : ""}`} href="#storefront" onClick={(e) => { e.preventDefault(); setSection("storefront"); }}>
            <FiLayout style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {t(locale, "settings.storefront")}
          </a>
          </div>
          <div className="settings-nav-group">
          <div className="settings-nav-label">{settingsGroups.access}</div>
          <a className={`settings-link${section === "team" ? " active" : ""}`} href="#team" onClick={(e) => { e.preventDefault(); setSection("team"); }}>
            <FiUsers style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {t(locale, "settings.team")}
          </a>
          </div>
          {isOwner && (
            <div className="settings-nav-group settings-nav-group-danger">
            <div className="settings-nav-label">{settingsGroups.advanced}</div>
            <a className={`settings-link${section === "danger" ? " active" : ""}`} href="#danger" onClick={(e) => { e.preventDefault(); setSection("danger"); }} style={{ color: "var(--danger)" }}>
              <FiTrash2 style={{ marginInlineEnd: 8, verticalAlign: -2 }} /> {t(locale, "settings.dangerZone")}
            </a>
            </div>
          )}
        </div>

        <div className="card">
          {section === "general" && (
            <>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{t(locale, "settings.storeIdentity")}</div>
                <div className="form-2col">
                  <div className="field">
                    <label className="field-label">{t(locale, "settings.storeName")}</label>
                    <input className="input" value={store?.name ?? ""} disabled />
                    <div className="field-hint">{t(locale, "settings.managedBy")}</div>
                  </div>
                  <div className="field">
                    <label className="field-label">{t(locale, "settings.slug")}</label>
                    <input className="input" value={store?.slug ?? ""} disabled />
                    <div className="field-hint">{t(locale, "settings.slugHint")}</div>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 16 }}>
                  <label className="field-label">{t(locale, "settings.storeLogo")}</label>
                  <div className="store-logo-row" aria-busy={logoBusy}>
                    <label className={`store-logo-control${logoBusy ? " is-busy" : ""}`}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={logoBusy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file || !store) return;
                          setLogoBusy(true);
                          setLogoProgress(0);
                          try {
                            await api.uploadLogo(store.id, file, setLogoProgress);
                            reloadStores();
                            toast.push("success", t(locale, "settings.logoUploaded"));
                          } catch (err) {
                            toast.push("error", friendlyError(err, locale, "settings.logoFailed"));
                          } finally {
                            setLogoBusy(false);
                            setLogoProgress(0);
                          }
                        }}
                      />
                      {store?.logo_url
                        ? <OptimizedImage src={store.logo_url} widthHint={320} widths={[160, 240, 320]} sizes="160px" alt={t(locale, "settings.storeLogo")} />
                        : <FiUpload size={20} />}
                      {logoBusy && <span className="store-logo-progress"><span className="spin" /><b>{logoProgress}%</b></span>}
                    </label>
                    {store?.logo_url && (
                        <button
                          type="button"
                          className="danger-icon-button store-logo-remove"
                          title={t(locale, "settings.removeLogo")}
                          aria-label={t(locale, "settings.removeLogo")}
                          disabled={logoBusy}
                          onClick={async () => {
                            if (!store) return;
                            setLogoBusy(true);
                            try {
                              await api.deleteLogo(store.id);
                              reloadStores();
                              toast.push("success", t(locale, "settings.logoRemoved"));
                            } catch (err) {
                              toast.push("error", friendlyError(err, locale, "settings.logoFailed"));
                            } finally {
                              setLogoBusy(false);
                            }
                          }}
                        >
                          {logoBusy ? <span className="spin" /> : <FiTrash2 size={15} />}
                        </button>
                    )}
                    <div className="field-hint">{t(locale, "settings.storeLogoHint")}</div>
                  </div>
                </div>
                {store?.retail_type_detail && (
                  <div className="field" style={{ marginTop: 16 }}>
                    <label className="field-label">{t(locale, "settings.retailType")}</label>
                    <div>{store.retail_type_detail.label}</div>
                    <button className="btn btn-ghost" onClick={() => setSection("catalog")}>{t(locale, "catalogSettings.edit")}</button>
                    <div className="field-hint">{store.retail_type_detail.description || t(locale, "settings.retailTypeHint")}</div>
                  </div>
                )}
              </div>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{t(locale, "settings.localization")}</div>
                <div className="form-2col">
                  <div className="field">
                    <label className="field-label">{t(locale, "settings.currency")}</label>
                    <div className="select-wrap">
                      <select className="select" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                        {["MAD", "EUR", "USD", "GBP"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">{t(locale, "settings.shippingFee")}</label>
                    <input className="input" type="number" min="0" step="0.5" value={form.shipping_fee} onChange={(e) => set("shipping_fee", Number(e.target.value) || 0)} />
                  </div>
                  <div className="field">
                    <label className="field-label">{locale === "fr" ? "Langue par défaut" : locale === "ar" ? "اللغة الافتراضية" : "Default language"}</label>
                    <select className="select" value={form.default_locale} onChange={(e) => set("default_locale", e.target.value as StoreConfig["default_locale"])}><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option></select>
                  </div>
                </div>
              </div>
            </>
          )}

          {section === "contacts" && (
            <>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 6 }}>{t(locale, "settings.contactsSocial")}</div>
                <p className="d-subtitle" style={{ marginBottom: 20 }}>{t(locale, "settings.contactsSocialHint")}</p>
                <div className="form-2col">
                  <div className="field">
                    <label className="field-label" htmlFor="settings-contact-email">{t(locale, "settings.contactEmail")}</label>
                    <input id="settings-contact-email" className="input" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder={t(locale, "settings.contactEmailPh")} />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="settings-support-phone">{t(locale, "settings.supportPhone")}</label>
                    <PhoneInput id="settings-support-phone" className="phone-input-control settings-phone-input" defaultCountry="MA" international countryCallingCodeEditable={false} labels={phoneLabels} value={form.support_phone || undefined} onChange={(value) => set("support_phone", value ?? "")} />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="settings-whatsapp">{t(locale, "settings.whatsapp")}</label>
                    <PhoneInput id="settings-whatsapp" className="phone-input-control settings-phone-input" defaultCountry="MA" international countryCallingCodeEditable={false} labels={phoneLabels} value={form.whatsapp_phone || undefined} onChange={(value) => set("whatsapp_phone", value ?? "")} />
                  </div>
                </div>
              </div>
              <details className="form-section settings-disclosure">
                <summary><span><strong>{t(locale, "settings.socialMedia")}</strong><small>{t(locale, "settings.socialMediaHint")}</small></span></summary>
                <div className="settings-disclosure-body"><div className="form-2col">
                  {SOCIAL_CHANNELS.map((channel) => (
                    <div className="field" key={channel}>
                      <label className="field-label" htmlFor={`settings-social-${channel}`}>{channel === "x" ? "X" : channel === "tiktok" ? "TikTok" : channel === "youtube" ? "YouTube" : channel.charAt(0).toUpperCase() + channel.slice(1)}</label>
                      <input
                        id={`settings-social-${channel}`}
                        className="input"
                        type="url"
                        dir="ltr"
                        value={form.social_links?.[channel] ?? ""}
                        onChange={(e) => set("social_links", { ...form.social_links, [channel]: e.target.value })}
                        placeholder={`https://${channel === "x" ? "x" : channel}.com/your-store`}
                      />
                    </div>
                  ))}
                </div></div>
              </details>
              {isOwner && <details className="form-section settings-disclosure" open={Boolean(emailRoute?.pending_destination)}>
                <summary><span><strong>{t(locale, "settings.emailForwardTitle")}</strong><small>{t(locale, "settings.emailForwardHint")}</small></span></summary>
                <div className="settings-disclosure-body">
                {emailRoute ? <>
                  <div className="field"><label className="field-label">{t(locale, "settings.emailForwardAlias")}</label><div dir="ltr">{emailRoute.alias}</div></div>
                  {!emailRoute.configured && <div className="field-hint">{t(locale, "settings.emailForwardSetup")}</div>}
                  {emailRoute.active_destination && <div className="field-hint">{t(locale, "settings.emailForwardActive", emailRoute.active_destination)}</div>}
                  {emailRoute.pending_destination && <div className="field-hint">
                    {emailRoute.pending_verified ? t(locale, "settings.emailForwardReady") : t(locale, "settings.emailForwardPending")}
                  </div>}
                  <div className="field" style={{ marginTop: 14 }}>
                    <label className="field-label" htmlFor="settings-forward-email">{t(locale, "settings.emailForwardTo")}</label>
                    <input id="settings-forward-email" className="input" type="email" value={forwardDestination} onChange={(e) => setForwardDestination(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button className="btn btn-primary" type="button" disabled={!emailRoute.configured || emailRouteBusy || !forwardDestination.trim()} onClick={() => changeEmailRoute("set")}>{t(locale, "settings.emailForwardVerify")}</button>
                    {emailRoute.pending_destination && <button className="btn btn-ghost" type="button" disabled={emailRouteBusy || !emailRoute.pending_verified} onClick={() => changeEmailRoute("activate")}>{t(locale, "settings.emailForwardActivate")}</button>}
                    {emailRoute.active_destination && <button className="btn btn-ghost" type="button" disabled={emailRouteBusy} onClick={() => changeEmailRoute("disable")}>{t(locale, "settings.emailForwardDisable")}</button>}
                    {emailRoute.active_destination && form.contact_email !== emailRoute.alias && <button className="btn btn-ghost" type="button" onClick={() => set("contact_email", emailRoute.alias)}>{t(locale, "settings.emailForwardPublic")}</button>}
                  </div>
                  <div className="field-hint" style={{ marginTop: 12 }}>{t(locale, "settings.emailForwardSending")}</div>
                </> : <div className="field-hint">{t(locale, "settings.emailForwardUnavailable")}</div>}
                </div>
              </details>}
              <details className="form-section settings-disclosure">
                <summary><span><strong>{t(locale, "settings.emailSender")}</strong><small>{t(locale, "settings.fromEmailHint")}</small></span></summary>
                <div className="settings-disclosure-body">
                <div className="field">
                  <label className="field-label" htmlFor="settings-from-email">{t(locale, "settings.fromEmail")}</label>
                  <input id="settings-from-email" className="input" type="email" value={form.from_email} onChange={(e) => set("from_email", e.target.value)} placeholder={t(locale, "settings.fromEmailPh")} />
                  <div className="field-hint">{t(locale, "settings.fromEmailHint")}</div>
                </div>
                </div>
              </details>
            </>
          )}

          {section === "catalog" && (
            <>
              {store && <CatalogSettings storeId={store.id} onSaved={(configuration, preset) => updateStore({ ...store, retail_type: configuration.retail_type, retail_type_detail: preset, catalog_config: configuration.catalog_config })} />}
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{t(locale, "settings.commerce")}</div>
                <label className="toggle" style={{ marginBottom: 14 }}>
                  <input type="checkbox" checked={form.loyalty_enabled} onChange={(e) => set("loyalty_enabled", e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-label">{t(locale, "settings.loyaltyToggle")}</span>
                </label>
              </div>
            </>
          )}

          {section === "invoicing" && (
            <div className="invoice-settings">
              <header className="payment-settings-head"><span><FiFileText /></span><div><h2>{invoiceCopy.title}</h2><p>{invoiceCopy.intro}</p></div></header>
              <p className="field-hint" aria-live="polite">{invoiceCopy.completed}: {completedInvoiceFields.length}/{invoiceFields.length} · {invoiceCopy.missing}: {missingInvoiceFields.length}</p>
              {invoiceError && <p className="field-error" role="alert">{invoiceError}</p>}
              <div className="form-section">
                <label className="toggle"><input type="checkbox" checked={form.invoice_enabled} onChange={(e) => set("invoice_enabled", e.target.checked)} /><span className="toggle-track" /><span className="toggle-label">{invoiceCopy.active}</span></label>
                <p className="field-hint">{invoiceCopy.activeHint}</p>
              </div>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{invoiceCopy.identity}</div>
                <div className="form-2col">
                  <div className="field"><label className="field-label">{invoiceCopy.legalName}</label><input className="input" maxLength={200} value={form.invoice_legal_name} onChange={(e) => set("invoice_legal_name", e.target.value)} /></div>
                  <div className="field"><label className="field-label">{invoiceCopy.email}</label><input className="input" type="email" value={form.invoice_contact_email} onChange={(e) => set("invoice_contact_email", e.target.value)} /></div>
                  <div className="field"><label className="field-label">{invoiceCopy.country}</label><input className="input" maxLength={100} value={form.invoice_country} onChange={(e) => set("invoice_country", e.target.value)} /></div>
                  <div className="field"><label className="field-label">{invoiceCopy.series}</label><input className="input" maxLength={20} value={form.invoice_series_prefix} onChange={(e) => set("invoice_series_prefix", e.target.value.toUpperCase())} /></div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}><label className="field-label">{invoiceCopy.address}</label><textarea className="textarea" maxLength={1000} value={form.invoice_billing_address} onChange={(e) => set("invoice_billing_address", e.target.value)} /></div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}><label className="field-label">{invoiceCopy.issuer}</label><input className="input" maxLength={64} value={form.invoice_issuer_scope} onChange={(e) => set("invoice_issuer_scope", e.target.value)} /><p className="field-hint">{invoiceCopy.issuerHint}</p></div>
                </div>
                <div className="d-card-title" style={{ margin: "20px 0 12px" }}>{invoiceCopy.identifiers}</div>
                <div className="form-2col">{["ice", "if", "tp", "rc"].map((key) => <div className="field" key={key}><label className="field-label">{key.toUpperCase()}</label><input className="input" maxLength={80} value={form.invoice_identifiers?.[key] ?? ""} onChange={(e) => set("invoice_identifiers", { ...form.invoice_identifiers, [key]: e.target.value })} /></div>)}</div>
              </div>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{invoiceCopy.taxes}</div>
                <div className="form-2col">
                  <div className="field"><label className="field-label">{invoiceCopy.taxRate}</label><input className="input" type="number" min="0" max="100" step="0.01" value={form.invoice_tax_rate ?? ""} onChange={(e) => set("invoice_tax_rate", e.target.value === "" ? null : Number(e.target.value))} aria-invalid={Boolean(invoiceError && form.invoice_tax_rate === null)} /><p className="field-hint">{invoiceCopy.taxRateHint}</p></div>
                  <label className="toggle"><input type="checkbox" checked={form.invoice_prices_include_tax} onChange={(e) => set("invoice_prices_include_tax", e.target.checked)} /><span className="toggle-track" /><span className="toggle-label">{invoiceCopy.inclusive}</span></label>
                  <div className="field" style={{ gridColumn: "1 / -1" }}><label className="field-label">{invoiceCopy.wording}</label><input className="input" maxLength={255} value={form.invoice_tax_wording} onChange={(e) => set("invoice_tax_wording", e.target.value)} /></div>
                </div>
              </div>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{invoiceCopy.shipping}</div>
                <div className="form-2col"><div className="field"><label className="field-label">{t(locale, "settings.shippingFee")}</label><input className="input" type="number" min="0" step="0.01" value={form.shipping_fee} onChange={(e) => set("shipping_fee", Number(e.target.value) || 0)} /></div><div className="field"><label className="field-label">{invoiceCopy.threshold}</label><input className="input" type="number" min="0" step="0.01" disabled={!form.free_shipping_enabled} value={form.free_shipping_threshold ?? ""} onChange={(e) => set("free_shipping_threshold", e.target.value === "" ? null : Number(e.target.value))} /></div></div>
                <label className="toggle"><input type="checkbox" checked={form.free_shipping_enabled} onChange={(e) => { set("free_shipping_enabled", e.target.checked); if (e.target.checked) set("free_shipping_currency", form.currency); }} /><span className="toggle-track" /><span className="toggle-label">{invoiceCopy.threshold}</span></label><p className="field-hint">{invoiceCopy.thresholdHint} ({form.currency})</p>
              </div>
              <div className="form-section"><div className="d-card-head"><div className="d-card-title">{invoiceCopy.preview}</div><button type="button" className="btn btn-secondary" disabled={previewBusy} onClick={refreshInvoicePreview}>{previewBusy ? <span className="spin" /> : <FiFileText />} {invoiceCopy.previewAction}</button></div>{invoicePreview ? <iframe title={invoiceCopy.preview} src={invoicePreview} style={{ width: "100%", minHeight: 680, border: "1px solid var(--border)", borderRadius: 12 }} /> : <p className="field-hint">{invoiceCopy.previewAction}</p>}</div>
            </div>
          )}

          {section === "payment" && isOwner && (
            <div className="payment-settings">
              <header className="payment-settings-head"><span><FiDollarSign /></span><div><h2>{paymentCopy.title}</h2><p>{paymentCopy.intro}</p></div></header>
              <section className="payment-methods-card">
                <div className="payment-methods-title"><strong>{paymentCopy.methods}</strong><span>{paymentCopy.onlineHelp}</span></div>
                <div className="payment-method-row is-cod">
                  <span className="payment-method-icon">$</span>
                  <div><strong>{paymentCopy.cod}</strong><small>{paymentCopy.codHelp}</small></div>
                  <span className="badge badge-brand">{paymentCopy.default}</span>
                  <label className="toggle"><input type="checkbox" checked={form.cod_enabled} disabled={form.cod_enabled && !form.payment_gateway.configured} onChange={(event) => set("cod_enabled", event.target.checked)} /><span className="toggle-track" /><span className="sr-only">{paymentCopy.cod}</span></label>
                </div>
                {form.payment_gateway.available_providers.map((provider) => {
                  const isFuture = provider.availability === "future" || provider.selectable === false;
                  const selected = provider.code === form.payment_provider;
                  const ready = selected && form.payment_gateway.configured;
                  return <details className={`payment-provider-row${selected ? " is-selected" : ""}${isFuture ? " is-future" : ""}`} open={selected && !isFuture} key={provider.code}>
                    <summary onClick={(event) => { if (isFuture) event.preventDefault(); }}><span className="payment-method-icon"><FiDollarSign /></span><span><strong>{provider.name}</strong><small>{isFuture ? paymentCopy.futureHelp : ready ? paymentCopy.configured : paymentCopy.needsSetup}</small></span>{isFuture ? <span className="badge badge-warning">{paymentCopy.future}</span> : selected && <span className={`badge ${ready ? "badge-success" : "badge-warning"}`}><FiCheck /> {paymentCopy.active}</span>}</summary>
                    <div className="payment-provider-body">
                      {!selected && !isFuture && <button type="button" className="btn btn-secondary" onClick={() => setForm((current) => current ? { ...current, payment_provider: provider.code, payment_keys: {} } : current)}>{paymentCopy.choose}</button>}
                      {selected && <><h3>{paymentCopy.credentials}</h3>{provider.credential_fields.map((field) => <div className="field" key={field.key}>{field.type === "boolean" ? <label className="toggle"><input type="checkbox" checked={Boolean(form.payment_keys[field.key])} onChange={(event) => set("payment_keys", { ...form.payment_keys, [field.key]: event.target.checked })} /><span className="toggle-track" /><span className="toggle-label">{paymentFieldLabel(locale, field.key, field.secret)}</span></label> : <><label className="field-label">{paymentFieldLabel(locale, field.key, field.secret)}</label><input className="input" type={field.secret ? "password" : "text"} required={field.required} autoComplete="off" value={String(form.payment_keys[field.key] ?? "")} onChange={(event) => set("payment_keys", { ...form.payment_keys, [field.key]: event.target.value })} /></>}</div>)}<p className="field-hint">{paymentCopy.safety}</p></>}
                    </div>
                  </details>;
                })}
              </section>
            </div>
          )}

          {section === "storefront" && (
            <>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{seoCopy.title}</div>
                <div className="form-2col">
                  <div className="field">
                    <label className="field-label">{seoCopy.seoTitle}</label>
                    <input className="input" maxLength={70} value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} placeholder={store?.name ?? ""} />
                    <div className="field-hint">{(form.seo_title ?? "").length}/70 {seoCopy.characters}</div>
                  </div>
                  <div className="field">
                    <label className="field-label">{seoCopy.socialImage}</label>
                    <input className="input" type="url" maxLength={500} value={form.seo_social_image ?? ""} onChange={(e) => set("seo_social_image", e.target.value)} placeholder="https://…" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">{seoCopy.description}</label>
                  <textarea className="textarea" maxLength={320} value={form.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value)} />
                  <div className="field-hint">{(form.seo_description ?? "").length}/320 {seoCopy.characters}</div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={Boolean(form.allow_search_indexing)} onChange={(e) => set("allow_search_indexing", e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-label">{seoCopy.allowIndexing}</span>
                </label>
                <p className="field-hint">{seoCopy.indexingHint}</p>
              </div>
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{t(locale, "settings.homeMerchandising")}</div>
                <div className="form-2col">
                  <div className="field">
                    <label className="field-label">{t(locale, "settings.homeProductSource")}</label>
                    <div className="select-wrap">
                      <select className="select" value={form.homepage_product_source} onChange={(e) => set("homepage_product_source", e.target.value as StoreConfig["homepage_product_source"])}>
                        <option value="featured">{t(locale, "settings.sourceFeatured")}</option>
                        <option value="newest">{t(locale, "settings.sourceNewest")}</option>
                        <option value="discounted">{t(locale, "settings.sourceDiscounted")}</option>
                        <option value="top_rated">{t(locale, "settings.sourceTopRated")}</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">{t(locale, "settings.homeProductLimit")}</label>
                    <div className="select-wrap">
                      <select className="select" value={form.homepage_product_limit} onChange={(e) => set("homepage_product_limit", Number(e.target.value))}>
                        {[4, 8, 12, 16, 20, 24].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {store && isOwner && <div className="form-section"><DomainSettings storeId={store.id} locale={locale} /></div>}
              <div className="form-section">
                <div className="d-card-title" style={{ marginBottom: 16 }}>{t(locale, "settings.storefront")}</div>
                <div style={{ fontSize: 13.5, color: "var(--ink-muted)" }}>
                  {t(locale, "settings.storefrontNote1")}{" "}
                  <a href="#/design" className="settings-link" style={{ padding: 0, display: "inline", color: "var(--brand)" }}>{t(locale, "nav.design")}</a>.{" "}
                  {t(locale, "settings.storefrontNote2")}{" "}
                  {store?.storefront_status === "live" && store.storefront_url
                    ? <a href={store.storefront_url} target="_blank" rel="noreferrer" className="mono" style={{ color: "var(--brand)" }}>{store.storefront_url}</a>
                    : <span className="mono">{store?.storefront_status === "failed" ? t(locale, "settings.storefrontFailed") : t(locale, "settings.storefrontPreparing")}</span>}
                </div>
              </div>
            </>
          )}

          {section === "team" && store && <TeamSection storeId={store.id} />}

          {section === "danger" && isOwner && store && (
            <div className="form-section">
              <div className="d-card-title" style={{ marginBottom: 10, color: "var(--danger)" }}>{t(locale, "settings.deleteStore")}</div>
              <p style={{ color: "var(--ink-muted)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 18 }}>
                {t(locale, "settings.deleteWarning")}
              </p>
              <button className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
                <FiTrash2 /> {t(locale, "settings.deleteStore")}
              </button>
            </div>
          )}

          {section !== "team" && section !== "danger" && (
            <div className="form-actions">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spin" /> : <FiSave />} {t(locale, "settings.saveChanges")}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={invoiceReviewOpen}
        title={invoiceCopy.reviewTitle}
        loading={saving}
        confirmLabel={invoiceCopy.confirmSave}
        onClose={() => setInvoiceReviewOpen(false)}
        onConfirm={async () => {
          if (await persistSave()) setInvoiceReviewOpen(false);
        }}
        body={(
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p>{invoiceCopy.reviewIntro}</p>
            <div><strong>{invoiceCopy.completed} ({completedInvoiceFields.length})</strong><p>{completedInvoiceFields.join(" · ") || "—"}</p></div>
            <div><strong>{invoiceCopy.missing} ({missingInvoiceFields.length})</strong><p>{missingInvoiceFields.join(" · ") || invoiceCopy.noMissing}</p></div>
          </div>
        )}
      />

      <ConfirmModal
        open={deleteOpen}
        title={t(locale, "settings.deleteTitle")}
        danger
        loading={deleting}
        confirmDisabled={deleteStoreName !== expectedStoreName || deleteConfirmation !== expectedConfirmation}
        confirmLabel={t(locale, "settings.deletePermanently")}
        onClose={closeDelete}
        onConfirm={deleteStore}
        body={(
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p>{t(locale, "settings.deleteConsequences")}</p>
            <div className="field">
              <label className="field-label" htmlFor="delete-store-name">{t(locale, "settings.typeStoreName", expectedStoreName)}</label>
              <input id="delete-store-name" data-modal-autofocus className="input mono" value={deleteStoreName} onChange={(e) => setDeleteStoreName(e.target.value)} autoComplete="off" spellCheck={false} disabled={deleting} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="delete-store-confirmation">{t(locale, "settings.typeConfirmation", expectedConfirmation)}</label>
              <input id="delete-store-confirmation" className="input mono" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} autoComplete="off" spellCheck={false} disabled={deleting} />
            </div>
            {deleteError && <div className="field-error" role="alert">{deleteError}</div>}
          </div>
        )}
      />
    </div>
  );
}

/* ── Team section (self-contained with its own state) ──────────────── */

function TeamSection({ storeId }: { storeId: number }) {
  const { updateMembers } = useStore();
  const toast = useToast();
  const locale = useLocale();
  const [members, setMembers] = useState<StoreMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addConfirm, setAddConfirm] = useState("");
  const [addRole, setAddRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [roleTarget, setRoleTarget] = useState<StoreMember | null>(null);
  const renderedRoleTarget = useLastPresent(roleTarget);
  const [roleNew, setRoleNew] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);

  const canSubmit =
    addEmail.trim() !== "" &&
    addRole !== "" &&
    (addPassword === "" || (
      addPassword.length >= 8 &&
      /[a-zA-Z]/.test(addPassword) &&
      /\d/.test(addPassword) &&
      addPassword === addConfirm
    ));

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listMembers(storeId);
      setMembers(data);
      updateMembers(storeId, data);
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "team.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [storeId, locale, toast, updateMembers]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = addEmail.trim().toLowerCase();
    if (!email || !addRole) return;
    setAdding(true);
    setError("");
    try {
      await api.addMember(storeId, {
        email,
        first_name: addFirstName.trim() || undefined,
        last_name: addLastName.trim() || undefined,
        password: addPassword || undefined,
        confirm_password: addPassword ? addConfirm : undefined,
        role: addRole,
      });
      setAddEmail("");
      setAddFirstName("");
      setAddLastName("");
      setAddPassword("");
      setAddConfirm("");
      setAddRole("");
      toast.push("success", t(locale, "team.added"));
      loadMembers();
    } catch (err) {
      setError(friendlyError(err, locale, "team.addFailed"));
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(memberId: number, newRole: string) {
    setRoleSaving(true);
    try {
      const updated = await api.updateMemberRole(storeId, memberId, newRole);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
      toast.push("success", t(locale, "team.roleUpdated"));
      loadMembers();
      setRoleTarget(null);
      setRoleNew("");
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "team.roleUpdateFailed"));
      loadMembers();
    } finally {
      setRoleSaving(false);
    }
  }

  async function handleRemove(memberId: number, email: string) {
    if (!confirm(t(locale, "team.confirmRemove", email))) return;
    try {
      await api.removeMember(storeId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.push("success", t(locale, "team.removed"));
      loadMembers();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "team.removeFailed"));
      loadMembers();
    }
  }

  return (
    <>
      <div className="form-section">
        <div className="d-card-title" style={{ marginBottom: 16 }}>{t(locale, "team.title")}</div>
        <p style={{ fontSize: 13.5, color: "var(--ink-muted)", margin: "0 0 16px" }}>
          {t(locale, "team.description")}
        </p>

        {loading ? (
          <PageLoader />
        ) : members.length === 0 ? (
          <div className="empty-team">{t(locale, "team.empty")}</div>
        ) : (
          <div className="team-list card" style={{ padding: 0, overflow: "hidden" }}>
            {members.map((m) => (
              <div className="team-member" key={m.id}>
                <div className="avatar">{initial(m.email)}</div>
                <div className="team-member-info">
                  <div className="team-member-name">
                    {m.first_name || m.last_name
                      ? `${m.first_name} ${m.last_name}`.trim()
                      : m.email}
                  </div>
                  <div className="team-member-email">
                    {m.role === "owner" ? (
                      <span className="owner-badge">{roleLabels(locale)[m.role] || m.role}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        {m.email} · {t(locale, "team.joined")} {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="team-member-role">
                  {m.role === "owner" ? (
                    <span className="owner-badge">{roleLabels(locale)[m.role]}</span>
                  ) : (
                    <span className="role-badge">{roleLabels(locale)[m.role]}</span>
                  )}
                </div>
                <div className="team-member-actions">
                  {m.role !== "owner" && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setRoleTarget(m); setRoleNew(m.role); }}
                      >
                        <FiShield size={14} /> {t(locale, "team.changeRole")}
                      </button>
                      <button
                        className="danger-icon-button"
                        title={t(locale, "team.remove")}
                        onClick={() => handleRemove(m.id, m.email)}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-section" style={{ borderTop: members.length > 0 ? "1px solid var(--hairline)" : undefined }}>
        <div className="d-card-title" style={{ marginBottom: 14 }}>{t(locale, "team.addMember")}</div>
        {error && (
          <div style={{ margin: "0 24px 10px", padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 24px" }}>
          <div className="form-2col">
            <div className="field">
              <label className="field-label">{t(locale, "team.firstName")}</label>
              <input
                className="input"
                placeholder={t(locale, "team.firstNamePh")}
                value={addFirstName}
                onChange={(e) => setAddFirstName(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="field">
              <label className="field-label">{t(locale, "team.lastName")}</label>
              <input
                className="input"
                placeholder={t(locale, "team.lastNamePh")}
                value={addLastName}
                onChange={(e) => setAddLastName(e.target.value)}
                disabled={adding}
              />
            </div>
          </div>
          <div className="form-2col">
            <div className="field">
              <label className="field-label">{t(locale, "team.email")} *</label>
              <input
                className="input"
                type="email"
                required
                placeholder={t(locale, "team.emailPh")}
                value={addEmail}
                onChange={(e) => { setAddEmail(e.target.value); setError(""); }}
                disabled={adding}
              />
            </div>
            <div className="field">
              <label className="field-label">{t(locale, "team.role")} *</label>
              <div className="select-wrap">
                <select className="select" value={addRole} onChange={(e) => setAddRole(e.target.value)} disabled={adding}>
                  <option value="">{t(locale, "team.selectRole")}</option>
                  {Object.entries(roleLabels(locale))
                    .filter(([k]) => k !== "owner")
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </div>
            </div>
          </div>
          <div className="form-2col">
            <div className="field">
              <label className="field-label">{t(locale, "team.password")}</label>
              <input
                className="input"
                type="password"
                placeholder={t(locale, "team.passwordPh")}
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                disabled={adding}
              />
              {addPassword && addPassword.length < 8 && (
                <div className="field-hint" style={{ color: "var(--danger)" }}>{t(locale, "team.passwordMin")}</div>
              )}
              {addPassword && addPassword.length >= 8 && !/[a-zA-Z]/.test(addPassword) && (
                <div className="field-hint" style={{ color: "var(--danger)" }}>{t(locale, "team.passwordLetter")}</div>
              )}
              {addPassword && addPassword.length >= 8 && /[a-zA-Z]/.test(addPassword) && !/\d/.test(addPassword) && (
                <div className="field-hint" style={{ color: "var(--danger)" }}>{t(locale, "team.passwordNumber")}</div>
              )}
            </div>
            <div className="field">
              <label className="field-label">{t(locale, "team.confirmPassword")}</label>
              <input
                className="input"
                type="password"
                placeholder={t(locale, "team.confirmPasswordPh")}
                value={addConfirm}
                onChange={(e) => setAddConfirm(e.target.value)}
                disabled={adding || !addPassword}
              />
              {addConfirm && addPassword !== addConfirm && (
                <div className="field-hint" style={{ color: "var(--danger)" }}>{t(locale, "team.passwordMismatch")}</div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="submit" disabled={adding || !canSubmit}>
              {adding ? <span className="spin" /> : <FiUserPlus />} {t(locale, "team.addButton")}
            </button>
          </div>
        </form>
        <div className="field-hint" style={{ padding: "8px 24px 0" }}>
          {t(locale, "team.addHint")}
        </div>
      </div>

      {/* ── Role change modal ──────────────────────────────────────── */}
      {renderedRoleTarget && (
        <ModalShell open={Boolean(roleTarget)} onClose={() => { setRoleTarget(null); setRoleNew(""); }} busy={roleSaving} labelledBy="role-change-title" maxWidth={400}>
            <div className="modal-head">
              <div id="role-change-title" className="d-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiShield style={{ color: "var(--brand)", fontSize: 18 }} />
                {t(locale, "team.changeRole")}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setRoleTarget(null); setRoleNew(""); }} style={{ padding: "6px 8px" }}>
                <FiX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: "var(--ink-secondary)", margin: "0 0 16px" }}>
                {t(locale, "team.roleChangeFor", renderedRoleTarget.first_name || renderedRoleTarget.email)}
              </p>
              <div className="role-options">
                {Object.entries(roleLabels(locale))
                  .filter(([k]) => k !== "owner")
                  .map(([value, label]) => (
                    <button
                      key={value}
                      className={`role-option${roleNew === value ? " selected" : ""}`}
                      onClick={() => setRoleNew(value)}
                    >
                      <span className="role-option-label">{label}</span>
                      {roleNew === value && <span className="role-option-check">✓</span>}
                    </button>
                  ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => { setRoleTarget(null); setRoleNew(""); }} disabled={roleSaving}>
                {t(locale, "confirm.cancel")}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { if (roleTarget && roleNew) handleRoleChange(roleTarget.id, roleNew); }}
                disabled={roleSaving || !roleNew || roleNew === renderedRoleTarget.role}
              >
                {roleSaving && <span className="spin" />}
                {t(locale, "confirm.yes")}
              </button>
            </div>
        </ModalShell>
      )}
    </>
  );
}
