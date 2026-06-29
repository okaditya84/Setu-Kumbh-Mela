"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

/** Full-card "searching all centers" animation shown during matching. */
export function Scanning({ label }: { label: string }) {
  return (
    <div className="card p-8 text-center overflow-hidden relative">
      <div className="absolute inset-0 scan-sweep pointer-events-none" />
      <div className="relative mx-auto mb-4 h-20 w-20">
        <span className="absolute inset-0 rounded-full bg-saffron-400/40 animate-pulsering" />
        <span className="absolute inset-0 rounded-full bg-saffron-400/30 animate-pulsering [animation-delay:0.5s]" />
        <span className="absolute inset-2 rounded-full bg-saffron-600 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </span>
      </div>
      <p className="relative font-semibold text-slate-700 dark:text-slate-200">{label}</p>
    </div>
  );
}

export function Chip({ children, color = "slate" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    green: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    saffron: "bg-saffron-100 text-saffron-800 dark:bg-saffron-950/50 dark:text-saffron-300",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  };
  return <span className={`chip ${map[color] || map.slate}`}>{children}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  // Render into document.body via a portal. Critical: the modal is position:fixed,
  // but the header has backdrop-filter which makes it a containing block for fixed
  // descendants — so an in-header modal would anchor to the header, not the viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full sm:max-w-md rounded-b-none sm:rounded-2xl animate-[slideup_0.2s_ease] flex flex-col max-h-[88vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
      <style>{`@keyframes slideup{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
  return createPortal(node, document.body);
}

export function Toast({ message, kind = "info" }: { message: string; kind?: "info" | "success" | "error" }) {
  const c = kind === "success" ? "bg-green-600" : kind === "error" ? "bg-red-600" : "bg-slate-800";
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${c} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium`}>
      {message}
    </div>
  );
}
