import { useState } from "react";
import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2 } from "react-icons/fi";
import { api, type StorefrontSlide, type StorefrontEditorLocale } from "../api/client";
import { ConfirmModal } from "./ConfirmModal";
import { RichTextEditor, richTextLabels } from "./RichTextEditor";
import { useToast } from "./Toast";
import { friendlyError } from "../utils/errors";
import "./slideshow-settings.css";
import { OptimizedImage } from "@storefront/core/media";
import { DestinationPicker, type DestinationOption } from "./DestinationPicker";

const copy = {
  en: { slide: "Slide", add: "Add slide", remove: "Remove slide", confirm: "Remove this slide and its content from the draft?", earlier: "Move earlier", later: "Move later", title: "Heading", body: "Description", button: "Button label", link: "Slide destination", desktop: "Desktop image", mobile: "Mobile image (optional)", fallback: "Uses the desktop image when no mobile image is selected.", alt: "Image description", upload: "Choose image", clear: "Remove image", hint: "PNG, JPEG or WebP, up to 8 MB.", purpose: "The destination makes the whole slide clickable. Add a button label only when you also want a visible call to action.", autoplay: "Advance slides automatically", interval: "Seconds per slide", motion: "Automatic playback pauses on hover or keyboard focus and respects reduced-motion preferences. Preview stays manual." },
  fr: { slide: "Diapositive", add: "Ajouter une diapositive", remove: "Supprimer la diapositive", confirm: "Supprimer cette diapositive et son contenu du brouillon ?", earlier: "Déplacer avant", later: "Déplacer après", title: "Titre", body: "Description", button: "Libellé du bouton", link: "Destination de la diapositive", desktop: "Image ordinateur", mobile: "Image mobile (facultative)", fallback: "L’image ordinateur est utilisée en l’absence d’image mobile.", alt: "Description de l’image", upload: "Choisir une image", clear: "Supprimer l’image", hint: "PNG, JPEG ou WebP, jusqu’à 8 Mo.", purpose: "La destination rend toute la diapositive cliquable. Ajoutez un libellé uniquement pour afficher aussi un bouton.", autoplay: "Faire défiler automatiquement", interval: "Secondes par diapositive", motion: "Le défilement s’arrête au survol ou au focus clavier et respecte la réduction des animations. L’aperçu reste manuel." },
  ar: { slide: "الشريحة", add: "إضافة شريحة", remove: "حذف الشريحة", confirm: "حذف هذه الشريحة ومحتواها من المسودة؟", earlier: "نقل للأعلى", later: "نقل للأسفل", title: "العنوان", body: "الوصف", button: "نص الزر", link: "وجهة الشريحة", desktop: "صورة الحاسوب", mobile: "صورة الهاتف (اختيارية)", fallback: "تُستخدم صورة الحاسوب عند عدم اختيار صورة للهاتف.", alt: "وصف الصورة", upload: "اختر صورة", clear: "حذف الصورة", hint: "PNG أو JPEG أو WebP، حتى 8 ميغابايت.", purpose: "تجعل الوجهة الشريحة كاملة قابلة للنقر. أضف نص الزر فقط إذا أردت إظهار زر أيضاً.", autoplay: "تبديل الشرائح تلقائياً", interval: "الثواني لكل شريحة", motion: "يتوقف العرض عند مرور المؤشر أو تركيز لوحة المفاتيح ويحترم تقليل الحركة. تبقى المعاينة يدوية." },
};

export function newSlide(): StorefrontSlide {
  return { id: `slide-${crypto.randomUUID()}`, title: { en: "", fr: "", ar: "" }, body: { en: "", fr: "", ar: "" }, cta_label: { en: "", fr: "", ar: "" }, alt: { en: "", fr: "", ar: "" }, cta_url: "", image_url: "", mobile_image_url: "" };
}

export function SlideshowSettings({ storeId, slides, locale, language, autoplay, onChange, onSetting, onUploading, destinationOptions = [] }: {
  storeId: number; slides: StorefrontSlide[]; locale: StorefrontEditorLocale; language: StorefrontEditorLocale;
  autoplay: boolean; interval: number; onChange: (slides: StorefrontSlide[]) => void;
  onSetting: (key: string, value: boolean | number) => void; onUploading: (value: boolean) => void;
  destinationOptions?: DestinationOption[];
}) {
  const c = copy[locale];
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const update = (id: string, value: Partial<StorefrontSlide>) => onChange(slides.map((slide) => slide.id === id ? { ...slide, ...value } : slide));
  function move(index: number, offset: number) {
    const next = [...slides];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  async function upload(slide: StorefrontSlide, key: "image_url" | "mobile_image_url", file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { toast.push("error", c.hint); return; }
    setUploading(true); onUploading(true); setProgress(0);
    try { const asset = await api.uploadStorefrontImage(storeId, file, setProgress); update(slide.id, { [key]: asset.image_url }); }
    catch (error) { toast.push("error", friendlyError(error, locale, "design.updateFailed")); }
    finally { setUploading(false); onUploading(false); }
  }
  return <fieldset className="slide-settings" disabled={uploading}>
    <p className="field-hint">{c.purpose}</p>
    <label className="theme-check"><input type="checkbox" checked={autoplay} onChange={(event) => onSetting("autoplay", event.target.checked)} /><span>{c.autoplay}</span></label>
    {autoplay && <p className="field-hint"><strong>{c.interval}:</strong> 3</p>}
    <p className="field-hint">{c.motion}</p>
    {slides.map((slide, index) => <div key={slide.id} className="slide-settings-card">
      <div className="slide-settings-head"><strong>{c.slide} {index + 1}</strong><div>
        <button type="button" className="btn btn-ghost btn-sm" aria-label={`${c.earlier} ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><FiArrowUp /></button>
        <button type="button" className="btn btn-ghost btn-sm" aria-label={`${c.later} ${index + 1}`} disabled={index === slides.length - 1} onClick={() => move(index, 1)}><FiArrowDown /></button>
        <button type="button" className="btn btn-ghost btn-sm" aria-label={`${c.remove} ${index + 1}`} disabled={slides.length === 1} onClick={() => setRemoving(slide.id)}><FiTrash2 /></button>
      </div></div>
      <label className="field"><span className="field-label">{c.title} · {language.toUpperCase()}</span><textarea className="input theme-textarea" dir={language === "ar" ? "rtl" : "ltr"} value={slide.title[language] ?? ""} maxLength={180} onChange={(event) => update(slide.id, { title: { ...slide.title, [language]: event.target.value } })} /></label>
      <div className="field"><span className="field-label">{c.body} · {language.toUpperCase()}</span><RichTextEditor key={`${slide.id}:${language}:body`} value={slide.body[language] ?? ""} onChange={(value) => update(slide.id, { body: { ...slide.body, [language]: value } })} placeholder={`${c.body} · ${language.toUpperCase()}`} labels={richTextLabels(locale)} compact direction={language === "ar" ? "rtl" : "ltr"} /></div>
      {(["cta_label", "alt"] as const).map((key) => <label className="field" key={key}>
        <span className="field-label">{key === "cta_label" ? c.button : c.alt} · {language.toUpperCase()}</span>
        <input className="input" dir={language === "ar" ? "rtl" : "ltr"} value={slide[key][language] ?? ""} maxLength={180} onChange={(event) => update(slide.id, { [key]: { ...slide[key], [language]: event.target.value } })} />
      </label>)}
      <DestinationPicker locale={locale} label={c.link} value={slide.cta_url} options={destinationOptions} onChange={(cta_url) => update(slide.id, { cta_url })} />
      {(["image_url", "mobile_image_url"] as const).map((key) => <div key={key} className="field">
        <span className="field-label">{key === "image_url" ? c.desktop : c.mobile}</span>
        {slide[key] && <OptimizedImage className="theme-upload-preview" src={slide[key]} widthHint={720} widths={[360, 540, 720]} sizes="360px" alt="" />}
        <label className="theme-upload-button">{uploading ? `${progress}%` : c.upload}<input type="file" aria-label={`${key === "image_url" ? c.desktop : c.mobile} ${index + 1}`} accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(slide, key, file); event.target.value = ""; }} /></label>
        {slide[key] && <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(slide.id, { [key]: "" })}>{c.clear}</button>}
        <small className="field-hint">{key === "mobile_image_url" ? c.fallback : c.hint}</small>
      </div>)}
    </div>)}
    <button type="button" className="btn btn-secondary" disabled={slides.length >= 6} onClick={() => onChange([...slides, newSlide()])}><FiPlus /> {c.add}</button>
    <ConfirmModal open={removing !== null} title={c.remove} body={c.confirm} danger onClose={() => setRemoving(null)} onConfirm={() => { onChange(slides.filter((slide) => slide.id !== removing)); setRemoving(null); }} />
  </fieldset>;
}
