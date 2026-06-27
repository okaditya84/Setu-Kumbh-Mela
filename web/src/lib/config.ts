// Runtime configuration. The API base is injected at build/deploy time via
// NEXT_PUBLIC_API_BASE (set in Vercel). Falls back to localhost for dev.
export const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "")) ||
  "http://127.0.0.1:8000";

export const API = `${API_BASE}/api/v1`;

export const DEFAULT_MAP = {
  lat: 19.9975,
  lng: 73.7898,
  zoom: 12,
};

export const AGE_BANDS = ["0-12", "13-17", "18-40", "41-60", "61-70", "71-80", "80+"];
export const GENDERS = ["Male", "Female", "Unknown"];
