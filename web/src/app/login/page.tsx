"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { api, setAuth } from "@/lib/api";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
      <div className="flex justify-end p-3">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-saffron-600 text-white text-2xl font-black mb-3">
          से
        </div>
        <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
        <p className="text-slate-500 mb-6">{t("app.tagline")}</p>

        <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
          <h2 className="font-bold text-lg">{t("login.title")}</h2>
          <p className="text-sm text-slate-500 -mt-2">{t("login.subtitle")}</p>
          <div>
            <label className="label">{t("login.username")}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" required />
          </div>
          <div>
            <label className="label">{t("login.password")}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{t("login.error")}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="h-5 w-5" /> : <LogIn className="h-5 w-5" />} {t("login.submit")}
          </button>
          <p className="text-xs text-center text-slate-400">{t("login.demo")}</p>
        </form>
      </div>
    </div>
  );
}
