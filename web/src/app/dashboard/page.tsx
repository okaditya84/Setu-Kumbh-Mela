"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, UserPlus, Map, Activity, ArrowRight } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { useI18n } from "@/i18n";
import { api, getAuth } from "@/lib/api";
import type { CaseOut } from "@/lib/types";
import type { AuthInfo } from "@/lib/types";
import { CaseBadges } from "@/components/CaseBadges";

export default function DashboardPage() {
  const { t } = useI18n();
  const [recent, setRecent] = useState<CaseOut[]>([]);
  // Read auth only after mount so server and first client render match (no hydration mismatch).
  const [auth, setAuthInfo] = useState<AuthInfo | null>(null);

  useEffect(() => {
    setAuthInfo(getAuth());
    api.listCases({ limit: "8" }).then(setRecent).catch(() => {});
  }, []);

  return (
    <AppFrame>
      <p className="text-slate-500">
        {t("home.greeting")}{auth?.full_name ? `, ${auth.full_name}` : ""} 🙏
      </p>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/intake?type=missing" className="card p-5 hover:shadow-md transition group">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-saffron-100 text-saffron-700 mb-3">
            <Search className="h-6 w-6" />
          </div>
          <p className="font-bold text-lg">{t("home.reportMissing")}</p>
          <p className="text-sm text-slate-500">{t("home.reportMissingSub")}</p>
        </Link>
        <Link href="/intake?type=found" className="card p-5 hover:shadow-md transition">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-teal-100 text-teal-700 mb-3">
            <UserPlus className="h-6 w-6" />
          </div>
          <p className="font-bold text-lg">{t("home.reportFound")}</p>
          <p className="text-sm text-slate-500">{t("home.reportFoundSub")}</p>
        </Link>
        <Link href="/map" className="card p-5 flex flex-row sm:flex-col items-center sm:items-start gap-3 hover:shadow-md transition">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-500 sm:mb-3">
            <Map className="h-6 w-6" />
          </div>
          <span className="font-bold text-lg">{t("home.viewMap")}</span>
        </Link>
        {auth?.role === "admin" && (
          <Link href="/admin" className="card p-5 flex flex-row sm:flex-col items-center sm:items-start gap-3 hover:shadow-md transition">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-500 sm:mb-3">
              <Activity className="h-6 w-6" />
            </div>
            <span className="font-bold text-lg">{t("home.adminPanel")}</span>
          </Link>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-bold">{t("home.recent")}</h2>
        <Link href="/cases" className="text-sm text-saffron-700 inline-flex items-center gap-1">
          {t("nav.cases")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {recent.map((c) => (
          <Link key={c.id} href={`/case/${c.id}`} className="card p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{c.person_name || t("common.unknown")}</p>
              <p className="text-xs text-slate-500">
                {c.case_id} · {c.gender} · {c.age_band} · {c.last_seen_location}
              </p>
            </div>
            <CaseBadges caseType={c.case_type} status={c.status} t={t} />
          </Link>
        ))}
        {recent.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">{t("common.loading")}</p>}
      </div>
    </AppFrame>
  );
}
