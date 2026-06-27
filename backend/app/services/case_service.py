"""Case intake / lifecycle service — the single place a Case is born or changes.

Responsibilities:
* build the structured ``normalized`` blob (deterministic, + optional LLM merge);
* resolve last-seen coordinates and the blocking geo-cell;
* protect PII (hash + mask the mobile, hash the secret answer);
* assign a human case id, write an audit event;
* enforce the privacy purge after reunification.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_pii, mask_mobile, normalize_mobile
from app.db.models import AuditEvent, Case, CaseStatus, CaseType
from app.geo.distance import geo_cell
from app.geo.gazetteer import resolve_location
from app.llm.services import enrich_attributes
from app.matching import face
from app.matching.normalize import build_normalized
from app.schemas.models import CaseCreate


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Coerce a (possibly tz-naive, e.g. from SQLite) datetime to aware UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def audit(db: Session, action: str, *, actor: str = "system", entity_type: Optional[str] = None,
          entity_id: Optional[str] = None, meta: Optional[dict] = None) -> None:
    db.add(AuditEvent(action=action, actor=actor, entity_type=entity_type,
                      entity_id=entity_id, meta=meta or {}))


def next_case_id(db: Session) -> str:
    n = db.execute(select(func.count(Case.id))).scalar_one() + 1
    return f"KMP-2027-{n:05d}"


def _merge_enrichment(normalized: dict, enriched: Optional[dict]) -> dict:
    """Fold optional LLM extraction into the deterministic normalized blob."""
    if not enriched:
        return normalized
    out = dict(normalized)
    for key in ("colors", "stable", "garments"):
        merged = set(out.get(key, [])) | set(enriched.get(key, []) or [])
        out[key] = sorted(merged)
    if not out.get("age_years") and enriched.get("age_years"):
        out["age_years"] = enriched["age_years"]
    aliases = enriched.get("name_aliases") or []
    if aliases:
        out["name_keys"] = sorted(set(out.get("name_keys", [])) | set(a.lower() for a in aliases))
    out["gender_hint"] = enriched.get("gender_hint")
    return out


def create_case(db: Session, payload: CaseCreate, actor: str = "system",
                use_llm: bool = True, source: str = "api") -> Case:
    # Normalize case_type defensively.
    ctype = CaseType.found.value if str(payload.case_type).lower().startswith("f") else CaseType.missing.value

    normalized = build_normalized(
        person_name=payload.person_name,
        age_band=payload.age_band,
        physical_description=payload.physical_description,
    )
    if use_llm and settings.INTAKE_LLM_ENRICH:
        normalized = _merge_enrichment(normalized, enrich_attributes(payload.physical_description))

    # Resolve geography (explicit coords win; otherwise the gazetteer).
    lat, lng = payload.last_seen_lat, payload.last_seen_lng
    if (lat is None or lng is None) and payload.last_seen_location:
        resolved = resolve_location(payload.last_seen_location)
        if resolved:
            lat, lng = resolved

    mob = normalize_mobile(payload.reporter_mobile)

    case = Case(
        client_uuid=payload.client_uuid or None,
        case_id=next_case_id(db),
        case_type=ctype,
        status=CaseStatus.pending.value,
        person_name=(payload.person_name or None),
        gender=payload.gender,
        age_band=payload.age_band or normalized.get("inferred_age_band"),
        state=payload.state,
        district=payload.district,
        language=payload.language,
        last_seen_location=payload.last_seen_location,
        last_seen_lat=lat,
        last_seen_lng=lng,
        geo_cell=geo_cell(lat, lng),
        physical_description=payload.physical_description,
        reporting_center=payload.reporting_center,
        reporter_mobile_hash=hash_pii(mob),
        reporter_mobile_masked=mask_mobile(mob),
        normalized=normalized,
        photo_url=payload.photo_url,
        # Auto face embedding when a provider is configured (else None → photo is
        # still used for human recognition).
        face_embedding=face.embed(payload.photo_url) if use_llm else None,
        secret_question=payload.secret_question,
        secret_answer_hash=hash_pii((payload.secret_answer or "").strip().lower() or None),
        remarks=payload.remarks,
        reported_at=payload.reported_at or _now(),
        created_by=actor,
        source=source,
    )
    if case.client_uuid is None:
        case.client_uuid = case.id
    db.add(case)
    db.flush()
    audit(db, "case.create", actor=actor, entity_type="case", entity_id=case.id,
          meta={"case_type": ctype, "center": payload.reporting_center})
    return case


def purge_pii(case: Case) -> None:
    """Scrub identifying fields, keep non-identifying attributes for statistics."""
    case.person_name = None
    case.physical_description = None
    case.reporter_mobile_hash = None
    case.reporter_mobile_masked = None
    case.photo_url = None
    case.face_embedding = None
    case.secret_question = None
    case.secret_answer_hash = None
    for v in case.voice_samples:
        v.transcript = None
    n = dict(case.normalized or {})
    n.pop("name_keys", None)
    case.normalized = n
    case.pii_purged_at = _now()


def set_status(db: Session, case: Case, status: str, actor: str = "system") -> None:
    case.status = status
    if status == CaseStatus.reunited.value and case.reunited_at is None:
        case.reunited_at = _now()
        if case.reported_at:
            case.resolution_hours = round(
                (case.reunited_at - _aware(case.reported_at)).total_seconds() / 3600.0, 2
            )
    case.version += 1
    audit(db, "case.status", actor=actor, entity_type="case", entity_id=case.id, meta={"status": status})


def run_purge_sweep(db: Session) -> int:
    """Purge PII from cases reunited longer ago than the configured window."""
    cutoff = _now()
    purged = 0
    rows = db.execute(
        select(Case).where(Case.status == CaseStatus.reunited.value, Case.pii_purged_at.is_(None))
    ).scalars().all()
    for c in rows:
        if c.reunited_at is None:
            continue
        hours = (cutoff - _aware(c.reunited_at)).total_seconds() / 3600.0
        if hours >= settings.PII_PURGE_AFTER_HOURS:
            purge_pii(c)
            purged += 1
    if purged:
        db.commit()
    return purged
