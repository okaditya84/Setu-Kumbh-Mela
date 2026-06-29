"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { api, setAuth } from "@/lib/api";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Spinner } from "@/components/ui";

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const auth = await api.signup(name.trim(), email.trim(), password);
      setAuth(auth);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message || t("signup.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex justify-end gap-1 p-3">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-saffron-600 text-white text-2xl font-black mb-3">
          से
        </div>
        <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">{t("app.tagline")}</p>

        <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
          <h2 className="font-bold text-lg">{t("signup.title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">{t("signup.subtitle")}</p>

          <div>
            <label className="label">{t("signup.name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
          <div>
            <label className="label">{t("signup.email")}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" autoComplete="email" required />
          </div>
          <div>
            <label className="label">{t("signup.password")}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t("signup.passwordHint")}</p>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />} {t("signup.submit")}
          </button>

          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            {t("signup.or")}
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
          <GoogleSignInButton onDone={() => router.replace("/dashboard")} onError={setError} />

          <p className="text-sm text-center text-slate-500 dark:text-slate-400">
            {t("signup.haveAccount")}{" "}
            <Link href="/login" className="font-semibold text-saffron-600 hover:underline">
              {t("signup.signin")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
