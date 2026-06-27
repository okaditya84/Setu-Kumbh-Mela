"use client";
import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { useI18n } from "@/i18n";
import { LANGUAGES } from "@/i18n/languages";
import { Modal } from "./ui";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100" aria-label="language">
        <Globe className="h-4 w-4" />
        <span>{current?.label}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Language / भाषा">
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left ${l.code === lang ? "border-saffron-500 bg-saffron-50" : "border-slate-200"
                }`}
            >
              <span className="block font-semibold">{l.label}</span>
              {l.code === lang && <Check className="h-4 w-4 text-saffron-600" />}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          The whole app, voice input and audio announcements work in every listed language.
        </p>
      </Modal>
    </>
  );
}
