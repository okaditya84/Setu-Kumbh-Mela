"use client";
import { useEffect } from "react";

/**
 * Popup landing page for the Google sign-in flow. Google redirects the popup
 * here with the ID token in the URL fragment (#id_token=...). We hand it back to
 * the window that opened the popup and close. This avoids Google's embedded
 * button script, which some browsers (Brave) block and which can fail silently.
 */
export default function GoogleCallback() {
  useEffect(() => {
    const raw = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(raw);
    const idToken = params.get("id_token");
    const error = params.get("error");

    if (window.opener) {
      window.opener.postMessage(
        { source: "setu-google", id_token: idToken, error },
        window.location.origin
      );
      window.close();
    } else {
      // Opened directly (no popener): bounce to login.
      window.location.replace("/login");
    }
  }, []);

  return (
    <div className="min-h-full grid place-items-center p-8 text-slate-600 dark:text-slate-300">
      <p>Completing Google sign-in...</p>
    </div>
  );
}
