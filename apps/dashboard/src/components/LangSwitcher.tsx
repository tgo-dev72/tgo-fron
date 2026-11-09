import { useLocale, useSetLocale, type Locale } from "../i18n";

const OPTIONS: Array<{ code: Locale; label: string; title: string }> = [
  { code: "en", label: "EN", title: "English" },
  { code: "fr", label: "FR", title: "Français" },
  { code: "ar", label: "AR", title: "العربية" },
];

export function LangSwitcher({ compact }: { compact?: boolean }) {
  const locale = useLocale();
  const setLocale = useSetLocale();

  return (
    <div className={`lang-switch${compact ? " lang-switch-compact" : ""}`} role="group" aria-label="Language / Langue / اللغة">
      {OPTIONS.map((o) => (
        <button type="button" key={o.code} className={locale === o.code ? "active" : ""} title={o.title} aria-label={o.title} aria-pressed={locale === o.code} onClick={() => setLocale(o.code)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
