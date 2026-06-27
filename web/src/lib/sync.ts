"use client";
import { api } from "./api";
import { db } from "./db";

// Drains the offline queue to the server. Safe to call repeatedly; the server
// is idempotent on client_uuid so retries never create duplicates.

let syncing = false;

export async function syncNow(): Promise<{ pushed: number; failed: number }> {
  if (syncing || typeof navigator !== "undefined" && !navigator.onLine) {
    return { pushed: 0, failed: 0 };
  }
  syncing = true;
  let pushed = 0;
  let failed = 0;
  try {
    const items = await db.queue.where("synced").equals(0).toArray();
    for (const item of items) {
      try {
        const { synced, queued_at, photo_data_url, ...draft } = item;
        const res = await api.syncPush([{ ...draft, photo_url: photo_data_url ?? draft.photo_url }]);
        const result = res.results?.[0];
        if (result) {
          await db.queue.update(item.client_uuid, { synced: 1 });
          pushed++;
        }
      } catch {
        failed++;
      }
    }
  } finally {
    syncing = false;
  }
  return { pushed, failed };
}

export function startAutoSync(onChange?: () => void) {
  const run = async () => {
    const r = await syncNow();
    if ((r.pushed || r.failed) && onChange) onChange();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", run);
    const id = window.setInterval(run, 20000); // periodic catch-up
    run();
    return () => {
      window.removeEventListener("online", run);
      window.clearInterval(id);
    };
  }
  return () => {};
}
