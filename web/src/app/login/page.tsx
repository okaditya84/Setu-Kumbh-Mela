"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, ArrowLeft } from "lucide-react";
import { api, setAuth } from "@/lib/api";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Spinner } from "@/components/ui";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const auth = await api.login(username.trim(), password);
      setAuth(auth);
      router.replace("/dashboard");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex items-center justify-between gap-1 p-3">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <Link href="/" className="grid h-16 w-16 place-items-center rounded-2xl bg-saffron-600 text-white text-2xl font-black mb-3" aria-label={t("app.name")}>
          से
        </Link>
        <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">{t("app.tagline")}</p>

        <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
          <h2 className="font-bold text-lg">{t("login.title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">{t("login.subtitle")}</p>
          <div>
            <label className="label">{t("login.username")}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
          </div>
          <div>
            <label className="label">{t("login.password")}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{t("login.error")}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="h-5 w-5" /> : <LogIn className="h-5 w-5" />} {t("login.submit")}
          </button>

          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            {t("signup.or")}
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
          <GoogleSignInButton onDone={() => router.replace("/dashboard")} />

          <p className="text-sm text-center text-slate-500 dark:text-slate-400">
            {t("login.noAccount")}{" "}
            <Link href="/signup" className="font-semibold text-saffron-600 hover:underline">
              {t("login.createAccount")}
            </Link>
          </p>
          <p className="text-xs text-center text-slate-400 dark:text-slate-500">{t("login.staffNote")}</p>
        </form>
      </div>
    </div>
  );
}
