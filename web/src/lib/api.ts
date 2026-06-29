"use client";
import { API } from "./config";
import type { AuthInfo, CaseDraft, CaseOut, IntakeDraft, MatchResponse, NotificationOut } from "./types";

const TOKEN_KEY = "setu.auth";

export function getAuth(): AuthInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as AuthInfo) : null;
}
export function setAuth(a: AuthInfo | null) {
  if (typeof window === "undefined") return;
  if (a) localStorage.setItem(TOKEN_KEY, JSON.stringify(a));
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (auth) {
    const a = getAuth();
    if (a) headers.set("Authorization", `Bearer ${a.access_token}`);
  }
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (res.status === 401) {
    setAuth(null);
    if (typeof window !== "undefined" && !window.location.pathname.endsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Unauthorized");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (username: string, password: string) =>
    req<AuthInfo>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }, false),

  // Public self-registration — always creates a non-admin ("public") account.
  signup: (full_name: string, email: string, password: string) =>
    req<AuthInfo>("/auth/signup", { method: "POST", body: JSON.stringify({ full_name, email, password }) }, false),

  // Exchange a Google Identity Services credential for a Setu session.
  googleAuth: (credential: string) =>
    req<AuthInfo>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }, false),

  health: () => req<{ status: string }>("/health", {}, false),
  config: () => req<any>("/config", {}, false),

  // Public contact form — no auth required.
  contact: (name: string, email: string, message: string) =>
    req<{ ok: boolean }>(
      "/contact",
      { method: "POST", body: JSON.stringify({ name, email, message }) },
      false
    ),

  createCase: (draft: CaseDraft) =>
    req<MatchResponse>("/cases", { method: "POST", body: JSON.stringify(draft) }),

  // Preview matches WITHOUT persisting (query_case_id is a temp id). The volunteer
  // reviews the summary + matches, then explicitly registers via createCase.
  previewCase: (draft: CaseDraft) =>
    req<MatchResponse>("/cases/preview", { method: "POST", body: JSON.stringify(draft) }),

  listCases: (params: Record<string, string> = {}) =>
    req<CaseOut[]>(`/cases?${new URLSearchParams(params).toString()}`),

  getCase: (id: string) => req<CaseOut>(`/cases/${id}`),
  caseMatches: (id: string) => req<MatchResponse>(`/cases/${id}/matches`),

  refineCase: (id: string, answer: Record<string, string>) =>
    req<MatchResponse>(`/cases/${id}/refine`, { method: "POST", body: JSON.stringify(answer) }),

  updateStatus: (id: string, status: string, matched_case_id?: string) =>
    req<CaseOut>(`/cases/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, matched_case_id }),
    }),

  decideMatch: (missing_case_id: string, found_case_id: string, decision: "confirm" | "reject") =>
    req<any>("/matches/decide", {
      method: "POST",
      body: JSON.stringify({ missing_case_id, found_case_id, decision }),
    }),

  announcement: (id: string, language?: string) =>
    req<{ language: string; text: string; generated_by: string }>(
      `/cases/${id}/announcement${language ? `?language=${encodeURIComponent(language)}` : ""}`
    ),

  // Server-side text-to-speech in the target language. Returns a WAV Blob on
  // success, or null when the backend has no TTS for that language (HTTP 204).
  tts: async (text: string, language: string): Promise<Blob | null> => {
    const a = getAuth();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (a) headers.Authorization = `Bearer ${a.access_token}`;
    const res = await fetch(`${API}/tts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, language }),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new ApiError(res.status, "TTS failed");
    return await res.blob();
  },

  parseText: (transcript: string, case_type?: string) =>
    req<{ transcript: string; draft: IntakeDraft }>("/intake/parse", {
      method: "POST",
      body: JSON.stringify({ transcript, case_type }),
    }),

  // Primary STT path. Pass language="" so the backend auto-detects the spoken language.
  intakeVoice: (blob: Blob, case_type?: string, language = "") => {
    const fd = new FormData();
    fd.append("file", blob, "voice.webm");
    if (case_type) fd.append("case_type", case_type);
    fd.append("language", language);
    return req<{ transcript: string; draft: IntakeDraft; stt_available: boolean }>("/intake/voice", {
      method: "POST",
      body: fd,
    });
  },

  uploadVoice: (caseId: string, blob: Blob, kind = "description", language = "") => {
    const fd = new FormData();
    fd.append("file", blob, "voice.webm");
    fd.append("kind", kind);
    fd.append("language", language);
    return req<any>(`/cases/${caseId}/voice`, { method: "POST", body: fd });
  },
  listVoice: (caseId: string) => req<any[]>(`/cases/${caseId}/voice`),
  audioUrl: (sampleId: string) => `${API}/voice/${sampleId}/audio`,
  // The audio endpoint requires the bearer token, so a plain <audio src> 401s.
  // Fetch it with auth and return an object URL the caller plays (and revokes).
  audioBlobUrl: async (sampleId: string): Promise<string> => {
    const a = getAuth();
    const res = await fetch(`${API}/voice/${sampleId}/audio`, {
      headers: a ? { Authorization: `Bearer ${a.access_token}` } : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, "Audio fetch failed");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  verify: (caseId: string, answer: string) =>
    req<{ verified: boolean; message: string }>(`/cases/${caseId}/verify`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }),

  geoLayers: () => req<any>("/geo/layers"),
  geoLocations: () => req<{ locations: string[] }>("/geo/locations"),
  geoHotspots: () => req<{ hotspots: any[] }>("/geo/hotspots"),
  geoCases: () => req<{ cases: any[] }>("/geo/cases?only_open=true"),
  nearestHelp: (lat: number, lng: number) =>
    req<any>(`/geo/nearest-help?lat=${lat}&lng=${lng}`),

  adminMetrics: () => req<any>("/admin/metrics"),
  adminEvents: () => req<{ events: any[] }>("/admin/events?limit=80"),
  adminPurge: () => req<{ purged: number }>("/admin/purge", { method: "POST" }),

  syncPush: (cases: CaseDraft[]) =>
    req<any>("/sync/push", { method: "POST", body: JSON.stringify({ cases }) }),

  // Center notifications (scoped to the logged-in operator's center).
  listNotifications: () =>
    req<{ notifications: NotificationOut[] }>("/notifications"),
  notificationsUnreadCount: () =>
    req<{ count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    req<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    req<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
};

export { ApiError };
