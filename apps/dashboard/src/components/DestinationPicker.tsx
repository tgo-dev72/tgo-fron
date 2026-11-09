import type { StorefrontEditorLocale } from "../api/client";

export interface DestinationOption {
  value: string;
  label: string;
  group?: string;
}

const text = {
  en: { label: "Link to", none: "No link", custom: "Custom web address", customLabel: "Web address", hint: "Choose a store page or enter a secure web address.", invalid: "Use a path beginning with / or #, or an https:// address." },
  fr: { label: "Lien vers", none: "Aucun lien", custom: "Adresse web personnalisée", customLabel: "Adresse web", hint: "Choisissez une page ou saisissez une adresse sécurisée.", invalid: "Utilisez un chemin commençant par / ou #, ou une adresse https://." },
  ar: { label: "الربط بـ", none: "بدون رابط", custom: "عنوان ويب مخصص", customLabel: "عنوان الويب", hint: "اختر صفحة من المتجر أو أدخل عنواناً آمناً.", invalid: "استخدم مساراً يبدأ بـ / أو #، أو عنواناً يبدأ بـ https://." },
} as const;

const validDestination = (value: string) => !value || /^(https:\/\/|\/(?!\/)|#)[^\\\u0000-\u0020]*$/.test(value);

export function DestinationPicker({ locale, value, options, onChange, label }: {
  locale: StorefrontEditorLocale;
  value: string;
  options: DestinationOption[];
  onChange: (value: string) => void;
  label?: string;
}) {
  const c = text[locale];
  const known = !value || options.some((option) => option.value === value);
  const selected = known ? value : "__custom__";
  return <div className="field destination-picker">
    <label>
      <span className="field-label">{label || c.label}</span>
      <select className="select" value={selected} onChange={(event) => {
        const next = event.target.value;
        onChange(next === "__custom__" ? "https://" : next);
      }}>
        <option value="">{c.none}</option>
        {options.map((option) => <option key={`${option.group || "store"}:${option.value}`} value={option.value}>{option.group ? `${option.group} · ` : ""}{option.label}</option>)}
        <option value="__custom__">{c.custom}</option>
      </select>
    </label>
    {selected === "__custom__" && <label className="destination-custom-field">
      <span className="field-label">{c.customLabel}</span>
      <input className={`input${validDestination(value) ? "" : " is-invalid"}`} dir="ltr" inputMode="url" value={value} placeholder="https://example.com" onChange={(event) => onChange(event.target.value.trimStart())} />
      {!validDestination(value) && <small className="field-error">{c.invalid}</small>}
    </label>}
    <small className="field-hint">{c.hint}</small>
  </div>;
}
