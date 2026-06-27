"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import en, { type Dict } from "./dictionaries/en";
import hi from "./dictionaries/hi";
import mr from "./dictionaries/mr";
import { LANGUAGES, langByCode } from "./languages";

// Dictionaries that ship complete UI. Others inherit English at runtime.
const DICTS: Record<string, Partial<Dict>> = { en, hi, mr };

type TFn = (key: keyof Dict | string, vars?: Record<string, string | number>) => string;

interface I18nCtx {
  lang: string;
  setLang: (code: string) => void;
  t: TFn;
  speechLocale: string;
  announceName: string;
  rtl: boolean;
}

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE = "setu.lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE);
    if (saved && LANGUAGES.some((l) => l.code === saved)) setLangState(saved);
    else {
      const nav = navigator.language?.slice(0, 2);
      if (nav && LANGUAGES.some((l) => l.code === nav)) setLangState(nav);
    }
  }, []);

  const def = langByCode(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = def.rtl ? "rtl" : "ltr";
  }, [lang, def.rtl]);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    localStorage.setItem(STORAGE, code);
  }, []);

  const t: TFn = useCallback(
    (key, vars) => {
      const dict = DICTS[lang] || {};
      let s = (dict as any)[key] ?? (en as any)[key] ?? String(key);
      if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]));
      return s;
    },
    [lang]
  );

  return (
    <Ctx.Provider value={{ lang, setLang, t, speechLocale: def.speechLocale, announceName: def.announceName, rtl: !!def.rtl }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
