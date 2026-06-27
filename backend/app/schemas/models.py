"""Pydantic request/response schemas (the API contract shared by web + mobile)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ------------------------------- Auth ---------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    center: str
    full_name: str


# ------------------------------- Cases --------------------------------------
class CaseCreate(BaseModel):
    # client_uuid makes the create idempotent across offline retries.
    client_uuid: Optional[str] = None
    case_type: str = Field(..., description="missing | found")
    person_name: Optional[str] = None
    gender: Optional[str] = None
    age_band: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    language: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_lat: Optional[float] = None
    last_seen_lng: Optional[float] = None
    physical_description: Optional[str] = None
    reporting_center: Optional[str] = None
    reporter_mobile: Optional[str] = None
    photo_url: Optional[str] = None
    secret_question: Optional[str] = None
    secret_answer: Optional[str] = None
    remarks: Optional[str] = None
    reported_at: Optional[datetime] = None


class CaseStatusUpdate(BaseModel):
    status: str
    matched_case_id: Optional[str] = None


class CaseOut(BaseModel):
    id: str
    client_uuid: str
    case_id: str
    case_type: str
    status: str
    person_name: Optional[str] = None
    gender: Optional[str] = None
    age_band: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    language: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_lat: Optional[float] = None
    last_seen_lng: Optional[float] = None
    physical_description: Optional[str] = None
    reporting_center: Optional[str] = None
    reporter_mobile_masked: Optional[str] = None
    photo_url: Optional[str] = None
    has_secret: bool = False
    normalized: Dict[str, Any] = {}
    remarks: Optional[str] = None
    reported_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    version: int = 1

    class Config:
        from_attributes = True


# ------------------------------- Matching -----------------------------------
class MatchCandidate(BaseModel):
    case: CaseOut
    score: float
    probability: float
    tier: str
    breakdown: List[Dict[str, Any]]
    explanation: str


class MatchResponse(BaseModel):
    query_case_id: str
    candidates: List[MatchCandidate]
    needs_disambiguation: bool
    disambiguation_questions: List[Dict[str, Any]]
    total_considered: int


class MatchDecision(BaseModel):
    missing_case_id: str
    found_case_id: str
    decision: str = Field(..., description="confirm | reject")


# ------------------------------- Voice / verify -----------------------------
class VoiceOut(BaseModel):
    id: str
    case_id: str
    kind: str
    url: Optional[str] = None
    language: Optional[str] = None
    transcript: Optional[str] = None
    duration_seconds: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VerifyRequest(BaseModel):
    answer: str


class VerifyResponse(BaseModel):
    verified: bool
    message: str


# ------------------------------- Sync ---------------------------------------
class SyncPushRequest(BaseModel):
    cases: List[CaseCreate] = []


class SyncPushResult(BaseModel):
    client_uuid: str
    server_id: str
    case_id: str
    status: str  # created | updated | conflict


class SyncPushResponse(BaseModel):
    results: List[SyncPushResult]
    server_time: datetime


class SyncPullResponse(BaseModel):
    cases: List[CaseOut]
    server_time: datetime


# ------------------------------- Announcement -------------------------------
class AnnouncementResponse(BaseModel):
    language: str
    text: str
    generated_by: str  # "llm" | "template"
