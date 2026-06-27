"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Modal, Spinner } from "@/components/ui";
import type { NotificationOut } from "@/lib/types";

// English-only strings here on purpose: the i18n owner will migrate them later.

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function NotificationsBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await api.notificationsUnreadCount();
      setCount(count);
    } catch {
      // Silent — bell just shows last known count.
    }
  }, []);

  useEffect(() => {
    refreshCount();
    pollRef.current = setInterval(refreshCount, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshCount]);

  async function openPanel() {
    setOpen(true);
    setLoading(true);
    try {
      const { notifications } = await api.listNotifications();
      setItems(notifications);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function onItem(n: NotificationOut) {
    if (!n.read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
      setCount((c) => Math.max(0, c - 1));
      api.markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    const target = n.related_case_id || n.case_id;
    if (target) router.push(`/case/${target}`);
  }

  async function markAll() {
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    setCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      // Re-sync count if it failed.
      refreshCount();
    }
  }

  return (
    <>
      <button
        onClick={openPanel}
        className="relative p-2 rounded-lg hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Notifications">
        <div className="flex items-center justify-end mb-2">
          <button
            onClick={markAll}
            disabled={items.every((i) => i.read)}
            className="inline-flex items-center gap-1 text-xs font-medium text-saffron-700 disabled:text-slate-300"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Spinner className="h-5 w-5 text-saffron-600" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No notifications</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => onItem(n)}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    n.read
                      ? "border-slate-100 bg-white"
                      : "border-saffron-200 bg-saffron-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-saffron-600" />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${n.read ? "font-medium text-slate-700" : "font-semibold text-slate-900"}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[11px] text-slate-400 mt-1">{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
