"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { CaseOut } from "@/lib/types";
import { CaseBadges } from "@/components/CaseBadges";

export default function CasesPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [cases, setCases] = useState<CaseOut[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params: Record<string, string> = { limit: "60" };
    if (q) params.q = q;
    if (type) params.case_type = type;
    try {
      setCases(await api.listCases(params));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <AppFrame>
      <h1 className="text-xl font-extrabold mb-3">{t("nav.cases")}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex gap-2 mb-3 max-w-2xl"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input className="input pl-9" placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary px-4">{t("common.search")}</button>
      </form>

      <div className="flex gap-2 mb-3">
        {[
          { v: "", l: t("nav.cases") },
          { v: "missing", l: t("common.missing") },
          { v: "found", l: t("common.found") },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setType(f.v)}
            className={`chip ${type === f.v ? "bg-saffron-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {loading && <p className="col-span-full text-center text-slate-400 dark:text-slate-500 py-6">{t("common.loading")}</p>}
        {!loading &&
          cases.map((c) => (
            <Link key={c.id} href={`/case/${c.id}`} className="card p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.person_name || t("common.unknown")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {c.case_id} · {c.gender} · {c.age_band} · {c.language} · {c.last_seen_location}
                </p>
              </div>
              <CaseBadges caseType={c.case_type} status={c.status} t={t} />
            </Link>
          ))}
        {!loading && cases.length === 0 && <p className="col-span-full text-center text-slate-400 dark:text-slate-500 py-6">—</p>}
      </div>
    </AppFrame>
  );
}
