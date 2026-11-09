import { LOCALES, LOCALE_NAMES, useLocale } from "../i18n";

export function LanguageSwitcher() {
const { locale, setLocale } = useLocale();
  const titles = { en: "English", fr: "Français", ar: "العربية" } as const;

  return (
    <div className="sr-lang-switcher" role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={l === locale ? "active" : ""}
          onClick={() => setLocale(l)}
          aria-pressed={l === locale}
          aria-label={titles[l]}
          title={titles[l]}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
