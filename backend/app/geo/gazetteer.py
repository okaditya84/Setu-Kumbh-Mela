"""Gazetteer: named ``last_seen_location`` values -> (lat, lng).

The synthetic dataset records the last-seen place as one of 20 named landmarks
rather than coordinates. To score geographic proximity we resolve each name to a
coordinate within the real Nashik–Trimbakeshwar mela corridor.

These are curated approximations anchored on real landmarks (Ramkund, Panchavati,
Trimbakeshwar/Kushavarta, Nashik Road station, CBS, the Trimbak Road exit, Adgaon).
They are intentionally internally consistent so distance ranking is meaningful.
For a real deployment each center's intake UI would drop a pin on the map and
store true coordinates — at which point this table is only a fallback.
"""
from __future__ import annotations

from difflib import get_close_matches
from typing import Dict, Optional, Tuple

# (lat, lng)
GAZETTEER: Dict[str, Tuple[float, float]] = {
    # --- Nashik / Godavari ghats cluster ---
    "Ramkund Ghat": (20.00670, 73.79060),
    "Panchavati Circle": (20.01070, 73.79670),
    "Laxmi Narayan Ghat": (20.00520, 73.79010),
    "Nandur Ghat": (20.00820, 73.79520),
    "Dasak Ghat": (19.95500, 73.84000),
    "Kapila Sangam": (20.02520, 73.80050),
    "Takli Sangam": (20.01530, 73.78540),
    "Sadhugram Gate 1": (20.01230, 73.79820),
    "Sadhugram Gate 2": (20.01410, 73.79930),
    "Main Police Chowki": (20.00560, 73.77980),
    "Bus Stand Nashik": (19.99720, 73.77990),
    "Dindori Road Crossing": (20.03020, 73.77050),
    "Madsangvi Transit": (19.99020, 73.83010),
    "Adgaon Parking": (20.01550, 73.82690),
    "Nashik Road Station": (19.94884, 73.84059),
    # --- Trimbakeshwar cluster (~28 km west) ---
    "Trimbakeshwar Approach": (19.93400, 73.53500),
    "Kushavart Kund": (19.93250, 73.52850),
    "Gauri Patangan": (19.93100, 73.53000),
    "Trimbak Road": (19.96637, 73.66157),
    "Rajur Bahula": (19.92000, 73.70000),
}


def resolve_location(name: Optional[str]) -> Optional[Tuple[float, float]]:
    """Resolve a location name to (lat, lng); tolerant of minor spelling drift."""
    if not name:
        return None
    key = name.strip()
    if key in GAZETTEER:
        return GAZETTEER[key]
    # Case-insensitive direct hit.
    for k, v in GAZETTEER.items():
        if k.lower() == key.lower():
            return v
    # Fuzzy fallback so "Ramkund" still resolves to "Ramkund Ghat".
    close = get_close_matches(key, list(GAZETTEER.keys()), n=1, cutoff=0.6)
    if close:
        return GAZETTEER[close[0]]
    return None


def location_names() -> list[str]:
    return sorted(GAZETTEER.keys())
