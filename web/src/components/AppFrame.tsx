"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FilePlus2, Map, ListChecks, Activity, WifiOff, RefreshCw, LogOut } from "lucide-react";
import { useI18n } from "@/i18n";
import { useOnline, usePending, useAuthGuard } from "@/lib/hooks";
import { setAuth } from "@/lib/api";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationsBell } from "./NotificationsBell";
import { Spinner } from "./ui";

function NavItem({ href, label, icon: Icon, active }: any) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium ${
        active ? "text-saffron-700" : "text-slate-500"
      }`}
    >
      <Icon className={`h-6 w-6 ${active ? "text-saffron-600" : "text-slate-400"}`} />
      {label}
    </Link>
  );
}

// Horizontal nav link used in the top bar on large screens.
function TopNavLink({ href, label, icon: Icon, active }: any) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        active ? "bg-saffron-50 text-saffron-700" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-saffron-600" : "text-slate-400"}`} />
      {label}
    </Link>
  );
}

export function AppFrame({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { t } = useI18n();
  const { auth, resolved } = useAuthGuard();
  const online = useOnline();
  const pending = usePending();
  const pathname = usePathname();

  // Until the client has mounted and read localStorage, render a stable
  // placeholder so the first client render matches the server render.
  if (!resolved) {
    return (
      <div className="min-h-full grid place-items-center py-20">
        <Spinner className="h-6 w-6 text-saffron-600" />
      </div>
    );
  }
  if (!auth) return null; // guard redirects to /login
  const isAdmin = auth.role === "admin";

  const nav = [
    { href: "/dashboard", label: t("nav.home"), icon: Home },
    { href: "/intake?type=found", label: t("nav.intake"), icon: FilePlus2 },
    { href: "/map", label: t("nav.map"), icon: Map },
    { href: "/cases", label: t("nav.cases"), icon: ListChecks },
    ...(isAdmin ? [{ href: "/admin", label: t("nav.admin"), icon: Activity }] : []),
  ];

  return (
    <div className="min-h-full flex flex-col pb-20 lg:pb-6">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto w-full max-w-6xl flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-saffron-600 text-white font-black">से</span>
            <span className="font-extrabold tracking-tight">{t("app.name")}</span>
          </Link>
          {/* Inline nav (large screens only — small screens use the bottom bar) */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {nav.map((n) => (
              <TopNavLink key={n.href} {...n} active={pathname === n.href.split("?")[0]} />
            ))}
          </nav>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationsBell />
            <LanguageSwitcher />
            <button
              onClick={() => {
                setAuth(null);
                location.href = "/login";
              }}
              className="p-2 rounded-lg hover:bg-slate-100"
              aria-label={t("nav.logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Status strip */}
        {(!online || pending > 0) && (
          <div className={`text-center text-xs py-1 ${online ? "bg-amber-50 text-amber-700" : "bg-slate-800 text-white"}`}>
            {!online ? (
              <span className="inline-flex items-center gap-1.5">
                <WifiOff className="h-3.5 w-3.5" /> {t("common.offline")} — {t("sync.offlineNote")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> {t("sync.queued", { n: pending })}
              </span>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8 py-4 lg:py-6">{children}</main>

      {/* Bottom nav (thumb reach) — small/medium screens only */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 lg:hidden">
        <div className="mx-auto max-w-3xl flex items-center justify-around py-1">
          {nav.map((n) => (
            <NavItem key={n.href} {...n} active={pathname === n.href.split("?")[0]} />
          ))}
        </div>
      </nav>
    </div>
  );
}
