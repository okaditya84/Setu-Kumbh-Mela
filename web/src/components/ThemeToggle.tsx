"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/** A sun/moon button that flips between light and dark themes. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { isDark, toggle } = useTheme();
  // Avoid a hydration mismatch: render a neutral icon until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
