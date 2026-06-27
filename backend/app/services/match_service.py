"""Match orchestration at the service layer: run the engine, optionally persist
suggested links, enrich the top explanation with the LLM, and confirm reunions.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.serializers import case_to_out
from app.core.config import settings
from app.db.models import Case, CaseStatus, CaseType, MatchLink, MatchStatus
from app.llm.services import explain_match
from app.matching.engine import find_matches
from app.schemas.models import MatchCandidate, MatchResponse
from app.services.case_service import audit, set_status


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _orient(query: Case, other: Case) -> tuple[str, str]:
    """Return (missing_case_id, found_case_id) regardless of query orientation."""
    if query.case_type == CaseType.missing.value:
        return query.id, other.id
    return other.id, query.id


def build_match_response(db: Session, query: Case, persist: bool = True,
                         enrich_top: bool = True) -> MatchResponse:
    result = find_matches(db, query)
    candidates = result["candidates"]

    # Optionally let the LLM rephrase the single best explanation (cheap, 1 call).
    if enrich_top and settings.MATCH_LLM_EXPLANATIONS and candidates:
        top = candidates[0]
        better = explain_match({
            "probability": top["probability"],
            "evidence": top["breakdown"],
        })
        if better:
            top["explanation"] = better.strip()

    if persist:
        for cand in candidates:
            if cand["probability"] < settings.MATCH_REVIEW_THRESHOLD:
                continue
            mid, fid = _orient(query, cand["case"])
            existing = db.execute(
                select(MatchLink).where(
                    MatchLink.missing_case_id == mid, MatchLink.found_case_id == fid
                )
            ).scalar_one_or_none()
            if existing:
                existing.probability = cand["probability"]
                existing.score = cand["score"]
                existing.breakdown = cand["breakdown"]
                existing.explanation = cand["explanation"]
            else:
                db.add(MatchLink(
                    missing_case_id=mid, found_case_id=fid,
                    score=cand["score"], probability=cand["probability"],
                    breakdown=cand["breakdown"], explanation=cand["explanation"],
                    status=MatchStatus.suggested.value,
                ))
        db.commit()

    out_candidates = [
        MatchCandidate(
            case=case_to_out(c["case"]),
            score=c["score"],
            probability=c["probability"],
            tier=c["tier"],
            breakdown=c["breakdown"],
            explanation=c["explanation"],
        )
        for c in candidates
    ]
    return MatchResponse(
        query_case_id=query.id,
        candidates=out_candidates,
        needs_disambiguation=result["needs_disambiguation"],
        disambiguation_questions=result["disambiguation_questions"],
        total_considered=result["total_considered"],
    )


def decide(db: Session, missing_case_id: str, found_case_id: str, decision: str, actor: str) -> MatchLink:
    link = db.execute(
        select(MatchLink).where(
            MatchLink.missing_case_id == missing_case_id,
            MatchLink.found_case_id == found_case_id,
        )
    ).scalar_one_or_none()
    if link is None:
        link = MatchLink(missing_case_id=missing_case_id, found_case_id=found_case_id)
        db.add(link)
    link.status = MatchStatus.confirmed.value if decision == "confirm" else MatchStatus.rejected.value
    link.decided_by = actor
    link.decided_at = _now()

    if decision == "confirm":
        for cid in (missing_case_id, found_case_id):
            c = db.get(Case, cid)
            if c and c.status != CaseStatus.reunited.value:
                set_status(db, c, CaseStatus.reunited.value, actor=actor)
    audit(db, "match.decide", actor=actor, entity_type="match",
          entity_id=f"{missing_case_id}:{found_case_id}", meta={"decision": decision})
    db.commit()
    db.refresh(link)
    return link


def decide_status_reunion(db: Session, case: Case, matched_case_id: str, actor: str) -> None:
    """Helper used when a status PATCH marks one side reunited with a known match."""
    other = db.get(Case, matched_case_id)
    if not other:
        return
    mid, fid = _orient(case, other)
    decide(db, mid, fid, "confirm", actor)
