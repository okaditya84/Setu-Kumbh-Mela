"use client";
import { useEffect, useState } from "react";
import { Users, HeartHandshake, Clock, AlertTriangle, Trash2, Activity } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

function Stat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="card p-4">
      <div className={`inline-grid h-9 w-9 place-items-center rounded-lg mb-2 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Bars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <div className="card p-4">
      <p className="font-semibold mb-3">{title}</p>
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="truncate text-slate-600">{k}</span>
              <span className="text-slate-400">{v}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-saffron-500" style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useI18n();
  const [m, setM] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [purging, setPurging] = useState(false);

  async function load() {
    const [metrics, ev] = await Promise.all([api.adminMetrics(), api.adminEvents()]);
    setM(metrics);
    setEvents(ev.events);
  }
  useEffect(() => {
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(id);
  }, []);

  if (!m) return <AppFrame><div className="mt-10 text-center"><Spinner className="h-6 w-6 mx-auto text-saffron-600" /></div></AppFrame>;

  const tot = m.totals;
  return (
    <AppFrame>
      <h1 className="text-xl font-extrabold mb-3">{t("admin.title")}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={Users} label={t("admin.totalCases")} value={tot.cases} color="bg-slate-100 text-slate-600" />
        <Stat icon={HeartHandshake} label={t("admin.reunionRate")} value={`${Math.round((tot.reunion_rate || 0) * 100)}%`} color="bg-green-100 text-green-700" />
        <Stat icon={Clock} label={t("admin.avgResolution")} value={tot.avg_resolution_hours ? `${tot.avg_resolution_hours}${t("admin.hours")}` : "—"} color="bg-blue-100 text-blue-700" />
        <Stat icon={AlertTriangle} label={t("admin.openCases")} value={tot.open_cases} color="bg-amber-100 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Bars title={t("admin.byCenter")} data={m.by_center} />
        <Bars title={t("admin.byLanguage")} data={m.by_language} />
      </div>

      <div className="card p-4 mt-3">
        <p className="font-semibold mb-3">{t("admin.topHotspots")}</p>
        <div className="space-y-2">
          {m.top_hotspots.map((h: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="truncate">{h.name}</span>
              <div className="flex items-center gap-2">
                {h.recommend_help_point && <span className="chip bg-red-100 text-red-700 text-[10px]">help point</span>}
                <span className="text-slate-400">{h.live_cases_nearby} · {h.cctv_nearby}📷</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 mt-3">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold inline-flex items-center gap-2"><Activity className="h-4 w-4" /> {t("admin.events")}</p>
          <button
            onClick={async () => {
              setPurging(true);
              try {
                await api.adminPurge();
                await load();
              } finally {
                setPurging(false);
              }
            }}
            className="btn-ghost py-1.5 px-3 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" /> {purging ? t("sync.syncing") : t("admin.purge")}
          </button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs border-b border-slate-50 py-1">
              <span className="font-mono text-slate-600">{e.action}</span>
              <span className="text-slate-400">{new Date(e.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  );
}
