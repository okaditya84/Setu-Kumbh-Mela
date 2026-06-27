"""Reference geography: CCTV cameras, police stations, chokepoints, zones.

Loaded once from the bundled CSVs and held in memory (tiny datasets). Powers the
map layers, the separation-risk hotspot model, and nearest-help routing.
"""
from __future__ import annotations

import csv
import os
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from app.core.config import settings
from app.geo.distance import haversine_km

# Risk weight per chokepoint category — where crowds compress, separations spike.
CATEGORY_RISK = {
    "No-vehicle pressure zone": 1.0,
    "Traffic choke point": 0.85,
    "Transfer node": 0.9,
    "Parking belt": 0.55,
    "Parking": 0.45,
    "Outer parking": 0.35,
}


def _path(name: str) -> str:
    return os.path.join(settings.DATA_DIR, name)


def _read_csv(name: str) -> List[dict]:
    p = _path(name)
    if not os.path.exists(p):
        return []
    with open(p, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


@lru_cache
def cctv_cameras() -> List[dict]:
    out = []
    for r in _read_csv("CCTV_Locations.csv"):
        try:
            out.append(
                {
                    "camera_id": r["camera_id"],
                    "lat": float(r["latitude"]),
                    "lng": float(r["longitude"]),
                    "zone": r["camera_id"].split("-")[0],
                }
            )
        except (KeyError, ValueError):
            continue
    return out


@lru_cache
def police_stations() -> List[dict]:
    out = []
    for r in _read_csv("Police_Stations.csv"):
        try:
            out.append(
                {"name": r["station_name"], "lat": float(r["latitude"]), "lng": float(r["longitude"])}
            )
        except (KeyError, ValueError):
            continue
    return out


@lru_cache
def chokepoints() -> List[dict]:
    out = []
    for r in _read_csv("Chokepoints_Parking.csv"):
        try:
            cat = r.get("category", "").strip()
            out.append(
                {
                    "name": r["location_name"],
                    "category": cat,
                    "lat": float(r["latitude"]),
                    "lng": float(r["longitude"]),
                    "risk": CATEGORY_RISK.get(cat, 0.4),
                }
            )
        except (KeyError, ValueError):
            continue
    return out


@lru_cache
def zones() -> List[dict]:
    out = []
    for r in _read_csv("Zone_Boundaries.csv"):
        try:
            out.append(
                {
                    "name": r["zone_name"],
                    "lat": float(r["centroid_lat"]),
                    "lng": float(r["centroid_lng"]),
                    "boundary_points": int(r.get("approx_boundary_points", 0) or 0),
                }
            )
        except (KeyError, ValueError):
            continue
    return out


def cctv_count_near(lat: float, lng: float, radius_km: float = 0.5) -> int:
    return sum(1 for c in cctv_cameras() if haversine_km((lat, lng), (c["lat"], c["lng"])) <= radius_km)


def nearest(points: List[dict], lat: float, lng: float) -> Optional[dict]:
    best, best_d = None, float("inf")
    for p in points:
        d = haversine_km((lat, lng), (p["lat"], p["lng"]))
        if d < best_d:
            best, best_d = p, d
    if best is None:
        return None
    out = dict(best)
    out["distance_km"] = round(best_d, 3)
    return out


def nearest_police(lat: float, lng: float) -> Optional[dict]:
    return nearest(police_stations(), lat, lng)


def hotspots(case_points: Optional[List[Tuple[float, float]]] = None) -> List[dict]:
    """Separation-risk hotspots.

    Base risk comes from chokepoint category (where crowds physically compress).
    If live case coordinates are supplied, nearby reported separations amplify a
    chokepoint's score — so the map reflects *today's* pressure, not just static
    geography. CCTV coverage nearby is reported so organizers can see blind spots.
    """
    case_points = case_points or []
    out = []
    for cp in chokepoints():
        live = 0
        for (clat, clng) in case_points:
            if haversine_km((cp["lat"], cp["lng"]), (clat, clng)) <= 1.0:
                live += 1
        coverage = cctv_count_near(cp["lat"], cp["lng"], 0.5)
        # Static risk + a saturating contribution from live nearby cases.
        score = cp["risk"] * (1.0 + min(live, 20) / 10.0)
        out.append(
            {
                "name": cp["name"],
                "category": cp["category"],
                "lat": cp["lat"],
                "lng": cp["lng"],
                "base_risk": round(cp["risk"], 3),
                "live_cases_nearby": live,
                "cctv_nearby": coverage,
                "risk_score": round(score, 3),
                # Flag well-trafficked, high-risk, low-camera spots for help-point placement.
                "recommend_help_point": cp["risk"] >= 0.8 and coverage <= 2,
            }
        )
    out.sort(key=lambda x: x["risk_score"], reverse=True)
    return out
