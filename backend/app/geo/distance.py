"""Geospatial helpers."""
from __future__ import annotations

import math
from typing import Optional, Tuple

EARTH_KM = 6371.0088


def haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Great-circle distance in km between (lat, lng) points."""
    lat1, lng1 = a
    lat2, lng2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(min(1.0, math.sqrt(h)))


def geo_cell(lat: Optional[float], lng: Optional[float], precision: float = 0.02) -> Optional[str]:
    """Quantise a point to a coarse grid cell (~2 km) for blocking.

    Returned as "r{row}c{col}". Neighbouring cells are enumerated by
    ``neighbor_cells`` so a point near a boundary still blocks against
    candidates just across it.
    """
    if lat is None or lng is None:
        return None
    r = int(math.floor(lat / precision))
    c = int(math.floor(lng / precision))
    return f"r{r}c{c}"


def neighbor_cells(lat: Optional[float], lng: Optional[float], precision: float = 0.02):
    if lat is None or lng is None:
        return []
    r = int(math.floor(lat / precision))
    c = int(math.floor(lng / precision))
    return [f"r{r+dr}c{c+dc}" for dr in (-1, 0, 1) for dc in (-1, 0, 1)]
