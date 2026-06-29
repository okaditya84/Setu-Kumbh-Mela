"use client";
import React from "react";
import type { CaseStatus, CaseType } from "@/lib/types";

// Color treatment for the prominent STATUS badge.
function statusClasses(status: CaseStatus): string {
  switch (status) {
    case "Reunited":
      return "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 ring-green-200 dark:ring-green-900";
    case "Transferred to hospital":
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-amber-200 dark:ring-amber-900";
    case "Unresolved":
      return "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-900";
    case "Pending":
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-slate-200 dark:ring-slate-800";
  }
}

// The TYPE is shown subtly: a small muted label with a colored left accent.
function typeMeta(caseType: CaseType, t: (k: string) => string) {
  if (caseType === "missing") {
    return { label: t("common.missing") || "Missing", accent: "bg-saffron-500" };
  }
  return { label: t("common.found") || "Found", accent: "bg-teal-500" };
}

/** Small muted "Missing report" / "Found person" prefix with a colored accent bar. */
export function TypeTag({
  caseType,
  t,
  className = "",
}: {
  caseType: CaseType;
  t: (k: string) => string;
  className?: string;
}) {
  const m = typeMeta(caseType, t);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 ${className}`}>
      <span className={`h-3 w-1 rounded-full ${m.accent}`} />
      {m.label}
    </span>
  );
}

/** Prominent colored status badge — the single source of "where is this case at". */
export function StatusBadge({
  status,
  t,
  className = "",
}: {
  status: CaseStatus;
  t?: (k: string) => string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(
        status
      )} ${className}`}
    >
      {status}
    </span>
  );
}

/**
 * Combined badge stack for list rows: subtle type tag stacked above the
 * prominent status badge. Reads as "a missing report that is now reunited".
 */
export function CaseBadges({
  caseType,
  status,
  t,
  align = "end",
}: {
  caseType: CaseType;
  status: CaseStatus;
  t: (k: string) => string;
  align?: "start" | "end";
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}>
      <StatusBadge status={status} t={t} />
      <TypeTag caseType={caseType} t={t} />
    </div>
  );
}
