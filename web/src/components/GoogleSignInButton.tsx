"use client";
import { useEffect, useRef, useState } from "react";
import { api, setAuth } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const GSI_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * "Continue with Google" button. Renders nothing unless the backend reports a
 * configured Google client id (GET /config -> auth.google_client_id), so the
 * page degrades gracefully until the OAuth client exists. On success it stores
 * the session and calls onDone().
 */
export function GoogleSignInButton({ onDone, onError }: { onDone: () => void; onError?: (m: string) => void }) {
  const { isDark } = useTheme();
  const [clientId, setClientId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.config()
      .then((c) => { if (!cancelled) setClientId(c?.auth?.google_client_id ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: any) => {
          try {
            const auth = await api.googleAuth(resp.credential);
            setAuth(auth);
            onDone();
          } catch {
            onError?.("Google sign-in failed");
          }
        },
      });
      ref.current.innerHTML = "";
      window.google.accounts.id.renderButton(ref.current, {
        theme: isDark ? "filled_black" : "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
    };

    if (window.google?.accounts?.id) {
      render();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
    }
    return () => { cancelled = true; };
  }, [clientId, isDark, onDone, onError]);

  if (!clientId) return null;
  return <div ref={ref} className="flex justify-center" />;
}
