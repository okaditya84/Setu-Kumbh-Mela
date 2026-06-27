from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.db.base import get_db
from app.db.models import Case, CaseStatus
from app.geo import reference
from app.geo.gazetteer import location_names

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/layers")
def layers(user: CurrentUser = Depends(get_current_user)):
    """All static map layers in one call (small datasets, cached in memory)."""
    return {
        "cctv": reference.cctv_cameras(),
        "police_stations": reference.police_stations(),
        "chokepoints": reference.chokepoints(),
        "zones": reference.zones(),
    }


@router.get("/locations")
def locations(user: CurrentUser = Depends(get_current_user)):
    """Known last-seen landmark names for the intake dropdown."""
    return {"locations": location_names()}


@router.get("/hotspots")
def hotspots(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Separation-risk hotspots, amplified by today's open cases nearby."""
    open_cases = db.execute(
        select(Case.last_seen_lat, Case.last_seen_lng).where(
            Case.status == CaseStatus.pending.value,
            Case.last_seen_lat.is_not(None),
        )
    ).all()
    pts = [(r[0], r[1]) for r in open_cases]
    return {"hotspots": reference.hotspots(pts)}


@router.get("/nearest-help")
def nearest_help(lat: float = Query(...), lng: float = Query(...),
                 user: CurrentUser = Depends(get_current_user)):
    return {
        "nearest_police_station": reference.nearest_police(lat, lng),
        "cctv_within_500m": reference.cctv_count_near(lat, lng, 0.5),
    }


@router.get("/cases")
def case_pins(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    only_open: bool = True,
):
    """Lightweight case feed for map pins."""
    stmt = select(Case).where(Case.last_seen_lat.is_not(None))
    if only_open:
        stmt = stmt.where(Case.status == CaseStatus.pending.value)
    rows = db.execute(stmt.limit(2000)).scalars().all()
    return {
        "cases": [
            {
                "id": c.id,
                "case_id": c.case_id,
                "case_type": c.case_type,
                "status": c.status,
                "name": c.person_name,
                "gender": c.gender,
                "age_band": c.age_band,
                "language": c.language,
                "lat": c.last_seen_lat,
                "lng": c.last_seen_lng,
                "last_seen_location": c.last_seen_location,
                "photo_url": c.photo_url,
                "reporting_center": c.reporting_center,
            }
            for c in rows
        ]
    }
