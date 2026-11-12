import { useEffect, useState } from "react";
import { FiAlertCircle, FiCheck, FiDroplet, FiEdit3, FiExternalLink, FiEye, FiEyeOff, FiFileText, FiGrid, FiLayout, FiLock, FiMenu, FiNavigation, FiPlus, FiRefreshCw, FiSave, FiSearch, FiShoppingBag, FiSliders, FiType, FiUser, FiX } from "react-icons/fi";
import { Link } from "react-router-dom";
import { api, type DesignInfo, type StorefrontAppearance, type StorefrontDeployment } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { ModalShell, useLastPresent } from "../components/ModalShell";
import { useToast } from "../components/Toast";
import { t, useLocale } from "../i18n";
import { friendlyError } from "../utils/errors";
import { OptimizedImage } from "@storefront/core/media";
import { designPalette } from "../lib/designPalettes";

const SWATCHES = ["#2D6A4F", "#5E6AD2", "#B45309", "#1D4ED8", "#BE123C", "#047857", "#0F1B2D", "#7C3AED"];
const DEFAULT_APPEARANCE: StorefrontAppearance = {
  schema_version: 1,
  typography: { body_font: "system", heading_font: "system", base_size: "medium", heading_scale: "medium" },
  header: { layout: "logo_center", sticky: "always", width: "contained", logo_size: "standard", nav_alignment: "center", show_search: true, show_account: true, show_language: true, show_cart: true, show_categories: false, show_about: true, show_contact: true },
  style: { button_shape: "rounded", card_shape: "rounded", card_padding: "comfortable", card_alignment: "center", card_hover: "shadow", content_width: "standard" },
  colors: { theme_primary: "", theme_secondary: "", theme_muted: "", page: "", header: "", header_text: "", navigation: "", navigation_text: "", menu_dropdown: "", announcement: "", hero: "", section: "", card: "", discount_badge: "", discount_badge_text: "", newsletter: "", footer: "" },
  footer: { show_contact: true, show_social_links: true, copyright: { en: "", fr: "", ar: "" } },
};

export function DesignPage() {
  const { store, reload: reloadStores } = useStore();
  const toast = useToast();
  const locale = useLocale();
  const [addingPage, setAddingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageRoute, setNewPageRoute] = useState("");
  const [creatingPage, setCreatingPage] = useState(false);
  const [pendingDesign, setPendingDesign] = useState<DesignInfo | null>(null);
  const [deployment, setDeployment] = useState<StorefrontDeployment | null>(null);
  const [deploymentBusy, setDeploymentBusy] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState<StorefrontAppearance>(DEFAULT_APPEARANCE);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearancePanel, setAppearancePanel] = useState<"typography" | "header" | "surfaces" | "colors" | "footer">("header");
  const [designArea, setDesignArea] = useState<"pages" | "appearance">("appearance");
  const [previewDesign, setPreviewDesign] = useState<DesignInfo | null>(null);
  const renderedPreviewDesign = useLastPresent(previewDesign);

  const { data: config, loading: configLoading, reload } = useAsync(
    () => (store ? api.getConfig(store.id) : Promise.resolve(null)),
    [store?.id],
  );
  const { data: designs } = useAsync<DesignInfo[]>(
    () => (store ? api.listDesigns() : Promise.resolve([])),
    [store?.id],
  );
  const { data: pages, loading: pagesLoading, reload: reloadPages } = useAsync(
    () => (store ? api.listStorefrontPages(store.id) : Promise.resolve([])),
    [store?.id],
  );

  const currentDesign = config?.design ?? "basic";
  const premiumDesign = currentDesign !== "basic";
  const currentDesignPalette = designPalette(currentDesign);
  const currentColor = config?.brand_color ?? "#2D6A4F";
  const deploymentActive = Boolean(deployment && !["live", "failed"].includes(deployment.pipeline_state));
  const appearanceDirty = Boolean(config && JSON.stringify(appearanceDraft) !== JSON.stringify(config.appearance ?? DEFAULT_APPEARANCE));

  useEffect(() => {
    if (config) {
      const incoming = config.appearance ?? DEFAULT_APPEARANCE;
      setAppearanceDraft({
        ...DEFAULT_APPEARANCE,
        ...incoming,
        typography: { ...DEFAULT_APPEARANCE.typography, ...incoming.typography },
        header: { ...DEFAULT_APPEARANCE.header, ...incoming.header },
        style: { ...DEFAULT_APPEARANCE.style, ...incoming.style },
        colors: { ...DEFAULT_APPEARANCE.colors, ...incoming.colors },
        footer: { ...DEFAULT_APPEARANCE.footer, ...incoming.footer, copyright: { ...DEFAULT_APPEARANCE.footer.copyright, ...incoming.footer?.copyright } },
      });
    }
  }, [config]);

  useEffect(() => {
    if (!previewDesign) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewDesign(null);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(document.querySelectorAll<HTMLElement>(".design-preview-dialog button:not(:disabled)"));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [previewDesign]);

  useEffect(() => {
    setDeployment(null);
    setPendingDesign(null);
    if (!store?.storefront_request_id) return;
    let active = true;
    api.getStorefrontDeployment(store.storefront_request_id)
      .then((value) => {
        if (active && value.pipeline_state !== "live") setDeployment(value);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [store?.id, store?.storefront_request_id]);

  useEffect(() => {
    if (!deploymentActive || !deployment) return;
    let active = true;
    let inFlight = false;
    const poll = () => {
      if (inFlight) return;
      inFlight = true;
      api.getStorefrontDeployment(deployment.id)
        .then((value) => {
          if (!active) return;
          if (value.pipeline_state === "live") {
            window.clearInterval(timer);
            setDeployment(null);
            reload();
            reloadStores();
            toast.push("success", t(locale, "design.activated"));
            return;
          }
          setDeployment(value);
        })
        .catch(() => undefined)
        .finally(() => { inFlight = false; });
    };
    const timer = window.setInterval(poll, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [deployment, deploymentActive, locale, reload, reloadStores, toast]);

  const themePreview = (design: DesignInfo) => design.screenshots[0]
    || (["basic", "beauty", "fashion", "electronics", "nexa"].includes(design.key)
      ? `/theme-previews/${design.key}.webp`
      : "");

  function pickDesign(design: DesignInfo) {
    if (!store || design.status !== "ready" || design.key === currentDesign || deploymentActive) return;
    if (design.tier === "premium" && store.plan !== "premium") {
      toast.push("error", t(locale, "design.premiumRequired"));
      return;
    }
    setPendingDesign(design);
  }

  async function startDesignChange() {
    if (!store || !config || !pendingDesign || pendingDesign.status !== "ready" || deploymentBusy) return;
    setDeploymentBusy(true);
    try {
      const request = await api.createStorefrontDeployment({
        store: store.id,
        design: pendingDesign.key,
        config: {
          store_name: store.name,
          // A different design must not inherit the previous design's identity
          // color (for example Fashion gold in Electronics).
          brand_color: designPalette(pendingDesign.key).brand,
          currency: config.currency,
          ...(config.contact_email ? { contact_email: config.contact_email } : {}),
        },
      });
      const started = await api.startStorefront(request.id);
      setDeployment(started);
      setPendingDesign(null);
      reloadStores();
      toast.push("success", t(locale, "design.started"));
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "design.updateFailed"));
    } finally {
      setDeploymentBusy(false);
    }
  }

  async function retryDesignChange() {
    if (!deployment || deploymentBusy) return;
    setDeploymentBusy(true);
    try {
      const started = await api.startStorefront(deployment.id);
      setDeployment(started);
      toast.push("success", t(locale, "design.started"));
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "design.updateFailed"));
    } finally {
      setDeploymentBusy(false);
    }
  }

  async function pickColor(color: string) {
    if (!store) return;
    try {
      await api.patchConfig(store.id, { brand_color: color });
      toast.push("success", t(locale, "design.colorUpdated"));
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "design.colorUpdateFailed"));
    }
  }

  function updateAppearance<Group extends "typography" | "header" | "style" | "colors" | "footer">(
    group: Group,
    patch: Partial<StorefrontAppearance[Group]>,
  ) {
    setAppearanceDraft((current) => ({ ...current, [group]: { ...current[group], ...patch } }));
  }

  async function saveAppearance() {
    if (!store || !appearanceDirty || savingAppearance) return;
    setSavingAppearance(true);
    try {
      const saved = await api.patchConfig(store.id, { appearance: appearanceDraft });
      setAppearanceDraft(saved.appearance);
      reload();
      toast.push("success", appearanceCopy.saved);
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "design.updateFailed"));
    } finally {
      setSavingAppearance(false);
    }
  }

  async function setPlatformAttributionHidden(hidden: boolean) {
    if (!store || savingAppearance) return;
    setSavingAppearance(true);
    try {
      await api.patchConfig(store.id, { remove_platform_branding: hidden });
      await reload();
      toast.push("success", locale === "ar" ? "تم تحديث إسناد المنصة." : locale === "fr" ? "L’attribution de la plateforme a été mise à jour." : "Platform attribution updated.");
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "design.updateFailed"));
    } finally {
      setSavingAppearance(false);
    }
  }

  async function togglePage(pageKey: string, visible: boolean) {
    if (!store) return;
    try {
      await api.saveStorefrontPage(store.id, pageKey, { is_visible: visible });
      reloadPages();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "design.updateFailed"));
    }
  }

  async function createPage() {
    if (!store || !newPageTitle.trim() || !newPageRoute.trim()) return;
    setCreatingPage(true);
    try {
      const title = { en: "", fr: "", ar: "", [locale]: newPageTitle.trim() } as { en: string; fr: string; ar: string };
      await api.createStorefrontPage(store.id, {
        title,
        route: newPageRoute.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
        show_in_navigation: false,
      });
      setNewPageTitle("");
      setNewPageRoute("");
      setAddingPage(false);
      reloadPages();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "design.updateFailed"));
    } finally {
      setCreatingPage(false);
    }
  }

  const pageCopy = locale === "ar"
    ? { title: "صفحات المتجر", subtitle: "تحكم في الصفحات التي يزورها عملاؤك وعدّل محتواها.", page: "الصفحة", type: "النوع", visibility: "الظهور", actions: "الإجراءات", visible: "ظاهرة", hidden: "مخفية", system: "أساسية", content: "محتوى", policy: "سياسة", edit: "تعديل الصفحة", protected: "صفحة أساسية", add: "إضافة صفحة", name: "اسم الصفحة", route: "رابط الصفحة", cancel: "إلغاء", create: "إنشاء الصفحة" }
    : locale === "fr"
      ? { title: "Pages de la boutique", subtitle: "Gérez les pages visitées par vos clients et personnalisez leur contenu.", page: "Page", type: "Type", visibility: "Visibilité", actions: "Actions", visible: "Visible", hidden: "Masquée", system: "Essentielle", content: "Contenu", policy: "Politique", edit: "Modifier la page", protected: "Page essentielle", add: "Ajouter une page", name: "Nom de la page", route: "Adresse de la page", cancel: "Annuler", create: "Créer la page" }
      : { title: "Store pages", subtitle: "Manage the pages customers visit and customize their content.", page: "Page", type: "Type", visibility: "Visibility", actions: "Actions", visible: "Visible", hidden: "Hidden", system: "Essential", content: "Content", policy: "Policy", edit: "Edit page", protected: "Essential page", add: "Add page", name: "Page name", route: "Page address", cancel: "Cancel", create: "Create page" };
  const appearanceCopy = locale === "ar"
    ? { title: "المظهر العام", note: "تُطبّق هذه الإعدادات على جميع صفحات المتجر.", typography: "الخطوط والأحجام", typographyHelp: "اضبط خطوط النص والعناوين ومقياسها عبر المتجر.", bodyFont: "خط النص", headingFont: "خط العناوين", baseSize: "حجم النص", headingScale: "حجم العناوين", header: "رأس المتجر", headerHelp: "نظّم الشعار والتنقل وأدوات العملاء.", layout: "موضع الشعار", sticky: "تثبيت الرأس", showAccount: "إظهار حساب العميل", showLanguage: "إظهار اختيار اللغة", surfaces: "الشكل والمساحة", surfacesHelp: "حدّد أشكال العناصر وعرض محتوى المتجر.", buttonShape: "شكل الأزرار", cardShape: "شكل البطاقات", contentWidth: "عرض المحتوى", backgrounds: "الألوان والخلفيات", backgroundsHelp: "خصّص خلفية كل جزء رئيسي من واجهة المتجر.", pageBackground: "خلفية الصفحة", headerBackground: "خلفية الرأس", announcementBackground: "خلفية شريط الإعلان", heroBackground: "خلفية الواجهة", sectionBackground: "خلفية الأقسام", cardBackground: "خلفية البطاقات", newsletterBackground: "خلفية النشرة البريدية", footerBackground: "خلفية التذييل", themeDefault: "لون التصميم الافتراضي", resetColor: "إعادة الضبط", footer: "تذييل المتجر", footerHelp: "اختر معلومات التذييل والنص القانوني الظاهر للعملاء.", showContact: "إظهار معلومات الاتصال", showSocial: "إظهار الشبكات الاجتماعية", copyright: "نص حقوق النشر", chooseSection: "قسم الإعدادات", save: "حفظ المظهر", saved: "تم حفظ مظهر المتجر." }
    : locale === "fr"
      ? { title: "Apparence globale", note: "Ces réglages s’appliquent à toutes les pages de la boutique.", typography: "Polices et tailles", typographyHelp: "Réglez les polices et leur échelle dans toute la boutique.", bodyFont: "Police du texte", headingFont: "Police des titres", baseSize: "Taille du texte", headingScale: "Échelle des titres", header: "En-tête", headerHelp: "Organisez le logo, la navigation et les outils client.", layout: "Position du logo", sticky: "En-tête fixe", showAccount: "Afficher le compte client", showLanguage: "Afficher le choix de langue", surfaces: "Formes et largeur", surfacesHelp: "Définissez les formes des éléments et la largeur du contenu.", buttonShape: "Forme des boutons", cardShape: "Forme des cartes", contentWidth: "Largeur du contenu", backgrounds: "Couleurs et arrière-plans", backgroundsHelp: "Personnalisez chaque surface principale de votre vitrine.", pageBackground: "Page", headerBackground: "En-tête", announcementBackground: "Barre d’annonce", heroBackground: "Bannière principale", sectionBackground: "Sections", cardBackground: "Cartes", newsletterBackground: "Newsletter", footerBackground: "Pied de page", themeDefault: "Couleur du thème", resetColor: "Réinitialiser", footer: "Pied de page", footerHelp: "Choisissez les informations et le texte légal visibles par les clients.", showContact: "Afficher les contacts", showSocial: "Afficher les réseaux sociaux", copyright: "Texte de copyright", chooseSection: "Section des réglages", save: "Enregistrer l’apparence", saved: "Apparence de la boutique enregistrée." }
      : { title: "Global appearance", note: "These settings apply consistently across every storefront page.", typography: "Typography", typographyHelp: "Set storefront fonts, text size, and heading scale.", bodyFont: "Body font", headingFont: "Heading font", baseSize: "Text size", headingScale: "Heading scale", header: "Header", headerHelp: "Organize your logo, navigation, and customer tools.", layout: "Logo position", sticky: "Sticky header", showAccount: "Show customer account", showLanguage: "Show language selector", surfaces: "Shapes and width", surfacesHelp: "Set component shapes and the storefront content width.", buttonShape: "Button shape", cardShape: "Card shape", contentWidth: "Content width", backgrounds: "Colors & backgrounds", backgroundsHelp: "Customize every major storefront surface in one place.", pageBackground: "Page background", headerBackground: "Header background", announcementBackground: "Announcement background", heroBackground: "Hero background", sectionBackground: "Section background", cardBackground: "Card background", newsletterBackground: "Newsletter background", footerBackground: "Footer background", themeDefault: "Theme default", resetColor: "Reset", footer: "Footer", footerHelp: "Choose the information and legal copy customers see.", showContact: "Show contact details", showSocial: "Show social links", copyright: "Copyright text", chooseSection: "Settings section", save: "Save appearance", saved: "Storefront appearance saved." };
  const appearanceSections = [
    { key: "header", label: appearanceCopy.header, help: appearanceCopy.headerHelp, icon: FiNavigation },
    { key: "colors", label: appearanceCopy.backgrounds, help: appearanceCopy.backgroundsHelp, icon: FiDroplet },
    { key: "typography", label: appearanceCopy.typography, help: appearanceCopy.typographyHelp, icon: FiType },
    { key: "surfaces", label: appearanceCopy.surfaces, help: appearanceCopy.surfacesHelp, icon: FiGrid },
    { key: "footer", label: appearanceCopy.footer, help: appearanceCopy.footerHelp, icon: FiLayout },
  ] as const;
  const activeAppearanceSection = appearanceSections.find((section) => section.key === appearancePanel) ?? appearanceSections[0];
  const ActiveAppearanceIcon = activeAppearanceSection.icon;
  const areaCopy = locale === "ar"
    ? { pages: "الصفحات والمحتوى", pagesHelp: "أنشئ صفحات المتجر ونظّم ظهورها ومحتواها.", appearance: "التصميم والمظهر", appearanceHelp: "اختر القالب واضبط العلامة والألوان والتخطيط." }
    : locale === "fr"
      ? { pages: "Pages et contenu", pagesHelp: "Créez les pages et gérez leur visibilité et leur contenu.", appearance: "Thème et apparence", appearanceHelp: "Choisissez le thème, la marque, les couleurs et la mise en page." }
      : { pages: "Pages & content", pagesHelp: "Create storefront pages and manage their visibility and content.", appearance: "Theme & appearance", appearanceHelp: "Choose the theme and control branding, colors, and layout." };
  const headerCopy = locale === "ar"
    ? { preview: "معاينة مباشرة", structure: "التخطيط", width: "عرض الرأس", logoSize: "حجم الشعار", navAlignment: "محاذاة القائمة", features: "عناصر الرأس", navigationLinks: "روابط التنقل", showSearch: "إظهار البحث", showCart: "إظهار السلة", showCategories: "إظهار فئات المنتجات", showAbout: "إظهار من نحن", showContact: "إظهار اتصل بنا", premiumOnly: "خيارات تنقل للتصاميم المميزة", headerText: "لون نص الرأس", contained: "محتوى محدد", full: "بعرض كامل", start: "في البداية", center: "في الوسط" }
    : locale === "fr"
      ? { preview: "Aperçu en direct", structure: "Composition", width: "Largeur de l’en-tête", logoSize: "Taille du logo", navAlignment: "Alignement du menu", features: "Éléments de l’en-tête", navigationLinks: "Liens de navigation", showSearch: "Afficher la recherche", showCart: "Afficher le panier", showCategories: "Afficher les catégories de produits", showAbout: "Afficher À propos", showContact: "Afficher Contact", premiumOnly: "Options de navigation des thèmes Premium", headerText: "Texte de l’en-tête", contained: "Contenu encadré", full: "Pleine largeur", start: "Au début", center: "Centré" }
      : { preview: "Live preview", structure: "Composition", width: "Header width", logoSize: "Logo size", navAlignment: "Menu alignment", features: "Header features", navigationLinks: "Navigation links", showSearch: "Show search", showCart: "Show cart", showCategories: "Show product categories", showAbout: "Show About store", showContact: "Show Contact us", premiumOnly: "Premium theme navigation options", headerText: "Header text", contained: "Contained", full: "Full width", start: "At the start", center: "Centered" };
  const themeColorCopy = locale === "ar"
    ? { primary: "اللون الداكن للتصميم", secondary: "لون إبراز التصميم", muted: "لون الإبراز الفاتح" }
    : locale === "fr"
      ? { primary: "Couleur sombre du thème", secondary: "Couleur d’accent du thème", muted: "Accent clair du thème" }
      : { primary: "Theme dark color", secondary: "Theme accent color", muted: "Theme soft accent" };
  const optionLabel = (value: string) => ({
    system: locale === "ar" ? "تلقائي" : locale === "fr" ? "Système" : "System",
    modern: locale === "ar" ? "عصري" : locale === "fr" ? "Moderne" : "Modern",
    humanist: locale === "ar" ? "ودود" : locale === "fr" ? "Chaleureux" : "Humanist",
    editorial: locale === "ar" ? "تحريري" : locale === "fr" ? "Éditorial" : "Editorial",
    arabic: locale === "ar" ? "عربي" : locale === "fr" ? "Arabe" : "Arabic",
    small: locale === "ar" ? "صغير" : locale === "fr" ? "Petit" : "Small",
    medium: locale === "ar" ? "متوسط" : locale === "fr" ? "Moyen" : "Medium",
    large: locale === "ar" ? "كبير" : locale === "fr" ? "Grand" : "Large",
    compact: locale === "ar" ? "مضغوط" : locale === "fr" ? "Compact" : "Compact",
    logo_start: locale === "ar" ? "في البداية" : locale === "fr" ? "Au début" : "At the start",
    logo_center: locale === "ar" ? "في الوسط" : locale === "fr" ? "Centré" : "Centered",
    theme: appearanceCopy.themeDefault,
    none: locale === "ar" ? "غير مثبت" : locale === "fr" ? "Non fixe" : "Not sticky",
    always: locale === "ar" ? "مثبت دائماً" : locale === "fr" ? "Toujours fixe" : "Always sticky",
    square: locale === "ar" ? "مربع" : locale === "fr" ? "Carré" : "Square",
    rounded: locale === "ar" ? "مستدير" : locale === "fr" ? "Arrondi" : "Rounded",
    pill: locale === "ar" ? "كبسولة" : locale === "fr" ? "Capsule" : "Pill",
    soft: locale === "ar" ? "ناعم" : locale === "fr" ? "Doux" : "Soft",
    standard: locale === "ar" ? "قياسي" : locale === "fr" ? "Standard" : "Standard",
    wide: locale === "ar" ? "عريض" : locale === "fr" ? "Large" : "Wide",
    contained: headerCopy.contained,
    full: headerCopy.full,
    start: headerCopy.start,
    center: headerCopy.center,
  } as Record<string, string>)[value] ?? value;

  if (configLoading) {
    return <div className="card"><PageLoader /></div>;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "design.title")}</h1>
          <p className="d-subtitle">{t(locale, "design.subtitle")}</p>
        </div>
      </div>

      <nav className="design-area-nav" role="tablist" aria-label={t(locale, "design.title")}>
        <button type="button" role="tab" aria-selected={designArea === "pages"} className={designArea === "pages" ? "is-active" : ""} onClick={() => setDesignArea("pages")}><FiFileText /><span><strong>{areaCopy.pages}</strong><small>{areaCopy.pagesHelp}</small></span></button>
        <button type="button" role="tab" aria-selected={designArea === "appearance"} className={designArea === "appearance" ? "is-active" : ""} onClick={() => setDesignArea("appearance")}><FiSliders /><span><strong>{areaCopy.appearance}</strong><small>{areaCopy.appearanceHelp}</small></span></button>
      </nav>

      {deployment && (
        <section className={`card design-deployment ${deployment.pipeline_state === "failed" ? "is-failed" : "is-active"}`} role="status">
          <span className="design-deployment-icon">{deployment.pipeline_state === "failed" ? <FiAlertCircle /> : <span className="spin" aria-hidden="true" />}</span>
          <div>
            <strong>{deployment.pipeline_state === "failed" ? t(locale, "design.changeFailed") : t(locale, "design.preparing")}</strong>
            <p>{deployment.pipeline_state === "failed" ? t(locale, "design.currentPreserved") : t(locale, "design.currentRemainsLive")}</p>
            <div className="design-deployment-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={deployment.progress}><i style={{ width: `${deployment.progress}%` }} /></div>
          </div>
          <div className="design-deployment-actions">
            {deployment.pipeline_state === "failed" && <button type="button" className="btn btn-secondary" disabled={deploymentBusy} onClick={() => void retryDesignChange()}><FiRefreshCw /> {t(locale, "design.retry")}</button>}
            {store?.storefront_url && <a className="btn btn-secondary" href={store.storefront_url} target="_blank" rel="noreferrer"><FiExternalLink /> {t(locale, "design.openCurrent")}</a>}
          </div>
        </section>
      )}

      {designArea === "pages" && <section className="card storefront-pages-card design-area-panel" role="tabpanel">
        <div className="storefront-pages-heading">
          <div><h2>{pageCopy.title}</h2><p>{pageCopy.subtitle}</p></div>
          <button type="button" className="btn btn-secondary" onClick={() => setAddingPage((value) => !value)}><FiPlus /> {pageCopy.add}</button>
        </div>
        {addingPage && <div className="storefront-page-create"><label className="field"><span className="field-label">{pageCopy.name}</span><input className="input" autoFocus value={newPageTitle} onChange={(event) => setNewPageTitle(event.target.value)} /></label><label className="field"><span className="field-label">{pageCopy.route}</span><div className="page-route-input"><span>/</span><input className="input" value={newPageRoute} placeholder="size-guide" onChange={(event) => setNewPageRoute(event.target.value)} /></div></label><div><button type="button" className="btn btn-secondary" onClick={() => setAddingPage(false)}>{pageCopy.cancel}</button><button type="button" className="btn btn-primary" disabled={creatingPage || !newPageTitle.trim() || !newPageRoute.trim()} onClick={() => void createPage()}>{creatingPage && <span className="spin" aria-hidden="true" />} {pageCopy.create}</button></div></div>}
        {pagesLoading ? <PageLoader /> : (
          <div className="storefront-pages-table">
            <div className="storefront-page-row is-head"><span>{pageCopy.page}</span><span>{pageCopy.type}</span><span>{pageCopy.visibility}</span><span>{pageCopy.actions}</span></div>
            {(pages ?? []).map((page) => {
              const title = page.title[locale] || page.title.en || page.page_key;
              return (
                <div className="storefront-page-row" key={page.page_key}>
                  <span className="storefront-page-name"><b>{title}</b><small>/{page.route}</small></span>
                  <span><i className={`page-type-badge is-${page.page_type}`}>{pageCopy[page.page_type]}</i></span>
                  <span><i className={`page-visibility-badge ${page.is_visible ? "is-visible" : "is-hidden"}`}>{page.is_visible ? pageCopy.visible : pageCopy.hidden}</i></span>
                  <span className="storefront-page-actions">
                    <Link className="icon-btn" to={`/design/pages/${page.page_key}`} title={pageCopy.edit}><FiEdit3 /></Link>
                    <button type="button" className="icon-btn" disabled={page.is_protected} title={page.is_protected ? pageCopy.protected : page.is_visible ? pageCopy.hidden : pageCopy.visible} onClick={() => togglePage(page.page_key, !page.is_visible)}>{page.is_protected ? <FiLock /> : page.is_visible ? <FiEye /> : <FiEyeOff />}</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>}

      {designArea === "appearance" && <div className="grid design-workspace design-area-panel" role="tabpanel">
        <div>
          <div className="d-eyebrow" style={{ marginBottom: 10 }}>{t(locale, "design.template")}</div>
          <div className="design-grid">
            {(designs ?? []).map((d) => {
              const preview = themePreview(d);
              const unavailable = d.status !== "ready";
              const locked = d.tier === "premium" && store?.plan !== "premium";
              return <article key={d.key} className={`design-card${currentDesign === d.key ? " selected" : ""}${d.tier === "premium" ? " is-premium" : ""}${unavailable ? " is-unavailable" : ""}`}>
                <div className="design-preview">
                  {preview ? <img src={preview} alt="" loading="lazy" /> : <div className="design-preview-unavailable"><FiLayout /><span>{t(locale, "design.comingSoon")}</span></div>}
                  {currentDesign === d.key && (
                    <span className="design-current-mark" aria-label={t(locale, "design.active")}>
                      <FiCheck />
                    </span>
                  )}
                  {d.tier === "premium" && <span className="design-tier"><FiLock /> {locked ? t(locale, "design.premiumLocked") : t(locale, "design.premium")}</span>}
                </div>
                <div className="design-meta">
                  <div>
                    <b>{d.name}</b>
                    {unavailable && <span className="badge">{t(locale, "design.comingSoon")}</span>}
                    <p>{d.tagline}</p>
                  </div>
                  {currentDesign === d.key && <span className="badge badge-brand">{t(locale, "design.active")}</span>}
                </div>
                <div className="design-card-actions">
                  {preview && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewDesign(d)}><FiEye /> {locale === "ar" ? "معاينة" : locale === "fr" ? "Aperçu" : "Preview"}</button>}
                  <button type="button" className="btn btn-primary btn-sm" disabled={deploymentActive || unavailable || currentDesign === d.key} aria-label={`${d.name} — ${currentDesign === d.key ? t(locale, "design.active") : locale === "ar" ? "اختيار" : locale === "fr" ? "Choisir" : "Select"}`} aria-pressed={currentDesign === d.key} onClick={() => pickDesign(d)}>{currentDesign === d.key ? t(locale, "design.active") : locale === "ar" ? "اختيار" : locale === "fr" ? "Choisir" : "Select"}</button>
                </div>
              </article>;
            })}
            {(designs ?? []).length === 0 && <EmptyState icon={<FiLayout />} title={t(locale, "design.noTemplates")} />}
          </div>
        </div>

        <div className="design-controls">
        <div className="card design-control-card">
          <div className="d-card-head">
            <span className="d-card-title">{t(locale, "design.brandColor")}</span>
          </div>
          <div style={{ padding: 18 }}>
            <div className="color-swatches" style={{ marginBottom: 14 }}>
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`swatch${currentColor.toUpperCase() === c ? " selected" : ""}`}
                  style={{ background: c }}
                  title={c}
                  disabled={deploymentActive}
                  onClick={() => pickColor(c)}
                />
              ))}
            </div>
            <div className="field">
              <label className="field-label">{t(locale, "design.hex")}</label>
              <input
                className="input mono"
                value={currentColor}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) pickColor(v);
                }}
                placeholder="#2D6A4F"
                disabled={deploymentActive}
              />
            </div>
            <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-muted)" }}>
              {t(locale, "design.note")}
            </div>
          </div>
        </div>
        <div className="card design-control-card appearance-card">
          <div className="d-card-head"><div><span className="d-card-title">{appearanceCopy.title}</span><p>{appearanceCopy.note}</p></div></div>
          <div className="appearance-form">
            <label className="appearance-mobile-nav"><span>{appearanceCopy.chooseSection}</span><select className="input" value={appearancePanel} onChange={(event) => setAppearancePanel(event.target.value as typeof appearancePanel)}>{appearanceSections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}</select></label>
            <div className="appearance-workspace">
              <nav className="appearance-nav" role="tablist" aria-label={appearanceCopy.title}>
                {appearanceSections.map(({ key, label, help, icon: Icon }) => <button key={key} type="button" role="tab" aria-selected={appearancePanel === key} className={appearancePanel === key ? "is-active" : ""} onClick={() => setAppearancePanel(key)}><Icon /><span><strong>{label}</strong><small>{help}</small></span></button>)}
              </nav>
              <div className="appearance-panel" role="tabpanel">
                <header className="appearance-panel-head"><ActiveAppearanceIcon /><div><h3>{activeAppearanceSection.label}</h3><p>{activeAppearanceSection.help}</p></div></header>
            <fieldset hidden={appearancePanel !== "typography"}><legend>{appearanceCopy.typography}</legend>
              <label className="field"><span className="field-label">{appearanceCopy.bodyFont}</span><select className="input" value={appearanceDraft.typography.body_font} onChange={(event) => updateAppearance("typography", { body_font: event.target.value as StorefrontAppearance["typography"]["body_font"] })}>{["system", "modern", "humanist", "editorial", "arabic"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label>
              <label className="field"><span className="field-label">{appearanceCopy.headingFont}</span><select className="input" value={appearanceDraft.typography.heading_font} onChange={(event) => updateAppearance("typography", { heading_font: event.target.value as StorefrontAppearance["typography"]["heading_font"] })}>{["system", "modern", "humanist", "editorial", "arabic"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label>
              <div className="appearance-pair"><label className="field"><span className="field-label">{appearanceCopy.baseSize}</span><select className="input" value={appearanceDraft.typography.base_size} onChange={(event) => updateAppearance("typography", { base_size: event.target.value as StorefrontAppearance["typography"]["base_size"] })}>{["small", "medium", "large"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label><label className="field"><span className="field-label">{appearanceCopy.headingScale}</span><select className="input" value={appearanceDraft.typography.heading_scale} onChange={(event) => updateAppearance("typography", { heading_scale: event.target.value as StorefrontAppearance["typography"]["heading_scale"] })}>{["compact", "medium", "large"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label></div>
            </fieldset>
            <fieldset hidden={appearancePanel !== "header"} className="appearance-header-fieldset"><legend>{appearanceCopy.header}</legend>
              <div className="appearance-header-preview" data-layout={appearanceDraft.header.layout} data-width={appearanceDraft.header.width} data-logo-size={appearanceDraft.header.logo_size} style={{ background: appearanceDraft.colors.header || "#ffffff", color: appearanceDraft.colors.header_text || "#17211b" }}>
                <small>{headerCopy.preview}</small>
                <div className="appearance-header-preview-main">
                  <span className="appearance-header-preview-search">{appearanceDraft.header.show_search && <><FiSearch /> <i>{locale === "fr" ? "Rechercher" : locale === "ar" ? "بحث" : "Search"}</i></>}</span>
                  <strong>{store?.logo_url ? <OptimizedImage src={store.logo_url} widthHint={320} widths={[160, 240, 320]} sizes="160px" alt={store.name} /> : store?.name}</strong>
                  <span className="appearance-header-preview-actions">{appearanceDraft.header.show_language && <b>{locale.toUpperCase()}</b>}{appearanceDraft.header.show_account && <FiUser />}{appearanceDraft.header.show_cart && <FiShoppingBag />}</span>
                  <FiMenu className="appearance-header-preview-menu" />
                </div>
                <div className={`appearance-header-preview-nav is-${appearanceDraft.header.nav_alignment}`} style={{ background: appearanceDraft.colors.navigation || appearanceDraft.colors.header || "#ffffff", color: appearanceDraft.colors.navigation_text || appearanceDraft.colors.header_text || "#17211b" }}><span>Home</span><span>Products</span>{premiumDesign && appearanceDraft.header.show_categories && <span>Categories</span>}{appearanceDraft.header.show_about && <span>About</span>}{appearanceDraft.header.show_contact && <span>Contact</span>}</div>
              </div>
              <div className="appearance-group-label">{headerCopy.structure}</div>
              <div className="appearance-pair"><label className="field"><span className="field-label">{appearanceCopy.layout}</span><select className="input" value={appearanceDraft.header.layout} onChange={(event) => updateAppearance("header", { layout: event.target.value as StorefrontAppearance["header"]["layout"] })}>{["theme", "logo_start", "logo_center"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label><label className="field"><span className="field-label">{appearanceCopy.sticky}</span><select className="input" value={appearanceDraft.header.sticky} onChange={(event) => updateAppearance("header", { sticky: event.target.value as StorefrontAppearance["header"]["sticky"] })}>{["always", "none"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label></div>
              <div className="appearance-pair"><label className="field"><span className="field-label">{headerCopy.width}</span><select className="input" value={appearanceDraft.header.width} onChange={(event) => updateAppearance("header", { width: event.target.value as StorefrontAppearance["header"]["width"] })}>{["contained", "full"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label><label className="field"><span className="field-label">{headerCopy.logoSize}</span><select className="input" value={appearanceDraft.header.logo_size} onChange={(event) => updateAppearance("header", { logo_size: event.target.value as StorefrontAppearance["header"]["logo_size"] })}>{["compact", "standard", "large"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label></div>
              <label className="field"><span className="field-label">{headerCopy.navAlignment}</span><select className="input" value={appearanceDraft.header.nav_alignment} onChange={(event) => updateAppearance("header", { nav_alignment: event.target.value as StorefrontAppearance["header"]["nav_alignment"] })}>{["start", "center"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label>
              <div className="appearance-group-label">{headerCopy.features}</div>
              <div className="appearance-toggle-grid">
                <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.header.show_search} onChange={(event) => updateAppearance("header", { show_search: event.target.checked })} /><span>{headerCopy.showSearch}</span></label>
                <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.header.show_account} onChange={(event) => updateAppearance("header", { show_account: event.target.checked })} /><span>{appearanceCopy.showAccount}</span></label>
                <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.header.show_language} onChange={(event) => updateAppearance("header", { show_language: event.target.checked })} /><span>{appearanceCopy.showLanguage}</span></label>
                <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.header.show_cart} onChange={(event) => updateAppearance("header", { show_cart: event.target.checked })} /><span>{headerCopy.showCart}</span></label>
              </div>
              {premiumDesign && <>
                <div className="appearance-group-label">{headerCopy.navigationLinks} · {headerCopy.premiumOnly}</div>
                <div className="appearance-toggle-grid">
                  <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.header.show_categories} onChange={(event) => updateAppearance("header", { show_categories: event.target.checked })} /><span>{headerCopy.showCategories}</span></label>
                  <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.header.show_about} onChange={(event) => updateAppearance("header", { show_about: event.target.checked })} /><span>{headerCopy.showAbout}</span></label>
                  <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.header.show_contact} onChange={(event) => updateAppearance("header", { show_contact: event.target.checked })} /><span>{headerCopy.showContact}</span></label>
                </div>
              </>}
            </fieldset>
            <fieldset hidden={appearancePanel !== "surfaces"}><legend>{appearanceCopy.surfaces}</legend>
              <label className="field"><span className="field-label">{appearanceCopy.buttonShape}</span><select className="input" value={appearanceDraft.style.button_shape} onChange={(event) => updateAppearance("style", { button_shape: event.target.value as StorefrontAppearance["style"]["button_shape"] })}>{["square", "rounded", "pill"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label>
              <label className="field"><span className="field-label">{appearanceCopy.cardShape}</span><select className="input" value={appearanceDraft.style.card_shape} onChange={(event) => updateAppearance("style", { card_shape: event.target.value as StorefrontAppearance["style"]["card_shape"] })}>{["square", "rounded", "soft"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label>
              <div className="appearance-pair"><label className="field"><span className="field-label">{locale === "ar" ? "حشوة البطاقة" : locale === "fr" ? "Espacement des cartes" : "Card padding"}</span><select className="input" value={appearanceDraft.style.card_padding} onChange={(event) => updateAppearance("style", { card_padding: event.target.value as StorefrontAppearance["style"]["card_padding"] })}>{["none", "compact", "comfortable"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label><label className="field"><span className="field-label">{locale === "ar" ? "محاذاة المحتوى" : locale === "fr" ? "Alignement du contenu" : "Content alignment"}</span><select className="input" value={appearanceDraft.style.card_alignment} onChange={(event) => updateAppearance("style", { card_alignment: event.target.value as StorefrontAppearance["style"]["card_alignment"] })}>{["start", "center"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label></div>
              <label className="field"><span className="field-label">{locale === "ar" ? "تأثير التحويم" : locale === "fr" ? "Effet au survol" : "Card hover effect"}</span><select className="input" value={appearanceDraft.style.card_hover} onChange={(event) => updateAppearance("style", { card_hover: event.target.value as StorefrontAppearance["style"]["card_hover"] })}>{["none", "shadow", "lift"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label>
              <label className="field"><span className="field-label">{appearanceCopy.contentWidth}</span><select className="input" value={appearanceDraft.style.content_width} onChange={(event) => updateAppearance("style", { content_width: event.target.value as StorefrontAppearance["style"]["content_width"] })}>{["compact", "standard", "wide"].map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></label>
            </fieldset>
            <fieldset hidden={appearancePanel !== "colors"}><legend>{appearanceCopy.backgrounds}</legend>
              <div className="appearance-colors">
                {([
                  ...(premiumDesign ? [
                    ["theme_primary", themeColorCopy.primary, currentDesignPalette.primary],
                    ["theme_secondary", themeColorCopy.secondary, currentDesignPalette.secondary],
                    ["theme_muted", themeColorCopy.muted, currentDesignPalette.muted],
                  ] as const : []),
                  ["page", appearanceCopy.pageBackground, "#FFFFFF"],
                  ["header", appearanceCopy.headerBackground, "#FFFFFF"],
                  ["header_text", headerCopy.headerText, "#17211B"],
                  ["navigation", locale === "ar" ? "خلفية روابط التنقل" : locale === "fr" ? "Arrière-plan de navigation" : "Navigation background", "#FFFFFF"],
                  ["navigation_text", locale === "ar" ? "نص روابط التنقل" : locale === "fr" ? "Texte de navigation" : "Navigation text", "#17211B"],
                  ["menu_dropdown", locale === "ar" ? "خلفية قائمة المجموعات" : locale === "fr" ? "Arrière-plan du menu Collections" : "Collections menu background", "#FFFFFF"],
                  ["announcement", appearanceCopy.announcementBackground, "#1F2937"],
                  ["hero", appearanceCopy.heroBackground, "#E5E7EB"],
                  ["section", appearanceCopy.sectionBackground, "#F8FAFC"],
                  ["card", appearanceCopy.cardBackground, "#FFFFFF"],
                  ["discount_badge", locale === "ar" ? "خلفية شارة الخصم" : locale === "fr" ? "Fond du badge de réduction" : "Discount badge background", "#0F766E"],
                  ["discount_badge_text", locale === "ar" ? "نص شارة الخصم" : locale === "fr" ? "Texte du badge de réduction" : "Discount badge text", "#FFFFFF"],
                  ["newsletter", appearanceCopy.newsletterBackground, "#F1F5F9"],
                  ["footer", appearanceCopy.footerBackground, "#111827"],
                ] as const).map(([key, label, fallback]) => (
                  <div className="appearance-color" key={key}>
                    <label>
                      <input type="color" value={appearanceDraft.colors[key] || fallback} onChange={(event) => updateAppearance("colors", { [key]: event.target.value } as Partial<StorefrontAppearance["colors"]>)} />
                      <span><strong>{label}</strong><small>{appearanceDraft.colors[key] || appearanceCopy.themeDefault}</small></span>
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!appearanceDraft.colors[key]} onClick={() => updateAppearance("colors", { [key]: "" } as Partial<StorefrontAppearance["colors"]>)}>{appearanceCopy.resetColor}</button>
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset hidden={appearancePanel !== "footer"}><legend>{appearanceCopy.footer}</legend>
              <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.footer.show_contact} onChange={(event) => updateAppearance("footer", { show_contact: event.target.checked })} /><span>{appearanceCopy.showContact}</span></label>
              <label className="appearance-toggle"><input type="checkbox" checked={appearanceDraft.footer.show_social_links} onChange={(event) => updateAppearance("footer", { show_social_links: event.target.checked })} /><span>{appearanceCopy.showSocial}</span></label>
              <label className="appearance-toggle"><input type="checkbox" disabled={savingAppearance || !config?.can_remove_platform_branding} checked={Boolean(config?.remove_platform_branding)} onChange={(event) => void setPlatformAttributionHidden(event.target.checked)} /><span>{locale === "ar" ? "إخفاء عبارة «بدعم من TijaraGO»" : locale === "fr" ? "Masquer la mention « Propulsé par TijaraGO »" : "Hide “Powered by TijaraGO”"}{!config?.can_remove_platform_branding ? (locale === "ar" ? " — غير مشمول في خطتك" : locale === "fr" ? " — non inclus dans votre formule" : " — not included in your plan") : ""}</span></label>
              <label className="field"><span className="field-label">{appearanceCopy.copyright}</span><input className="input" maxLength={160} value={appearanceDraft.footer.copyright[locale]} onChange={(event) => updateAppearance("footer", { copyright: { ...appearanceDraft.footer.copyright, [locale]: event.target.value } })} /></label>
            </fieldset>
              </div>
            </div>
            <footer className="appearance-actions"><span>{appearanceDirty ? (locale === "ar" ? "تغييرات غير محفوظة" : locale === "fr" ? "Modifications non enregistrées" : "Unsaved changes") : (locale === "ar" ? "تم حفظ جميع التغييرات" : locale === "fr" ? "Toutes les modifications sont enregistrées" : "All changes saved")}</span><button type="button" className="btn btn-primary appearance-save" disabled={!appearanceDirty || savingAppearance || deploymentActive} onClick={() => void saveAppearance()}>{savingAppearance ? <span className="spin" aria-hidden="true" /> : <FiSave />} {appearanceCopy.save}</button></footer>
          </div>
        </div>
        </div>
      </div>}
      {renderedPreviewDesign && <ModalShell open={Boolean(previewDesign)} onClose={() => setPreviewDesign(null)} labelledBy="design-preview-title" overlayClassName="design-preview-modal" panelClassName="design-preview-dialog">
          <div className="design-preview-dialog-head"><div><strong id="design-preview-title">{renderedPreviewDesign.name}</strong><span>{renderedPreviewDesign.tagline}</span></div><button type="button" className="icon-btn modal-close" data-modal-autofocus title={locale === "ar" ? "إغلاق" : locale === "fr" ? "Fermer" : "Close"} aria-label={locale === "ar" ? "إغلاق" : locale === "fr" ? "Fermer" : "Close"} onClick={() => setPreviewDesign(null)}><FiX /></button></div>
          <div className="design-preview-dialog-canvas"><img src={themePreview(renderedPreviewDesign)} alt={`${renderedPreviewDesign.name} storefront`} /></div>
          <div className="design-preview-dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => setPreviewDesign(null)}>{locale === "ar" ? "إغلاق" : locale === "fr" ? "Fermer" : "Close"}</button>{renderedPreviewDesign.status === "ready" && renderedPreviewDesign.key !== currentDesign && <button type="button" className="btn btn-primary" onClick={() => { setPreviewDesign(null); pickDesign(renderedPreviewDesign); }}>{locale === "ar" ? "اختيار هذا التصميم" : locale === "fr" ? "Choisir ce thème" : "Select this theme"}</button>}</div>
      </ModalShell>}
      <ConfirmModal
        open={Boolean(pendingDesign)}
        title={t(locale, "design.confirmTitle")}
        body={<><strong>{pendingDesign?.name}</strong><p className="design-confirm-copy">{t(locale, "design.confirmBody")}</p></>}
        confirmLabel={t(locale, "design.confirmAction")}
        loading={deploymentBusy}
        onClose={() => { if (!deploymentBusy) setPendingDesign(null); }}
        onConfirm={() => void startDesignChange()}
      />
    </div>
  );
}
