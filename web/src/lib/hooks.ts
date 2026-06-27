"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "./api";
import { pendingCount } from "./db";
import type { AuthInfo } from "./types";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function usePending(refreshMs = 4000): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const c = await pendingCount();
      if (alive) setN(c);
    };
    tick();
    const id = setInterval(tick, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshMs]);
  return n;
}

/**
 * Redirect to /login if no token.
 * Reads localStorage only after mount so the first client render matches the
 * server render (no hydration mismatch). `resolved` is false until mounted.
 */
export function useAuthGuard() {
  const router = useRouter();
  const [auth, setAuthState] = useState<AuthInfo | null>(null);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    const a = getAuth();
    setAuthState(a);
    setResolved(true);
    if (!a) router.replace("/login");
  }, [router]);
  return { auth, resolved } as const;
}
