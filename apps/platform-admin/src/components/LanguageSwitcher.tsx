import { useI18n, type Locale } from "../i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const titles: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };
  return (
    <div className={`language-switcher${compact ? " compact" : ""}`} role="group" aria-label="Language / Langue / اللغة">
      {(["en", "fr", "ar"] as Locale[]).map((value) => (
        <button
          type="button"
          key={value}
          className={locale === value ? "active" : ""}
          aria-pressed={locale === value}
          aria-label={titles[value]}
          title={titles[value]}
          onClick={() => setLocale(value)}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
