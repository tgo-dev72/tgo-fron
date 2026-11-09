import { FiMoon, FiSun } from "react-icons/fi";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export function ThemeToggle() {
  const { tr } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const label = tr(theme === "dark" ? "common.useLight" : "common.useDark");

  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
    {theme === "dark" ? <FiSun /> : <FiMoon />}
  </button>;
}
