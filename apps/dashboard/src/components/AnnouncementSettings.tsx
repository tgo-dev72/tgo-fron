import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2 } from "react-icons/fi";
import type { StorefrontAnnouncementItem, StorefrontEditorLocale } from "../api/client";
import { DestinationPicker, type DestinationOption } from "./DestinationPicker";
import "./slideshow-settings.css";

const copy = {
  en: { intro: "Add up to 8 messages. Two or more messages move continuously across the announcement bar.", item: "Message", add: "Add message", text: "Text", label: "Link label (optional)", link: "Destination", earlier: "Move earlier", later: "Move later", remove: "Remove" },
  fr: { intro: "Ajoutez jusqu’à 8 messages. À partir de deux messages, ils défilent en continu dans la barre d’annonce.", item: "Message", add: "Ajouter un message", text: "Texte", label: "Libellé du lien (facultatif)", link: "Destination", earlier: "Déplacer avant", later: "Déplacer après", remove: "Supprimer" },
  ar: { intro: "أضف حتى 8 رسائل. عند إضافة رسالتين أو أكثر ستتحرك باستمرار داخل شريط الإعلانات.", item: "الرسالة", add: "إضافة رسالة", text: "النص", label: "نص الرابط (اختياري)", link: "الوجهة", earlier: "نقل للأعلى", later: "نقل للأسفل", remove: "حذف" },
};
const localized = () => ({ en: "", fr: "", ar: "" });
export const newAnnouncementItem = (): StorefrontAnnouncementItem => ({ id: `announcement-${crypto.randomUUID()}`, text: localized(), link_label: localized(), link_url: "" });

export function AnnouncementSettings({ items, locale, language, options, onChange }: { items: StorefrontAnnouncementItem[]; locale: StorefrontEditorLocale; language: StorefrontEditorLocale; options: DestinationOption[]; onChange: (items: StorefrontAnnouncementItem[]) => void }) {
  const c = copy[locale];
  const update = (id: string, patch: Partial<StorefrontAnnouncementItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const move = (index: number, offset: number) => { const next = [...items]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); };
  return <div className="slide-settings"><p className="field-hint">{c.intro}</p>{items.map((item, index) => <div className="slide-settings-card" key={item.id}>
    <div className="slide-settings-head"><strong>{c.item} {index + 1}</strong><div><button type="button" className="btn btn-ghost btn-sm" aria-label={c.earlier} disabled={index === 0} onClick={() => move(index, -1)}><FiArrowUp /></button><button type="button" className="btn btn-ghost btn-sm" aria-label={c.later} disabled={index === items.length - 1} onClick={() => move(index, 1)}><FiArrowDown /></button><button type="button" className="btn btn-ghost btn-sm" aria-label={c.remove} disabled={items.length === 1} onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><FiTrash2 /></button></div></div>
    <label className="field"><span className="field-label">{c.text} · {language.toUpperCase()}</span><input className="input" value={item.text[language]} maxLength={180} dir={language === "ar" ? "rtl" : "ltr"} onChange={(event) => update(item.id, { text: { ...item.text, [language]: event.target.value } })} /></label>
    <label className="field"><span className="field-label">{c.label} · {language.toUpperCase()}</span><input className="input" value={item.link_label[language]} maxLength={180} dir={language === "ar" ? "rtl" : "ltr"} onChange={(event) => update(item.id, { link_label: { ...item.link_label, [language]: event.target.value } })} /></label>
    <DestinationPicker locale={locale} label={c.link} value={item.link_url} options={options} onChange={(link_url) => update(item.id, { link_url })} />
  </div>)}<button type="button" className="btn btn-secondary" disabled={items.length >= 8} onClick={() => onChange([...items, newAnnouncementItem()])}><FiPlus /> {c.add}</button></div>;
}
