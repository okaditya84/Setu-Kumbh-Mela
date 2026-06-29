// Mirrors the backend API contract (see docs/API.md).

export type CaseType = "missing" | "found";
export type CaseStatus = "Pending" | "Reunited" | "Transferred to hospital" | "Unresolved";

export interface CaseDraft {
  client_uuid?: string;
  case_type: CaseType;
  person_name?: string | null;
  gender?: string | null;
  age_band?: string | null;
  state?: string | null;
  district?: string | null;
  language?: string | null;
  last_seen_location?: string | null;
  last_seen_lat?: number | null;
  last_seen_lng?: number | null;
  physical_description?: string | null;
  reporting_center?: string | null;
  reporter_mobile?: string | null;
  photo_url?: string | null;
  secret_question?: string | null;
  secret_answer?: string | null;
  remarks?: string | null;
  reported_at?: string | null;
}

export interface CaseOut {
  id: string;
  client_uuid: string;
  case_id: string;
  case_type: CaseType;
  status: CaseStatus;
  person_name?: string | null;
  gender?: string | null;
  age_band?: string | null;
  state?: string | null;
  district?: string | null;
  language?: string | null;
  last_seen_location?: string | null;
  last_seen_lat?: number | null;
  last_seen_lng?: number | null;
  physical_description?: string | null;
  reporting_center?: string | null;
  reporter_mobile_masked?: string | null;
  photo_url?: string | null;
  has_secret: boolean;
  secret_question?: string | null;
  normalized: Record<string, any>;
  remarks?: string | null;
  reported_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  version: number;
}

export interface MatchCandidate {
  case: CaseOut;
  score: number;
  probability: number;
  tier: "strong" | "possible" | "weak";
  breakdown: { field: string; detail: string; weight: number }[];
  explanation: string;
}

export interface MatchResponse {
  query_case_id: string;
  candidates: MatchCandidate[];
  needs_disambiguation: boolean;
  disambiguation_questions: { field: string; question: string; options: string[] }[];
  total_considered: number;
}

export interface IntakeDraft {
  case_type?: CaseType | null;
  person_name?: string | null;
  gender?: string | null;
  age_band?: string | null;
  age_years_guess?: number | null;
  language?: string | null;
  state?: string | null;
  district?: string | null;
  last_seen_location?: string | null;
  physical_description?: string | null;
  colors: string[];
  stable: string[];
  confidence: number;
  source?: string;
}

export interface NotificationOut {
  id: string;
  kind: string;
  title: string;
  body: string;
  case_id?: string | null;
  related_case_id?: string | null;
  probability?: number | null;
  read: boolean;
  created_at: string;
}

export interface AuthInfo {
  access_token: string;
  role: "admin" | "volunteer" | "public";
  center: string;
  full_name: string;
}
