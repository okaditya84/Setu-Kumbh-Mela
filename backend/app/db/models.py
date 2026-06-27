"""ORM models for the unified Lost & Found registry.

Design notes
------------
* A single ``Case`` table holds both MISSING reports (filed by a family) and
  FOUND reports (filed by a volunteer who has the person in front of them).
  Matching is always MISSING<->FOUND across *all* centers — that is the whole
  point: closing the cross-center gap.
* ``client_uuid`` makes every write idempotent so the offline-first clients can
  safely replay their queue when the network returns.
* PII (mobile, secret answer) is stored hashed + masked, never in clear.
* ``normalized`` JSON holds the structured attributes extracted at intake
  (canonical clothing colours, stable descriptors, nickname-expanded names)
  that the matcher actually scores on.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CaseType(str, enum.Enum):
    missing = "missing"   # family is looking for this person
    found = "found"       # a person is here at a center; we seek their family


class CaseStatus(str, enum.Enum):
    pending = "Pending"
    reunited = "Reunited"
    hospital = "Transferred to hospital"
    unresolved = "Unresolved"


class Role(str, enum.Enum):
    volunteer = "volunteer"
    admin = "admin"


class Operator(Base):
    __tablename__ = "operators"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(128), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default=Role.volunteer.value)
    center: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    # Stable id supplied by the offline client; used for idempotent sync upserts.
    client_uuid: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=_uuid)
    # Human-facing case id, e.g. KMP-2027-00001.
    case_id: Mapped[str] = mapped_column(String(32), index=True)

    case_type: Mapped[str] = mapped_column(String(16), index=True)  # CaseType
    status: Mapped[str] = mapped_column(String(32), default=CaseStatus.pending.value, index=True)

    # --- person attributes ---
    person_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    age_band: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)

    last_seen_location: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_seen_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_seen_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Coarse geo cell for blocking (quantised lat/lng), set at intake.
    geo_cell: Mapped[Optional[str]] = mapped_column(String(24), nullable=True, index=True)

    physical_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reporting_center: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)

    # --- contact (privacy by design) ---
    reporter_mobile_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    reporter_mobile_masked: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)

    # --- structured attributes the matcher scores on (filled at intake) ---
    normalized: Mapped[dict] = mapped_column(JSON, default=dict)

    # --- media ---
    photo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # Optional face embedding (list[float]) for automated photo matching.
    face_embedding: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # --- anti-impersonation: a secret only the real family/person knows ---
    secret_question: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    secret_answer_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    reunited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # When PII was scrubbed post-reunification (privacy purge).
    pii_purged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # Sync/version bookkeeping.
    version: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(16), default="api")  # api | sync | seed

    voice_samples: Mapped[list["VoiceSample"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_block", "case_type", "gender", "age_band"),
        Index("ix_case_status_type", "status", "case_type"),
    )


class VoiceSample(Base):
    __tablename__ = "voice_samples"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    # description = "this is what I sound like"; secret_answer = anti-impersonation
    kind: Mapped[str] = mapped_column(String(24), default="description")
    storage_key: Mapped[str] = mapped_column(String(512))   # path or object key
    url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    content_type: Mapped[str] = mapped_column(String(64), default="audio/webm")
    language: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    case: Mapped["Case"] = relationship(back_populates="voice_samples")


class MatchStatus(str, enum.Enum):
    suggested = "suggested"
    confirmed = "confirmed"
    rejected = "rejected"


class MatchLink(Base):
    """A scored link between a MISSING case and a FOUND case."""

    __tablename__ = "match_links"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    missing_case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    found_case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    probability: Mapped[float] = mapped_column(Float, default=0.0)
    breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=MatchStatus.suggested.value, index=True)
    decided_by: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_link_pair", "missing_case_id", "found_case_id", unique=True),
    )


class AuditEvent(Base):
    """Append-only event log powering the admin observability feed."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    actor: Mapped[str] = mapped_column(String(64), default="system")
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
