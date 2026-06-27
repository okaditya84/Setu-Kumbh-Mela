"""Unit tests for the matching scorer + normalization invariants."""
from datetime import datetime, timezone

from app.db.models import Case, CaseType
from app.matching.normalize import build_normalized, extract_descriptors, name_keys
from app.matching.scorer import score_pair


def _case(**kw) -> Case:
    base = dict(
        id=kw.pop("id", "x"), client_uuid="x", case_id="x",
        case_type=CaseType.missing.value, status="Pending",
        reported_at=datetime(2027, 7, 20, 10, 0, tzinfo=timezone.utc),
    )
    base.update(kw)
    c = Case(**{k: v for k, v in base.items() if k != "normalized"})
    c.normalized = kw.get("normalized") or build_normalized(
        person_name=base.get("person_name"), age_band=base.get("age_band"),
        physical_description=base.get("physical_description"),
    )
    return c


def test_cross_language_color_normalizes():
    # "safed" (Hindi), "vellai" (Tamil), "white" all -> white
    for word in ["safed saree", "vellai saree", "white saree", "shada kapda"]:
        assert "white" in extract_descriptors(word)["colors"]
    assert "saffron" in extract_descriptors("bhagwa kurta")["colors"]


def test_nickname_expansion():
    keys = name_keys("Raju")
    assert "rajesh" in keys and "rajendra" in keys


def test_gender_conflict_suppresses():
    a = _case(id="a", gender="Male", age_band="61-70", language="Hindi")
    b = _case(id="b", gender="Female", age_band="61-70", language="Hindi", case_type=CaseType.found.value)
    res = score_pair(a, b)
    assert res.hard_conflict is True
    assert res.probability <= 0.15


def test_missing_fields_do_not_penalize():
    # Two cases agreeing on everything present; one has blanks. Should still score > 0.
    a = _case(id="a", gender="Male", age_band="61-70", language="Tamil", state="Kerala")
    b = _case(id="b", gender="Male", age_band="61-70", language="Tamil", case_type=CaseType.found.value)
    res = score_pair(a, b)
    assert res.weight > 0
    assert res.probability > 0.3


def test_stable_descriptor_beats_color():
    """A shared walking stick should outweigh a shared shirt colour."""
    stick = score_pair(
        _case(id="a", gender="Male", age_band="71-80", physical_description="old man with walking stick"),
        _case(id="b", gender="Male", age_band="71-80", physical_description="elderly, lathi",
              case_type=CaseType.found.value),
    )
    color = score_pair(
        _case(id="c", gender="Male", age_band="71-80", physical_description="man in red shirt"),
        _case(id="d", gender="Male", age_band="71-80", physical_description="red kurta",
              case_type=CaseType.found.value),
    )
    assert stick.weight > color.weight


def test_geo_proximity_helps():
    near = _case(id="a", gender="Female", age_band="61-70", last_seen_location="Ramkund Ghat")
    near_b = _case(id="b", gender="Female", age_band="61-70", last_seen_location="Panchavati Circle",
                   case_type=CaseType.found.value)
    far_b = _case(id="c", gender="Female", age_band="61-70", last_seen_location="Trimbakeshwar Approach",
                  case_type=CaseType.found.value)
    assert score_pair(near, near_b).weight > score_pair(near, far_b).weight
