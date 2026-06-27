"""Structured logging + a tiny in-process metrics registry.

Observability is a first-class feature: every request is logged with a request
id and latency, and counters/timers feed the admin dashboard via
``app/observability``. We deliberately avoid heavyweight deps so this runs on a
free-tier box; OpenTelemetry can be layered on later behind an env flag.
"""
from __future__ import annotations

import sys
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from loguru import logger

from app.core.config import settings

_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return
    logger.remove()
    logger.add(
        sys.stderr,
        level=settings.LOG_LEVEL,
        backtrace=False,
        diagnose=False,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <7}</level> | "
            "<cyan>{extra[req_id]}</cyan> | {message}"
        ),
    )
    logger.configure(extra={"req_id": "-"})
    _configured = True


class Metrics:
    """Thread-safe counters + rolling latency samples for the admin view."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: Dict[str, float] = defaultdict(float)
        self._latencies: Dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=500))
        self._started = time.time()

    def incr(self, name: str, value: float = 1.0) -> None:
        with self._lock:
            self._counters[name] += value

    def observe(self, name: str, millis: float) -> None:
        with self._lock:
            self._latencies[name].append(millis)

    def snapshot(self) -> Dict[str, object]:
        with self._lock:
            lat: Dict[str, Dict[str, float]] = {}
            for k, samples in self._latencies.items():
                if not samples:
                    continue
                ordered = sorted(samples)
                n = len(ordered)
                lat[k] = {
                    "count": n,
                    "avg_ms": round(sum(ordered) / n, 2),
                    "p50_ms": round(ordered[int(n * 0.50)], 2),
                    "p95_ms": round(ordered[min(n - 1, int(n * 0.95))], 2),
                }
            return {
                "uptime_seconds": round(time.time() - self._started, 1),
                "counters": dict(self._counters),
                "latency": lat,
            }


metrics = Metrics()
