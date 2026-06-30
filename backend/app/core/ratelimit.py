"""Dynamic per-IP rate limiting + a granular request trace buffer.

Both are in-memory (no extra infra) and tunable at runtime by an admin:
* ``LIMITS`` (requests/min per IP, per category) can be patched live via
  PATCH /admin/rate-limits - env sets the defaults.
* ``TRACE`` keeps the last N requests (method, path, status, latency, IP, actor)
  for the admin observability feed at GET /admin/trace.

Note for scale: buckets/trace are per-instance. On a single scale-to-zero
instance (this deploy) that's exact; behind many instances, front with Redis.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, List, Optional, Tuple

from app.core.config import settings

# Runtime-adjustable limits (requests per minute, per client IP).
LIMITS: Dict[str, int] = {
    "auth": settings.RATE_LIMIT_AUTH_RPM,
    "write": settings.RATE_LIMIT_WRITE_RPM,
    "general": settings.RATE_LIMIT_RPM,
}

_lock = threading.Lock()
# (ip, category) -> deque[timestamps] within the trailing 60s window.
_buckets: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)

# Recent-request trace ring buffer.
_trace: Deque[dict] = deque(maxlen=settings.TRACE_BUFFER_SIZE)
_counts: Dict[str, float] = defaultdict(float)  # lightweight counters for the dashboard


def category(method: str, path: str) -> str:
    if path.endswith("/auth/login"):
        return "auth"
    if method in ("POST", "PATCH", "PUT", "DELETE"):
        return "write"
    return "general"


def client_ip(headers, fallback: str) -> str:
    # Cloud Run / proxies put the real client first in X-Forwarded-For.
    xff = headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return fallback or "unknown"


def check(ip: str, cat: str) -> Optional[int]:
    """Return None if allowed, else the Retry-After seconds."""
    if not settings.RATE_LIMIT_ENABLED:
        return None
    limit = LIMITS.get(cat, LIMITS["general"])
    now = time.time()
    window = 60.0
    with _lock:
        dq = _buckets[(ip, cat)]
        while dq and now - dq[0] > window:
            dq.popleft()
        if len(dq) >= limit:
            _counts["ratelimit.blocked"] += 1
            return int(window - (now - dq[0])) + 1
        dq.append(now)
    return None


def record_trace(method: str, path: str, status: int, ms: float, ip: str, actor: Optional[str]) -> None:
    with _lock:
        _trace.append({
            "ts": time.time(), "method": method, "path": path, "status": status,
            "ms": round(ms, 1), "ip": ip, "actor": actor or "-",
        })
        _counts["http.requests"] += 1
        if status >= 500:
            _counts["http.5xx"] += 1
        elif status >= 400:
            _counts["http.4xx"] += 1


def recent_traces(limit: int = 200, status_min: int = 0, path_contains: Optional[str] = None) -> List[dict]:
    with _lock:
        items = list(_trace)
    out = []
    for e in reversed(items):
        if e["status"] < status_min:
            continue
        if path_contains and path_contains not in e["path"]:
            continue
        out.append(e)
        if len(out) >= limit:
            break
    return out


def counters() -> Dict[str, float]:
    with _lock:
        return dict(_counts)


def set_limits(new: Dict[str, int]) -> Dict[str, int]:
    with _lock:
        for k, v in new.items():
            if k in LIMITS and isinstance(v, int) and v > 0:
                LIMITS[k] = v
        return dict(LIMITS)
