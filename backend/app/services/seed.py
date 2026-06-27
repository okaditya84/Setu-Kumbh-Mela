"""Idempotent seeding: demo operators + the 2,500 synthetic missing-person rows.

Seeding only runs when the relevant table is empty, so restarts are cheap. The
sample rows load via a fast direct path (no per-row LLM, no O(n²) id counting):
deterministic normalization + gazetteer geo-resolution + PII hashing only.
"""
from __future__ import annotations

import csv
import os
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import hash_pii, mask_mobile, normalize_mobile
from app.db.base import SessionLocal
from app.db.models import Case, CaseStatus, CaseType, Operator, Role
from app.core.security import hash_password
from app.geo.distance import geo_cell
from app.geo.gazetteer import resolve_location
from app.matching.normalize import build_normalized

# Demo accounts with realistic volunteer names, spread across centers.
# Passwords are demo-only — change in production.
DEFAULT_OPERATORS = [
    {"username": "admin", "password": "admin123", "role": Role.admin.value,
     "center": "Central Control Room", "full_name": "Vikram Deshpande (Control Room)"},
    {"username": "volunteer", "password": "volunteer123", "role": Role.volunteer.value,
     "center": "Ramkund Kho-Ya-Paya Kendra", "full_name": "Ramesh Pawar"},
    {"username": "trimbak", "password": "volunteer123", "role": Role.volunteer.value,
     "center": "Trimbakeshwar Kho-Ya-Paya Kendra", "full_name": "Sunita Jadhav"},
    {"username": "panchavati", "password": "volunteer123", "role": Role.volunteer.value,
     "center": "Panchavati Center", "full_name": "Anil Kulkarni"},
    {"username": "nashikroad", "password": "volunteer123", "role": Role.volunteer.value,
     "center": "Nashik Road Center", "full_name": "Meena Shinde"},
    {"username": "adgaon", "password": "volunteer123", "role": Role.volunteer.value,
     "center": "Adgaon Kho-Ya-Paya", "full_name": "Govind Patil"},
]


def seed_operators() -> None:
    db = SessionLocal()
    try:
        if db.execute(select(func.count(Operator.id))).scalar_one() > 0:
            return
        for o in DEFAULT_OPERATORS:
            db.add(Operator(
                username=o["username"].lower(), full_name=o["full_name"],
                password_hash=hash_password(o["password"]), role=o["role"], center=o["center"],
            ))
        db.commit()
        logger.info(f"Seeded {len(DEFAULT_OPERATORS)} demo operators")
    finally:
        db.close()


def _parse_dt(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _parse_float(s: str) -> Optional[float]:
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def seed_sample_cases() -> None:
    db = SessionLocal()
    try:
        if db.execute(select(func.count(Case.id))).scalar_one() > 0:
            return
        path = os.path.join(settings.DATA_DIR, "Synthetic_Missing_Persons_2500.csv")
        if not os.path.exists(path):
            logger.warning(f"Sample CSV not found at {path}; skipping case seed")
            return
        valid_status = {s.value for s in CaseStatus}
        n = 0
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                name = (row.get("missing_person_name") or "").strip() or None
                age_band = (row.get("age_band") or "").strip() or None
                desc = (row.get("physical_description") or "").strip() or None
                normalized = build_normalized(person_name=name, age_band=age_band,
                                              physical_description=desc)
                loc = (row.get("last_seen_location") or "").strip() or None
                coords = resolve_location(loc)
                lat, lng = (coords if coords else (None, None))
                mob = normalize_mobile(row.get("reporter_mobile"))
                status = (row.get("status") or "").strip()
                if status not in valid_status:
                    status = CaseStatus.pending.value
                reported = _parse_dt(row.get("reported_at", ""))
                normalized["is_duplicate_seed_flag"] = (row.get("is_duplicate_report") == "True")
                db.add(Case(
                    case_id=(row.get("case_id") or "").strip() or None,
                    client_uuid=(row.get("case_id") or "").strip() or None,
                    # The dataset is missing-reports filed by families.
                    case_type=CaseType.missing.value,
                    status=status,
                    person_name=name,
                    gender=(row.get("gender") or "").strip() or None,
                    age_band=age_band or normalized.get("inferred_age_band"),
                    state=(row.get("state") or "").strip() or None,
                    district=(row.get("district") or "").strip() or None,
                    language=(row.get("language") or "").strip() or None,
                    last_seen_location=loc,
                    last_seen_lat=lat,
                    last_seen_lng=lng,
                    geo_cell=geo_cell(lat, lng),
                    physical_description=desc,
                    reporting_center=(row.get("reporting_center") or "").strip() or None,
                    reporter_mobile_hash=hash_pii(mob),
                    reporter_mobile_masked=mask_mobile(mob),
                    normalized=normalized,
                    remarks=(row.get("remarks") or "").strip() or None,
                    resolution_hours=_parse_float(row.get("resolution_hours", "")),
                    reported_at=reported or datetime.now(timezone.utc),
                    source="seed",
                ))
                n += 1
                if n % 500 == 0:
                    db.flush()
        db.commit()
        logger.info(f"Seeded {n} official missing-person cases")

        # Generate a realistic, diverse population on top: both MISSING and FOUND
        # reports + planted true cross-center pairs, so reunions actually happen.
        target = settings.SEED_TARGET_TOTAL
        extra = max(0, target - n)
        if extra > 0:
            import random as _random
            from app.services.generate_cases import generate
            rng = _random.Random(2027)
            gen = generate(extra, settings.SEED_FOUND_RATIO, settings.SEED_PLANTED_PAIRS)
            g = 0
            for row in gen:
                name = row["person_name"]
                age_band = row["age_band"]
                desc = row["physical_description"]
                normalized = build_normalized(person_name=name, age_band=age_band, physical_description=desc)
                loc = row["last_seen_location"]
                coords = resolve_location(loc) or (None, None)
                mob = normalize_mobile(row["reporter_mobile"])
                # Most generated cases stay open (matchable); some resolved for stats.
                status = CaseStatus.reunited.value if rng.random() < 0.20 else CaseStatus.pending.value
                db.add(Case(
                    case_id=f"KMP-2027-{n + g + 1:05d}",
                    case_type=row["case_type"], status=status,
                    person_name=name, gender=row["gender"], age_band=age_band,
                    state=row["state"], district=row["district"], language=row["language"],
                    last_seen_location=loc, last_seen_lat=coords[0], last_seen_lng=coords[1],
                    geo_cell=geo_cell(coords[0], coords[1]),
                    physical_description=desc, reporting_center=row["reporting_center"],
                    reporter_mobile_hash=hash_pii(mob), reporter_mobile_masked=mask_mobile(mob),
                    normalized=normalized, reported_at=row["reported_at"], source="seed-gen",
                ))
                g += 1
                if g % 500 == 0:
                    db.flush()
            db.commit()
            logger.info(f"Generated {g} additional realistic cases "
                        f"({settings.SEED_PLANTED_PAIRS} planted pairs, found_ratio={settings.SEED_FOUND_RATIO})")
    finally:
        db.close()
