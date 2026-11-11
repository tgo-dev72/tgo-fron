import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import {
  FiArrowDown,
  FiArrowUp,
  FiEye,
  FiEyeOff,
  FiHeart,
  FiMonitor,
  FiPlus,
  FiSave,
  FiSend,
  FiSmartphone,
  FiSearch,
  FiShoppingBag,
  FiTablet,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import {
  api,
  type CatalogSection,
  type Product,
  type StoreConfig as MerchantStoreConfig,
  type LocalizedStorefrontText,
  type StorefrontEditorLocale,
  type StorefrontPageDocument,
  type StorefrontPageSection,
  type StorefrontSectionType,
  type StorefrontSlide,
  type StorefrontAnnouncementItem,
} from "../api/client";
import { Slideshow } from "../../../../packages/storefront-core/src/storefront/Slideshow";
import { selectHomepageProducts, type HomepageProductSource } from "../../../../packages/storefront-core/src/storefront/catalog";
import { storefrontAppearanceStyle } from "../../../../packages/storefront-core/src/storefront/Storefront";
import { OptimizedImage, optimizedImageUrl } from "@storefront/core/media";
import { SlideshowSettings, newSlide } from "../components/SlideshowSettings";
import { DestinationPicker, type DestinationOption } from "../components/DestinationPicker";
import { AnnouncementSettings, newAnnouncementItem } from "../components/AnnouncementSettings";
import { RichTextEditor, richTextLabels } from "../components/RichTextEditor";
import { RichText } from "../../../../packages/storefront-core/src/storefront/components";
import { PageLoader } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useStore } from "../Layout";
import { useLocale } from "../i18n";
import { friendlyError } from "../utils/errors";

type Device = "desktop" | "tablet" | "mobile";

const copy = {
  en: {
    title: "Customize your storefront", subtitle: "Shape this page, preview every change, then publish when it feels right.",
    save: "Save draft", publish: "Publish", saved: "Draft saved.", published: "Your storefront is up to date.",
    imageSaved: "Banner uploaded and saved. Publish to show it on your store.", unpublished: "Unpublished changes",
    sections: "Page sections", preview: "Preview", settings: "Section content", add: "Add a section", allPages: "All pages",
    pageSettings: "Page settings", pageTitle: "Page title", navigation: "Show in store navigation", pageVisible: "Page available to customers",
    visible: "Shown", hidden: "Hidden", remove: "Remove section", language: "Content language",
    text: "Message", eyebrow: "Short introduction", heading: "Heading", description: "Description",
    button: "Button label", destination: "Button destination", image: "Section image", chooseImage: "Choose an image", imageHint: "PNG, JPEG or WebP, up to 8 MB.", limit: "Number to show",
    source: "Products to show", layout: "Display", alignment: "Arrangement", storeFallback: "Your store name is used when this is empty.",
    revision: "Published version", noSelection: "Choose a section to edit its content.",
    announcement: "Announcement", hero: "Main banner", collections: "Product categories", products: "Products",
    categoryHelp: "Show a visual category section so customers can enter the right product collection quickly.",
    image_text: "Story", promotional_banner: "Promotional banner", newsletter: "Newsletter", slideshow: "Slideshow", featured: "Products you marked as featured", newest: "Newest products",
    product_main: "Product information", product_assurances: "Customer assurances", related_products: "Related products", theme_feature: "Theme feature",
    showReference: "Show product reference", showRating: "Show ratings", showDescription: "Show description", showStock: "Show stock availability", showQuantity: "Let customers choose quantity", showFacts: "Show product specifications",
    firstAssurance: "First assurance", secondAssurance: "Second assurance", essentialSection: "Essential purchase section",
    discounted: "Products currently discounted", top_rated: "Best-rated products", grid: "Grid", slider: "Horizontal slider",
    image_first: "Image first", text_first: "Text first", previewProduct: "Product", previewCategory: "Category",
    bannerWidth: "Banner width", bannerHeight: "Banner height", full: "Full width", contained: "Contained", compact: "Compact", standard: "Standard", tall: "Tall",
    darkEffect: "Dark image effect", bannerText: "Show banner text", bannerButton: "Show banner button",
    homeDestination: "Home page", catalogDestination: "All products", categoryDestinations: "Categories", pageDestinations: "Pages",
  },
  fr: {
    title: "Personnaliser votre boutique", subtitle: "Composez cette page, prévisualisez chaque changement, puis publiez au bon moment.",
    save: "Enregistrer le brouillon", publish: "Publier", saved: "Brouillon enregistré.", published: "Votre boutique est à jour.",
    imageSaved: "Bannière importée et enregistrée. Publiez-la pour l’afficher dans votre boutique.", unpublished: "Modifications non publiées",
    sections: "Sections de la page", preview: "Aperçu", settings: "Contenu de la section", add: "Ajouter une section", allPages: "Toutes les pages",
    pageSettings: "Réglages de la page", pageTitle: "Titre de la page", navigation: "Afficher dans la navigation", pageVisible: "Page accessible aux clients",
    visible: "Affichée", hidden: "Masquée", remove: "Supprimer la section", language: "Langue du contenu",
    text: "Message", eyebrow: "Courte introduction", heading: "Titre", description: "Description",
    button: "Libellé du bouton", destination: "Destination du bouton", image: "Image de la section", chooseImage: "Choisir une image", imageHint: "PNG, JPEG ou WebP, jusqu’à 8 Mo.", limit: "Nombre à afficher",
    source: "Produits à afficher", layout: "Affichage", alignment: "Disposition", storeFallback: "Le nom de votre boutique est utilisé si ce champ est vide.",
    revision: "Version publiée", noSelection: "Choisissez une section pour modifier son contenu.",
    announcement: "Annonce", hero: "Bannière principale", collections: "Catégories de produits", products: "Produits",
    categoryHelp: "Affichez une section visuelle pour aider les clients à accéder rapidement à la bonne catégorie.",
    image_text: "Histoire", promotional_banner: "Bannière promotionnelle", newsletter: "Newsletter", slideshow: "Diaporama", featured: "Produits marqués à la une", newest: "Produits les plus récents",
    product_main: "Informations produit", product_assurances: "Garanties client", related_products: "Produits similaires", theme_feature: "Section du thème",
    showReference: "Afficher la référence", showRating: "Afficher les évaluations", showDescription: "Afficher la description", showStock: "Afficher la disponibilité", showQuantity: "Permettre le choix de quantité", showFacts: "Afficher les caractéristiques",
    firstAssurance: "Première garantie", secondAssurance: "Deuxième garantie", essentialSection: "Section d’achat essentielle",
    discounted: "Produits actuellement en promotion", top_rated: "Produits les mieux notés", grid: "Grille", slider: "Carrousel horizontal",
    image_first: "Image en premier", text_first: "Texte en premier", previewProduct: "Produit", previewCategory: "Catégorie",
    bannerWidth: "Largeur de la bannière", bannerHeight: "Hauteur de la bannière", full: "Pleine largeur", contained: "Contenue", compact: "Compacte", standard: "Standard", tall: "Haute",
    darkEffect: "Effet sombre sur l’image", bannerText: "Afficher le texte de la bannière", bannerButton: "Afficher le bouton de la bannière",
    homeDestination: "Page d’accueil", catalogDestination: "Tous les produits", categoryDestinations: "Catégories", pageDestinations: "Pages",
  },
  ar: {
    title: "تخصيص واجهة متجرك", subtitle: "رتّب هذه الصفحة، عاين كل تعديل، ثم انشرها عندما تصبح جاهزة.",
    save: "حفظ المسودة", publish: "نشر", saved: "تم حفظ المسودة.", published: "واجهة متجرك محدّثة.",
    imageSaved: "تم رفع البانر وحفظه. انشر التغييرات ليظهر في متجرك.", unpublished: "تغييرات غير منشورة",
    sections: "أقسام الصفحة", preview: "المعاينة", settings: "محتوى القسم", add: "إضافة قسم", allPages: "كل الصفحات",
    pageSettings: "إعدادات الصفحة", pageTitle: "عنوان الصفحة", navigation: "إظهارها في قائمة المتجر", pageVisible: "الصفحة متاحة للعملاء",
    visible: "ظاهر", hidden: "مخفي", remove: "حذف القسم", language: "لغة المحتوى",
    text: "الرسالة", eyebrow: "مقدمة قصيرة", heading: "العنوان", description: "الوصف",
    button: "نص الزر", destination: "وجهة الزر", image: "صورة القسم", chooseImage: "اختر صورة", imageHint: "PNG أو JPEG أو WebP، بحد أقصى 8 ميغابايت.", limit: "عدد العناصر",
    source: "المنتجات المعروضة", layout: "طريقة العرض", alignment: "الترتيب", storeFallback: "يُستخدم اسم متجرك عند ترك هذا الحقل فارغاً.",
    revision: "النسخة المنشورة", noSelection: "اختر قسماً لتعديل محتواه.",
    announcement: "إعلان", hero: "الواجهة الرئيسية", collections: "فئات المنتجات", products: "المنتجات",
    categoryHelp: "اعرض قسماً مرئياً للفئات ليساعد العملاء على الوصول بسرعة إلى مجموعة المنتجات المناسبة.",
    image_text: "قصة المتجر", promotional_banner: "بانر ترويجي", newsletter: "النشرة البريدية", slideshow: "عرض الشرائح", featured: "المنتجات التي اخترتها للمقدمة", newest: "أحدث المنتجات",
    product_main: "معلومات المنتج", product_assurances: "ضمانات العميل", related_products: "منتجات ذات صلة", theme_feature: "قسم مميز",
    showReference: "إظهار مرجع المنتج", showRating: "إظهار التقييمات", showDescription: "إظهار الوصف", showStock: "إظهار حالة المخزون", showQuantity: "السماح باختيار الكمية", showFacts: "إظهار مواصفات المنتج",
    firstAssurance: "الضمان الأول", secondAssurance: "الضمان الثاني", essentialSection: "قسم الشراء الأساسي",
    discounted: "المنتجات المخفضة حالياً", top_rated: "المنتجات الأعلى تقييماً", grid: "شبكة", slider: "شريط أفقي",
    image_first: "الصورة أولاً", text_first: "النص أولاً", previewProduct: "منتج", previewCategory: "فئة",
    bannerWidth: "عرض البانر", bannerHeight: "ارتفاع البانر", full: "عرض كامل", contained: "داخل المحتوى", compact: "مدمج", standard: "قياسي", tall: "مرتفع",
    darkEffect: "التأثير الداكن على الصورة", bannerText: "إظهار نص الواجهة", bannerButton: "إظهار زر الواجهة",
    homeDestination: "الصفحة الرئيسية", catalogDestination: "كل المنتجات", categoryDestinations: "الفئات", pageDestinations: "الصفحات",
  },
} as const;

const localized = (en = "", fr = "", ar = ""): LocalizedStorefrontText => ({ en, fr, ar });

function newSection(type: StorefrontSectionType, theme: string = "basic"): StorefrontPageSection {
  const id = `${type.replace(/_/g, "-")}-${Date.now().toString(36)}`;
  let settings: StorefrontPageSection["settings"];
  if (type === "announcement") settings = { items: [newAnnouncementItem()] };
  else if (type === "slideshow") settings = { slides: [newSlide()], autoplay: false, interval: 3 };
  else if (type === "hero") settings = { eyebrow: localized(), title: localized(), subtitle: localized(), cta_label: localized(), cta_url: "#products", image_url: "", show_overlay: true, show_text: true, show_button: true };
  else if (type === "promotional_banner") settings = { title: localized(), body: localized(), cta_label: localized(), cta_url: "", image_url: "", width: "full", height: "standard" };
  else if (type === "collections") settings = { title: localized("Shop by category", "Acheter par catégorie", "تسوق حسب الفئة"), limit: 6 };
  else if (type === "products") settings = { title: localized("Featured products", "Produits à la une", "منتجات مختارة"), source: "featured", limit: 8, layout: "grid" };
  else if (type === "image_text") settings = { title: localized(), body: localized(), cta_label: localized(), cta_url: "", image_url: "", alignment: "image_first" };
  else if (type === "product_main") settings = { show_reference: true, show_rating: true, show_description: true, show_stock: true, show_quantity: true, show_facts: true };
  else if (type === "product_assurances") settings = { first: localized("Help from the store team", "Aide de l’équipe de la boutique", "مساعدة من فريق المتجر"), second: localized("Straightforward order support", "Accompagnement clair pour vos commandes", "دعم واضح ومباشر للطلبات") };
  else if (type === "related_products") settings = { title: localized("Explore related products", "Découvrez des produits similaires", "اكتشف منتجات ذات صلة"), limit: 4 };
  else if (type === "theme_feature") settings = { title: localized(), body: localized(), kind: theme, limit: 4 };
  else settings = { title: localized("Stay in touch", "Restons en contact", "ابق على تواصل"), body: localized() };
  return { id, type, enabled: true, settings };
}

function previewImage(product: Product): string {
  return (product.images.find((image) => image.is_primary) ?? product.images[0])?.image || "";
}

function previewPrice(product: Product, currency: string): string {
  const amount = product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price)
    ? Number(product.price) : Number(product.price) * (1 - Number(product.promo || 0) / 100);
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
}

function localValue(section: StorefrontPageSection, key: string, language: StorefrontEditorLocale): string {
  const value = section.settings[key];
  return typeof value === "object" && value !== null ? String((value as LocalizedStorefrontText)[language] ?? "") : "";
}

export function ThemeEditorPage() {
  const { pageKey = "home" } = useParams();
  const { store } = useStore();
  const locale = useLocale() as StorefrontEditorLocale;
  const c = copy[locale];
  const toast = useToast();
  const [document, setDocument] = useState<StorefrontPageDocument | null>(null);
  const [sections, setSections] = useState<StorefrontPageSection[]>([]);
  const [pageTitle, setPageTitle] = useState<LocalizedStorefrontText>(localized());
  const [pageVisible, setPageVisible] = useState(true);
  const [showInNavigation, setShowInNavigation] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [sectionToAdd, setSectionToAdd] = useState<StorefrontSectionType>("hero");
  const [contentLanguage, setContentLanguage] = useState<StorefrontEditorLocale>(locale);
  const [device, setDevice] = useState<Device>("desktop");
  const [busy, setBusy] = useState<"" | "save" | "publish">("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewCategories, setPreviewCategories] = useState<CatalogSection[]>([]);
  const [previewPages, setPreviewPages] = useState<StorefrontPageDocument[]>([]);
  const [previewConfig, setPreviewConfig] = useState<MerchantStoreConfig | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    if (!store) return;
    let active = true;
    setLoading(true);
    api.getStorefrontPage(store.id, pageKey)
      .then((value) => {
        if (!active) return;
        setDocument(value);
        setSections(value.draft_sections);
        setPageTitle(value.title);
        setPageVisible(value.is_visible);
        setShowInNavigation(value.show_in_navigation);
        setSelectedId(value.draft_sections.find((section) => section.type === "hero")?.id ?? value.draft_sections[0]?.id ?? "");
      })
      .catch((error) => toast.push("error", friendlyError(error, locale, "design.updateFailed")))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale, pageKey, store?.id]);

  useEffect(() => {
    if (!store) return;
    let active = true;
    setCatalogLoading(true);
    setCatalogError(false);
    Promise.all([api.listProducts(store.id), api.listSections(store.id), api.getConfig(store.id), api.listStorefrontPages(store.id)])
      .then(([products, categories, config, pages]) => {
        if (!active) return;
        setPreviewProducts(products.filter((product) => product.is_active));
        setPreviewCategories(categories.filter((category) => category.is_visible !== false));
        setPreviewConfig(config);
        setPreviewPages(pages);
      })
      .catch(() => { if (active) setCatalogError(true); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [store?.id]);

  const selected = sections.find((section) => section.id === selectedId) ?? null;
  const dirty = Boolean(document && (
    JSON.stringify(document.draft_sections) !== JSON.stringify(sections)
    || JSON.stringify(document.title) !== JSON.stringify(pageTitle)
    || document.is_visible !== pageVisible
    || document.show_in_navigation !== showInNavigation
  ));
  const unpublished = Boolean(document && (
    dirty || JSON.stringify(document.published_sections) !== JSON.stringify(sections)
  ));
  const activeSections = useMemo(() => sections.filter((section) => section.enabled), [sections]);
  const destinationOptions = useMemo<DestinationOption[]>(() => {
    const options: DestinationOption[] = [
      { value: "/", label: c.homeDestination },
      { value: "/collections/all", label: c.catalogDestination },
    ];
    for (const category of previewCategories) options.push({
      value: `/collections/${encodeURIComponent(category.key)}`,
      label: category.label,
      group: c.categoryDestinations,
    });
    for (const page of previewPages) {
      options.push({
        value: `/${page.route}`,
        label: page.title[contentLanguage]?.trim() || page.title.en?.trim() || page.page_key,
        group: c.pageDestinations,
      });
    }
    return options;
  }, [c, contentLanguage, previewCategories, previewPages]);
  const availableSectionTypes: StorefrontSectionType[] = document?.page_key === "product"
    ? ["product_main", "product_assurances", "related_products"]
    : ["announcement", "hero", "slideshow", "promotional_banner", "collections", "products", "image_text", "newsletter",
      ...(pageKey === "home" && ["beauty", "fashion", "electronics", "nexa"].includes(previewConfig?.design || "") ? ["theme_feature" as const] : [])];

  useEffect(() => {
    if (!availableSectionTypes.includes(sectionToAdd)) setSectionToAdd(availableSectionTypes[0]);
  }, [availableSectionTypes, sectionToAdd]);

  function replaceSection(next: StorefrontPageSection) {
    setSections((current) => current.map((section) => section.id === next.id ? next : section));
  }

  function setLocalized(key: string, value: string) {
    if (!selected) return;
    const previous = selected.settings[key] as LocalizedStorefrontText;
    replaceSection({ ...selected, settings: { ...selected.settings, [key]: { ...previous, [contentLanguage]: value } } });
  }

  function setSetting(key: string, value: string | number | boolean) {
    if (!selected) return;
    replaceSection({ ...selected, settings: { ...selected.settings, [key]: value } });
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  }

  async function saveDraft(): Promise<StorefrontPageDocument | null> {
    if (!store) return null;
    setBusy("save");
    try {
      const value = await api.saveStorefrontPage(store.id, pageKey, {
        draft_sections: sections,
        title: pageTitle,
        is_visible: pageVisible,
        show_in_navigation: showInNavigation,
      });
      setDocument(value);
      setSections(value.draft_sections);
      setPageTitle(value.title);
      setPageVisible(value.is_visible);
      setShowInNavigation(value.show_in_navigation);
      toast.push("success", c.saved);
      return value;
    } catch (error) {
      toast.push("error", friendlyError(error, locale, "design.updateFailed"));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    if (!store) return;
    setBusy("publish");
    try {
      if (dirty) {
        const saved = await api.saveStorefrontPage(store.id, pageKey, {
          draft_sections: sections,
          title: pageTitle,
          is_visible: pageVisible,
          show_in_navigation: showInNavigation,
        });
        setDocument(saved);
        setSections(saved.draft_sections);
        setPageTitle(saved.title);
        setPageVisible(saved.is_visible);
        setShowInNavigation(saved.show_in_navigation);
      }
      const value = await api.publishStorefrontPage(store.id, pageKey);
      setDocument(value);
      setSections(value.draft_sections);
      toast.push("success", c.published);
    } catch (error) {
      toast.push("error", friendlyError(error, locale, "design.updateFailed"));
    } finally {
      setBusy("");
    }
  }

  async function uploadImage(file: File) {
    if (!store || !selected) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      toast.push("error", c.imageHint);
      return;
    }
    const sectionId = selected.id;
    setUploading(true);
    setUploadProgress(0);
    try {
      const asset = await api.uploadStorefrontImage(store.id, file, setUploadProgress);
      const imageUrl = asset.image_url || asset.image;
      if (!imageUrl) throw new Error("The uploaded image did not return a usable URL.");
      const nextSections = sections.map((section) => section.id === sectionId
        ? { ...section, settings: { ...section.settings, image_url: imageUrl } }
        : section);
      const saved = await api.saveStorefrontPage(store.id, pageKey, {
        draft_sections: nextSections,
        title: pageTitle,
        is_visible: pageVisible,
        show_in_navigation: showInNavigation,
      });
      setDocument(saved);
      setSections(saved.draft_sections);
      setPageTitle(saved.title);
      setPageVisible(saved.is_visible);
      setShowInNavigation(saved.show_in_navigation);
      toast.push("success", c.imageSaved);
    } catch (error) {
      toast.push("error", friendlyError(error, locale, "design.updateFailed"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  if (loading) return <div className="card"><PageLoader /></div>;

  return (
    <div className="theme-editor-page" style={{ paddingBottom: 100 }}>
      <div className="page-head theme-editor-head">
        <div>
          <Link className="theme-back-link" to="/design">← {c.allPages}</Link>
          <h1 className="d-title">{document?.title[locale] || document?.title.en || c.title}</h1>
          <p className="d-subtitle">{c.subtitle}</p>
        </div>
        {createPortal(<div className="product-editor-savebar" role="region" aria-label={c.settings}>
          <div className="product-editor-savebar-copy"><strong>{c.title}</strong><span>{unpublished ? c.unpublished : `${c.revision} ${document?.revision ?? 1}`}</span></div>
          <div className="product-editor-savebar-actions">
          <button type="button" className="btn btn-secondary" disabled={!document || !dirty || Boolean(busy) || uploading} onClick={saveDraft}>
            {busy === "save" ? <span className="spin" aria-hidden="true" /> : <FiSave />} {c.save}
          </button>
          <button type="button" className="btn btn-primary" disabled={!document || !unpublished || Boolean(busy) || uploading} onClick={publish}>
            {busy === "publish" ? <span className="spin" aria-hidden="true" /> : <FiSend />} {c.publish}
          </button>
          </div>
        </div>, window.document.body)}
      </div>

      <fieldset className="theme-editor-shell" disabled={Boolean(busy) || uploading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <aside className="theme-editor-sections card">
          <div className="theme-panel-title"><span>{c.sections}</span><small>{c.revision} {document?.revision ?? 1}</small></div>
          <details className="theme-page-settings">
            <summary>{c.pageSettings}</summary>
            <div>
              <label className="field">
                <span className="field-label">{c.pageTitle} · {contentLanguage.toUpperCase()}</span>
                <input className="input" value={pageTitle[contentLanguage] ?? ""} maxLength={120} onChange={(event) => setPageTitle((current) => ({ ...current, [contentLanguage]: event.target.value }))} />
              </label>
              <label className="theme-check"><input type="checkbox" checked={pageVisible} disabled={document?.is_protected} onChange={(event) => setPageVisible(event.target.checked)} /><span>{c.pageVisible}</span></label>
              <label className="theme-check"><input type="checkbox" checked={showInNavigation} onChange={(event) => setShowInNavigation(event.target.checked)} /><span>{c.navigation}</span></label>
            </div>
          </details>
          <div className="theme-section-list">
            {sections.map((section, index) => (
              <button key={section.id} type="button" className={`theme-section-row${section.id === selectedId ? " is-selected" : ""}`} onClick={() => setSelectedId(section.id)}>
                <span className="theme-section-main"><strong>{c[section.type]}</strong><small>{document?.page_key === "product" && section.type === "product_main" ? c.essentialSection : section.enabled ? c.visible : c.hidden}</small></span>
                <span className="theme-section-actions">
                  <span role="button" tabIndex={0} aria-disabled={document?.page_key === "product" && section.type === "product_main"} title={section.enabled ? c.hidden : c.visible} onClick={(event) => { event.stopPropagation(); if (!(document?.page_key === "product" && section.type === "product_main")) replaceSection({ ...section, enabled: !section.enabled }); }}>{section.enabled ? <FiEye /> : <FiEyeOff />}</span>
                  <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); move(index, -1); }}><FiArrowUp /></span>
                  <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); move(index, 1); }}><FiArrowDown /></span>
                </span>
              </button>
            ))}
          </div>
          <div className="theme-add-section">
            <span>{c.add}</span>
            <div className="theme-add-section-control">
              <select className="select" aria-label={c.add} value={sectionToAdd} onChange={(event) => setSectionToAdd(event.target.value as StorefrontSectionType)}>
                {availableSectionTypes.map((type) => <option key={type} value={type} disabled={sections.some((section) => section.type === type && (type === "product_main" || type === "theme_feature"))}>{c[type]}</option>)}
              </select>
              <button type="button" disabled={sections.length >= 25 || sections.some((section) => section.type === sectionToAdd && (sectionToAdd === "product_main" || sectionToAdd === "theme_feature"))} onClick={() => {
                const section = newSection(sectionToAdd, previewConfig?.design);
                setSections((current) => [...current, section]);
                setSelectedId(section.id);
              }}><FiPlus /> {c.add}</button>
            </div>
          </div>
        </aside>

        <main className="theme-preview-panel">
          <div className="theme-preview-toolbar">
            <strong>{c.preview}</strong>
            <div role="group" aria-label={c.preview}>
              <button type="button" aria-label={locale === "ar" ? "حاسوب" : locale === "fr" ? "Ordinateur" : "Desktop"} className={device === "desktop" ? "is-active" : ""} onClick={() => setDevice("desktop")}><FiMonitor /></button>
              <button type="button" aria-label={locale === "ar" ? "جهاز لوحي" : locale === "fr" ? "Tablette" : "Tablet"} className={device === "tablet" ? "is-active" : ""} onClick={() => setDevice("tablet")}><FiTablet /></button>
              <button type="button" aria-label={locale === "ar" ? "هاتف" : "Mobile"} className={device === "mobile" ? "is-active" : ""} onClick={() => setDevice("mobile")}><FiSmartphone /></button>
            </div>
          </div>
          <div className={`theme-preview-frame is-${device}`} data-header-layout={previewConfig?.appearance.header.layout || "theme"} style={{
            ...(previewConfig ? storefrontAppearanceStyle({
              storeName: store?.name || "", domain: store?.storefront_url || "", contactEmail: previewConfig.contact_email,
              currency: previewConfig.currency, brandColor: previewConfig.brand_color, appearance: previewConfig.appearance,
            }) : {}),
            "--preview-brand": previewConfig?.brand_color || "var(--brand)",
          } as React.CSSProperties}>
            <div className="theme-preview-storebar">{store?.logo_url ? <OptimizedImage className="tp-store-logo" src={store.logo_url} widthHint={240} widths={[120, 180, 240]} sizes="120px" alt={store.name} priority /> : <b>{store?.name}</b>}<span aria-hidden="true"><FiSearch /><FiHeart /><FiShoppingBag /></span></div>
            {activeSections.map((section) => {
              if (section.type === "slideshow") return <Slideshow key={section.id} slides={section.settings.slides as StorefrontSlide[]} locale={contentLanguage} preview mobilePreview={device === "mobile"} />;
              const title = localValue(section, "title", contentLanguage);
              if (section.type === "announcement") { const items = section.settings.items as StorefrontAnnouncementItem[] | undefined; return <div key={section.id} className="tp-announcement">{items?.map((item) => item.text[contentLanguage]).filter(Boolean).join("   •   ") || localValue(section, "text", contentLanguage) || c.announcement}</div>; }
              if (section.type === "hero") { const image = String(section.settings.image_url || ""); const dark = section.settings.show_overlay !== false; const backgroundImage = image ? `${dark ? "linear-gradient(90deg, rgb(0 0 0 / 45%), transparent), " : ""}url("${optimizedImageUrl(image, { width: 1200, crop: "fill" }).replace(/"/g, "%22")}")` : undefined; return <section key={section.id} className="tp-hero" style={backgroundImage ? { backgroundImage, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{section.settings.show_text !== false && <><small>{localValue(section, "eyebrow", contentLanguage)}</small><h2>{title || store?.name}</h2><RichText html={localValue(section, "subtitle", contentLanguage)} className="tp-rich-copy" /></>}{section.settings.show_button !== false && localValue(section, "cta_label", contentLanguage) && <span className="tp-preview-cta">{localValue(section, "cta_label", contentLanguage)}</span>}</section>; }
              if (section.type === "promotional_banner") return <section key={section.id} className={`tp-promo-banner is-${String(section.settings.width)} is-${String(section.settings.height)}`}>{section.settings.image_url ? <OptimizedImage src={String(section.settings.image_url)} widthHint={1200} widths={[480, 720, 960, 1200]} sizes="100vw" alt="" /> : <i />}<div><h3>{title || c.promotional_banner}</h3><RichText html={localValue(section, "body", contentLanguage)} className="tp-rich-copy" />{localValue(section, "cta_label", contentLanguage) && <span className="tp-preview-cta">{localValue(section, "cta_label", contentLanguage)}</span>}</div></section>;
              if (section.type === "collections") return <section key={section.id} className="tp-section"><h3>{title}</h3>{catalogLoading ? <p>{c.previewCategory}…</p> : catalogError ? <p>{c.previewCategory}: unavailable</p> : previewCategories.length ? <div className="tp-categories">{previewCategories.slice(0, Math.min(4, Number(section.settings.limit) || 4)).map((category) => <span key={category.id} style={category.thumbnail ? { backgroundImage: `url("${optimizedImageUrl(category.thumbnail, { width: 480, crop: "fill" }).replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{category.label}</span>)}</div> : <p>{c.previewCategory}: 0</p>}</section>;
              if (section.type === "products") {
                const products = selectHomepageProducts(previewProducts, String(section.settings.source || "featured") as HomepageProductSource, Number(section.settings.limit) || 8).slice(0, 4);
                return <section key={section.id} className="tp-section"><h3>{title}</h3>{catalogLoading ? <p>{c.previewProduct}…</p> : catalogError ? <p>{c.previewProduct}: unavailable</p> : products.length ? <div className={`tp-products is-${String(section.settings.layout)}`}>{products.map((product) => <article key={product.id}>{previewImage(product) ? <OptimizedImage src={previewImage(product)} widthHint={480} widths={[240, 360, 480]} sizes="220px" alt="" /> : <i />}<b>{product.name}</b><small>{previewPrice(product, previewConfig?.currency || "MAD")}</small></article>)}</div> : <p>{c.previewProduct}: 0</p>}</section>;
              }
              if (section.type === "image_text") return <section key={section.id} className={`tp-story is-${String(section.settings.alignment)}`}>{section.settings.image_url ? <OptimizedImage src={String(section.settings.image_url)} widthHint={720} widths={[360, 540, 720]} sizes="360px" alt="" /> : <i />}<div><h3>{title}</h3><RichText html={localValue(section, "body", contentLanguage)} className="tp-rich-copy" /></div></section>;
              if (section.type === "product_main") {
                const product = previewProducts[0];
                return <section key={section.id} className="tp-product-main">{product && previewImage(product) ? <OptimizedImage src={previewImage(product)} widthHint={720} widths={[360, 540, 720]} sizes="360px" alt="" priority /> : <i />}{product ? <div>{section.settings.show_reference && <small>{product.ref}</small>}<h3>{product.name}</h3>{section.settings.show_rating && product.reviews_count > 0 && <span>{product.rating.toFixed(1)} / 5</span>}<b>{previewPrice(product, previewConfig?.currency || "MAD")}</b>{section.settings.show_description && <p>{product.description?.replace(/<[^>]*>/g, "").slice(0, 160)}</p>}<span className="tp-preview-cta">{c.button}</span></div> : <div><h3>{catalogLoading ? `${c.previewProduct}…` : c.previewProduct}</h3></div>}</section>;
              }
              if (section.type === "product_assurances") return <section key={section.id} className="tp-product-assurances"><span>{localValue(section, "first", contentLanguage)}</span><span>{localValue(section, "second", contentLanguage)}</span></section>;
              if (section.type === "theme_feature") {
                const products = previewProducts.slice(0, Math.min(4, Number(section.settings.limit) || 4));
                return <section key={section.id} className={`tp-section tp-theme-feature is-${String(section.settings.kind)}`}><h3>{title || c.theme_feature}</h3><RichText html={localValue(section, "body", contentLanguage)} className="tp-rich-copy" />{products.length ? <div className="tp-products">{products.map((product) => <article key={product.id}>{previewImage(product) ? <OptimizedImage src={previewImage(product)} widthHint={480} widths={[240, 360, 480]} sizes="220px" alt="" /> : <i />}<b>{product.name}</b><small>{previewPrice(product, previewConfig?.currency || "MAD")}</small></article>)}</div> : <small>{catalogLoading ? `${c.previewProduct}…` : `${c.previewProduct}: 0`}</small>}</section>;
              }
              if (section.type === "related_products") return <section key={section.id} className="tp-section"><h3>{title}</h3><div className="tp-products">{previewProducts.slice(1, 1 + Math.min(4, Number(section.settings.limit) || 4)).map((product) => <article key={product.id}>{previewImage(product) ? <OptimizedImage src={previewImage(product)} widthHint={480} widths={[240, 360, 480]} sizes="220px" alt="" /> : <i />}<b>{product.name}</b><small>{previewPrice(product, previewConfig?.currency || "MAD")}</small></article>)}</div></section>;
              return <section key={section.id} className="tp-newsletter"><h3>{title}</h3><RichText html={localValue(section, "body", contentLanguage)} className="tp-rich-copy" /><span>email@example.com　　→</span></section>;
            })}
            {(document?.page_key === "account" || document?.page_key === "login") && (
              <section className="tp-account-preview">
                <div><span>{locale === "ar" ? "البريد الإلكتروني" : locale === "fr" ? "Adresse e-mail" : "Email address"}</span><i /></div>
                <div><span>{locale === "ar" ? "كلمة المرور" : locale === "fr" ? "Mot de passe" : "Password"}</span><i /></div>
                <span className="tp-preview-cta">{locale === "ar" ? "تسجيل الدخول" : locale === "fr" ? "Se connecter" : "Sign in"}</span>
              </section>
            )}
            <div className="theme-preview-footer">{store?.name}</div>
          </div>
        </main>

        <aside className="theme-editor-settings card">
          <div className="theme-panel-title"><span>{c.settings}</span></div>
          {!selected ? <p className="theme-empty-settings">{c.noSelection}</p> : (
            <div className="theme-settings-body">
              <div className="theme-language-tabs"><span>{c.language}</span><div>{(["en", "fr", "ar"] as StorefrontEditorLocale[]).map((language) => <button key={language} type="button" className={contentLanguage === language ? "is-active" : ""} onClick={() => setContentLanguage(language)}>{language.toUpperCase()}</button>)}</div></div>
              {selected.type === "announcement" && <AnnouncementSettings items={(selected.settings.items as StorefrontAnnouncementItem[] | undefined) ?? [{ id: selected.id, text: (selected.settings.text as LocalizedStorefrontText) ?? localized(), link_label: (selected.settings.link_label as LocalizedStorefrontText) ?? localized(), link_url: String(selected.settings.link_url || "") }]} locale={locale} language={contentLanguage} options={destinationOptions} onChange={(items) => replaceSection({ ...selected, settings: { items } })} />}
              {selected.type === "slideshow" && store && <SlideshowSettings key={selected.id} storeId={store.id} slides={selected.settings.slides as StorefrontSlide[]} locale={locale} language={contentLanguage} autoplay={selected.settings.autoplay === true} interval={Number(selected.settings.interval)} destinationOptions={destinationOptions} onChange={(slides) => replaceSection({ ...selected, settings: { ...selected.settings, slides } })} onSetting={setSetting} onUploading={setUploading} />}
              {selected.type !== "announcement" && Object.prototype.hasOwnProperty.call(selected.settings, "text") && <TextField label={c.text} value={localValue(selected, "text", contentLanguage)} onChange={(value) => setLocalized("text", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "eyebrow") && <TextField label={c.eyebrow} value={localValue(selected, "eyebrow", contentLanguage)} onChange={(value) => setLocalized("eyebrow", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "title") && <TextField area maxLength={180} label={c.heading} value={localValue(selected, "title", contentLanguage)} hint={selected.type === "hero" ? c.storeFallback : undefined} onChange={(value) => setLocalized("title", value)} />}
              {selected.type === "collections" && <p className="field-hint">{c.categoryHelp}</p>}
              {Object.prototype.hasOwnProperty.call(selected.settings, "subtitle") && <RichContentField key={`${selected.id}:${contentLanguage}:subtitle`} label={c.description} value={localValue(selected, "subtitle", contentLanguage)} locale={locale} language={contentLanguage} onChange={(value) => setLocalized("subtitle", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "body") && <RichContentField key={`${selected.id}:${contentLanguage}:body`} label={c.description} value={localValue(selected, "body", contentLanguage)} locale={locale} language={contentLanguage} onChange={(value) => setLocalized("body", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "first") && <TextField label={c.firstAssurance} value={localValue(selected, "first", contentLanguage)} onChange={(value) => setLocalized("first", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "second") && <TextField label={c.secondAssurance} value={localValue(selected, "second", contentLanguage)} onChange={(value) => setLocalized("second", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "cta_label") && <TextField label={c.button} value={localValue(selected, "cta_label", contentLanguage)} onChange={(value) => setLocalized("cta_label", value)} />}
              {selected.type !== "announcement" && Object.prototype.hasOwnProperty.call(selected.settings, "link_label") && <TextField label={c.button} value={localValue(selected, "link_label", contentLanguage)} onChange={(value) => setLocalized("link_label", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "cta_url") && <DestinationPicker locale={locale} label={c.destination} value={String(selected.settings.cta_url)} options={destinationOptions} onChange={(value) => setSetting("cta_url", value)} />}
              {selected.type !== "announcement" && Object.prototype.hasOwnProperty.call(selected.settings, "link_url") && <DestinationPicker locale={locale} label={c.destination} value={String(selected.settings.link_url)} options={destinationOptions} onChange={(value) => setSetting("link_url", value)} />}
              {Object.prototype.hasOwnProperty.call(selected.settings, "image_url") && <div className="field"><span className="field-label">{c.image}</span>{String(selected.settings.image_url || "") && <OptimizedImage className={`theme-upload-preview${uploading ? " is-uploading" : ""}`} src={String(selected.settings.image_url)} widthHint={720} widths={[360, 540, 720]} sizes="360px" alt="" />}<label className={`theme-upload-button${uploading ? " is-uploading" : ""}`}><FiUpload /> {uploading ? `${uploadProgress}%` : c.chooseImage}{uploading && <span className="theme-upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}><i style={{ width: `${uploadProgress}%` }} /></span>}<input type="file" aria-label={c.chooseImage} accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ""; }} /></label><small className="field-hint">{c.imageHint}</small></div>}
              {Object.prototype.hasOwnProperty.call(selected.settings, "limit") && <label className="field"><span className="field-label">{c.limit}</span><input className="input" type="number" min="1" max={selected.type === "theme_feature" ? 8 : 24} value={Number(selected.settings.limit)} onChange={(event) => setSetting("limit", Math.max(1, Math.min(selected.type === "theme_feature" ? 8 : 24, Number(event.target.value))))} /></label>}
              {selected.type === "products" && <><SelectField label={c.source} value={String(selected.settings.source)} onChange={(value) => setSetting("source", value)} options={["featured", "newest", "discounted", "top_rated"].map((value) => ({ value, label: c[value as "featured"] }))} /><SelectField label={c.layout} value={String(selected.settings.layout)} onChange={(value) => setSetting("layout", value)} options={[{ value: "grid", label: c.grid }, { value: "slider", label: c.slider }]} /></>}
              {selected.type === "hero" && <div className="theme-product-toggles">{([
                ["show_overlay", c.darkEffect], ["show_text", c.bannerText], ["show_button", c.bannerButton],
              ] as const).map(([key, label]) => <label className="theme-check" key={key}><input type="checkbox" checked={selected.settings[key] !== false} onChange={(event) => setSetting(key, event.target.checked)} /><span>{label}</span></label>)}</div>}
              {selected.type === "image_text" && <SelectField label={c.alignment} value={String(selected.settings.alignment)} onChange={(value) => setSetting("alignment", value)} options={[{ value: "image_first", label: c.image_first }, { value: "text_first", label: c.text_first }]} />}
              {selected.type === "promotional_banner" && <><SelectField label={c.bannerWidth} value={String(selected.settings.width)} onChange={(value) => setSetting("width", value)} options={[{ value: "full", label: c.full }, { value: "contained", label: c.contained }]} /><SelectField label={c.bannerHeight} value={String(selected.settings.height)} onChange={(value) => setSetting("height", value)} options={[{ value: "compact", label: c.compact }, { value: "standard", label: c.standard }, { value: "tall", label: c.tall }]} /></>}
              {selected.type === "product_main" && <div className="theme-product-toggles">{([
                ["show_reference", c.showReference], ["show_rating", c.showRating], ["show_description", c.showDescription],
                ["show_stock", c.showStock], ["show_quantity", c.showQuantity], ["show_facts", c.showFacts],
              ] as const).map(([key, label]) => <label className="theme-check" key={key}><input type="checkbox" checked={selected.settings[key] !== false} onChange={(event) => setSetting(key, event.target.checked)} /><span>{label}</span></label>)}</div>}
              <button type="button" className="btn btn-danger theme-remove" disabled={document?.page_key === "product" && selected.type === "product_main"} onClick={() => { setSections((current) => current.filter((section) => section.id !== selected.id)); setSelectedId(""); }}><FiTrash2 /> {document?.page_key === "product" && selected.type === "product_main" ? c.essentialSection : c.remove}</button>
            </div>
          )}
        </aside>
      </fieldset>
    </div>
  );
}

function TextField({ label, value, onChange, hint, area = false, maxLength = area ? 1200 : 180 }: { label: string; value: string; onChange: (value: string) => void; hint?: string; area?: boolean; maxLength?: number }) {
  return <label className="field"><span className="field-label">{label}</span>{area ? <textarea className="input theme-textarea" value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} /> : <input className="input" value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}{hint && <small className="field-hint">{hint}</small>}</label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="field"><span className="field-label">{label}</span><select className="select" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function RichContentField({ label, value, locale, language, onChange }: { label: string; value: string; locale: StorefrontEditorLocale; language: StorefrontEditorLocale; onChange: (value: string) => void }) {
  return <div className="field"><span className="field-label">{label} · {language.toUpperCase()}</span><RichTextEditor value={value} onChange={onChange} placeholder={`${label} · ${language.toUpperCase()}`} labels={richTextLabels(locale)} compact direction={language === "ar" ? "rtl" : "ltr"} /></div>;
}
