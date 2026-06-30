"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "setu.theme";

type Ctx = {
  theme: Theme;        // the user's preference
  isDark: boolean;     // the resolved state actually applied
  setTheme: (t: Theme) => void;
  toggle: () => void;  // cycles light <-> dark (resolving "system" first)
};

const ThemeContext = createContext<Ctx | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function resolve(theme: Theme): boolean {
  return theme === "system" ? systemPrefersDark() : theme === "dark";
}
function apply(isDark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
}

/**
 * Inline script injected before paint so the correct theme is on <html> on the
 * very first frame - no white flash for dark-mode users. Kept in sync with the
 * provider's logic above.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [isDark, setIsDark] = useState(false);

  // Hydrate from localStorage once mounted.
  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme) || "system";
    setThemeState(stored);
    const dark = resolve(stored);
    setIsDark(dark);
    apply(dark);
  }, []);

  // Follow OS changes while preference is "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { setIsDark(mq.matches); apply(mq.matches); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(KEY, t);
    const dark = resolve(t);
    setIsDark(dark);
    apply(dark);
  };

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so a component can render outside the provider during tests.
    return { theme: "system", isDark: false, setTheme: () => {}, toggle: () => {} };
  }
  return ctx;
}
