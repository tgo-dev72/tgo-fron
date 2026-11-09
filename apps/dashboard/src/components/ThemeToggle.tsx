import { FiMoon, FiSun } from "react-icons/fi";
import { t, useLocale } from "../i18n";
import { useTheme } from "../theme";

export function ThemeToggle() {
  const locale = useLocale();
  const { theme, toggleTheme } = useTheme();
  const label = t(locale, theme === "dark" ? "theme.useLight" : "theme.useDark");

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "dark" ? <FiSun /> : <FiMoon />}
    </button>
  );
}
