"use client";
import { useEffect, useRef, useState } from "react";
import { api, setAuth } from "@/lib/api";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/**
 * "Continue with Google" button. Renders nothing unless the backend reports a
 * configured Google client id (GET /config -> auth.google_client_id). On click it
 * opens a popup to Google's OAuth endpoint, receives an ID token via our
 * /auth/google/callback page, exchanges it for a Setu session, and calls onDone().
 *
 * Uses a plain popup (not Google's embedded button script) so it renders
 * reliably and is not blocked by Brave / strict privacy browsers.
 */
export function GoogleSignInButton({ onDone, onError }: { onDone: () => void; onError?: (m: string) => void }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.config()
      .then((c) => { if (!cancelled) setClientId(c?.auth?.google_client_id ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!clientId) return null;

  function start() {
    if (busy) return;
    setBusy(true);

    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const params = new URLSearchParams({
      client_id: clientId as string,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce,
      prompt: "select_account",
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const w = 480;
    const h = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(url, "setu-google-signin", `width=${w},height=${h},left=${left},top=${top}`);
    popupRef.current = popup;

    if (!popup) {
      setBusy(false);
      onError?.("Popup was blocked. Please allow popups for this site and try again.");
      return;
    }

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!e.data || e.data.source !== "setu-google") return;
      window.removeEventListener("message", onMessage);
      clearInterval(closedTimer);

      const { id_token, error } = e.data as { id_token?: string; error?: string };
      if (id_token) {
        api.googleAuth(id_token)
          .then((auth) => { setAuth(auth); onDone(); })
          .catch(() => { setBusy(false); onError?.("Google sign-in failed. Please try again."); });
      } else {
        setBusy(false);
        onError?.(error ? `Google sign-in error: ${error}` : "Google sign-in was cancelled.");
      }
    };
    window.addEventListener("message", onMessage);

    // If the user just closes the popup, stop the spinner.
    const closedTimer = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(closedTimer);
        window.removeEventListener("message", onMessage);
        setBusy(false);
      }
    }, 500);
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-100 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.99] disabled:opacity-60"
    >
      <GoogleIcon />
      {busy ? "Connecting to Google..." : "Continue with Google"}
    </button>
  );
}
