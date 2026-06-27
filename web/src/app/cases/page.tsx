"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { CaseOut } from "@/lib/types";
import { Chip } from "@/components/ui";

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
        className="flex gap-2 mb-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
            className={`chip ${type === f.v ? "bg-saffron-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && <p className="text-center text-slate-400 py-6">{t("common.loading")}</p>}
        {!loading &&
          cases.map((c) => (
            <Link key={c.id} href={`/case/${c.id}`} className="card p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.person_name || t("common.unknown")}</p>
                <p className="text-xs text-slate-500">
                  {c.case_id} · {c.gender} · {c.age_band} · {c.language} · {c.last_seen_location}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Chip color={c.case_type === "missing" ? "saffron" : "teal"}>
                  {c.case_type === "missing" ? t("common.missing") : t("common.found")}
                </Chip>
                <Chip color={c.status === "Reunited" ? "green" : "slate"}>{c.status}</Chip>
              </div>
            </Link>
          ))}
        {!loading && cases.length === 0 && <p className="text-center text-slate-400 py-6">—</p>}
      </div>
    </AppFrame>
  );
}
