"""Case -> CaseOut serialization (kept in one place for web/mobile parity)."""
from __future__ import annotations

from app.db.models import Case
from app.schemas.models import CaseOut


def case_to_out(c: Case) -> CaseOut:
    return CaseOut(
        id=c.id,
        client_uuid=c.client_uuid,
        case_id=c.case_id,
        case_type=c.case_type,
        status=c.status,
        person_name=c.person_name,
        gender=c.gender,
        age_band=c.age_band,
        state=c.state,
        district=c.district,
        language=c.language,
        last_seen_location=c.last_seen_location,
        last_seen_lat=c.last_seen_lat,
        last_seen_lng=c.last_seen_lng,
        physical_description=c.physical_description,
        reporting_center=c.reporting_center,
        reporter_mobile_masked=c.reporter_mobile_masked,
        photo_url=c.photo_url,
        has_secret=bool(c.secret_answer_hash),
        secret_question=c.secret_question,
        normalized=c.normalized or {},
        remarks=c.remarks,
        reported_at=c.reported_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
        version=c.version,
    )
