"use client";
import Dexie, { type Table } from "dexie";
import type { CaseDraft, CaseOut } from "./types";

// Offline-first store. Intake done with no network is queued here and replayed
// (idempotently, keyed by client_uuid) when connectivity returns. A read cache
// of cases lets the operator keep browsing while offline.

export interface QueuedCase extends CaseDraft {
  client_uuid: string;
  queued_at: number;
  synced: 0 | 1;
  photo_data_url?: string | null; // held locally until upload
}

class SetuDB extends Dexie {
  queue!: Table<QueuedCase, string>;
  cases!: Table<CaseOut, string>;

  constructor() {
    super("setu");
    this.version(1).stores({
      queue: "client_uuid, synced, queued_at",
      cases: "id, case_id, case_type, status, updated_at",
    });
  }
}

export const db = new SetuDB();

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxxyxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function enqueueCase(draft: CaseDraft, photoDataUrl?: string | null): Promise<string> {
  const client_uuid = draft.client_uuid || uuid();
  await db.queue.put({
    ...draft,
    client_uuid,
    queued_at: Date.now(),
    synced: 0,
    photo_data_url: photoDataUrl ?? null,
  });
  return client_uuid;
}

export async function pendingCount(): Promise<number> {
  return db.queue.where("synced").equals(0).count();
}
