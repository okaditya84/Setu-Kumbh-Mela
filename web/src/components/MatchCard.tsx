"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, UserCheck, Languages, Image as ImageIcon, Volume2 } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MatchCandidate } from "@/lib/types";
import { Chip } from "./ui";

const TIER = {
  strong: { color: "green", barClass: "bg-green-500" },
  possible: { color: "amber", barClass: "bg-amber-500" },
  weak: { color: "slate", barClass: "bg-slate-400" },
} as const;

export function MatchCard({
  cand,
  onConfirm,
  confirming,
}: {
  cand: MatchCandidate;
  onConfirm?: () => void;
  confirming?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const c = cand.case;
  const tier = TIER[cand.tier];
  const pct = Math.round(cand.probability * 100);

  return (
    <div className="card overflow-hidden">
      <div className={`h-1.5 ${tier.barClass}`} style={{ width: `${pct}%` }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          {c.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover border" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-slate-400 text-xl font-bold">
              {(c.person_name || "?")[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold truncate">{c.person_name || t("common.unknown")}</p>
              <Chip color={tier.color}>{t(`match.${cand.tier}`)} · {pct}%</Chip>
            </div>
            <p className="text-sm text-slate-500">
              {c.case_id} · {c.gender} · {c.age_band}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
              {c.language && (
                <span className="inline-flex items-center gap-1"><Languages className="h-3 w-3" />{c.language}</span>
              )}
              {c.last_seen_location && (
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.last_seen_location}</span>
              )}
              {c.reporting_center && <span>· {c.reporting_center}</span>}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-700 bg-slate-50 rounded-lg p-2.5">{cand.explanation}</p>

        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            {t("match.why")} <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
          <div className="flex items-center gap-2">
            {/* See the candidate's photo + hear their voice to identify (both ways). */}
            <Link href={`/case/${c.id}`} className="btn-ghost py-2 px-3 text-sm">
              <ImageIcon className="h-4 w-4" /> <Volume2 className="h-4 w-4" />
            </Link>
            {onConfirm && (
              <button onClick={onConfirm} disabled={confirming} className="btn-teal py-2 px-4 text-sm">
                <UserCheck className="h-4 w-4" /> {t("match.confirmReunion")}
              </button>
            )}
          </div>
        </div>

        {open && (
          <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
            {cand.breakdown.map((b, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{b.detail}</span>
                <span className={`font-mono ${b.weight >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {b.weight >= 0 ? "+" : ""}
                  {b.weight}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
