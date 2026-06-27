"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API } from "@/lib/config";
import en, { type Dict } from "./dictionaries/en";
import { ALL } from "./dictionaries/all";
import { LANGUAGES, langByCode } from "./languages";

// All listed Indian languages ship bundled (pre-translated, INSTANT, offline).
// A language not in the bundle (future addition) is fetched live from the backend
// (GET /i18n/{lang}) and cached. Missing keys always fall back to English.
const BUNDLED: Record<string, Partial<Dict>> = ALL;
const CACHE_PREFIX = "setu.dict.";

type TFn = (key: keyof Dict | string, vars?: Record<string, string | number>) => string;

interface I18nCtx {
  lang: string;
  setLang: (code: string) => void;
  t: TFn;
  speechLocale: string;
  announceName: string;
  rtl: boolean;
  loading: boolean;
}

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE = "setu.lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("en");
  const [dict, setDict] = useState<Partial<Dict>>(en);
  const [loading, setLoading] = useState(false);

  // Resolve a dictionary for a language: bundled → localStorage → fetch.
  const loadDict = useCallback(async (code: string) => {
    if (code === "en") return setDict(en);
    if (BUNDLED[code]) return setDict(BUNDLED[code]);
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + code);
      if (cached) {
        setDict(JSON.parse(cached));
        return;
      }
    } catch {}
    setLoading(true);
    setDict(en); // show English instantly while the translation loads
    try {
      const res = await fetch(`${API}/i18n/${code}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.dict) {
          setDict(data.dict);
          try {
            localStorage.setItem(CACHE_PREFIX + code, JSON.stringify(data.dict));
          } catch {}
        }
      }
    } catch {
      // stay on English fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE);
    const initial =
      saved && LANGUAGES.some((l) => l.code === saved)
        ? saved
        : LANGUAGES.some((l) => l.code === navigator.language?.slice(0, 2))
        ? navigator.language.slice(0, 2)
        : "en";
    setLangState(initial);
    loadDict(initial);
  }, [loadDict]);

  const def = langByCode(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = def.rtl ? "rtl" : "ltr";
  }, [lang, def.rtl]);

  const setLang = useCallback(
    (code: string) => {
      setLangState(code);
      localStorage.setItem(STORAGE, code);
      loadDict(code);
    },
    [loadDict]
  );

  const t: TFn = useCallback(
    (key, vars) => {
      let s = (dict as any)[key] ?? (en as any)[key] ?? String(key);
      if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, String(vars[k]));
      return s;
    },
    [dict]
  );

  return (
    <Ctx.Provider
      value={{ lang, setLang, t, speechLocale: def.speechLocale, announceName: def.announceName, rtl: !!def.rtl, loading }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
