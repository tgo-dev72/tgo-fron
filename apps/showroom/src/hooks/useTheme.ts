import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "sr-theme";
const CHANGE_EVENT = "tijarago:showroom-theme";

function initial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(KEY);
  return saved === "dark" ? "dark" : "light";
}

/**
 * Showroom theme, persisted in localStorage. Light is the default; the dark
 * palette is applied by setting `data-theme="dark"` on <html>.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(KEY, theme);
    window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: theme }));
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const nextTheme = (event as CustomEvent<Theme>).detail;
      if (nextTheme === "light" || nextTheme === "dark") setTheme(nextTheme);
    };
    window.addEventListener(CHANGE_EVENT, syncTheme);
    return () => window.removeEventListener(CHANGE_EVENT, syncTheme);
  }, []);

  const toggle = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);
  return { theme, toggle };
}
