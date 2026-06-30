"use client";
import { useEffect } from "react";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { startAutoSync } from "@/lib/sync";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stop = startAutoSync();
    // Register the service worker for offline shell + installability.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return stop;
  }, []);
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
