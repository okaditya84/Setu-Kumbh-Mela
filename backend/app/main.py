"""Setu backend — FastAPI application entrypoint.

Wires routers, middleware (CORS + request logging/metrics), DB init and seeding.
Boots and serves the full critical path with zero external API keys.
"""
from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.config import settings
from app.core.logging import configure_logging, metrics
from app.db.base import init_db

configure_logging()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Unified, offline-first cross-center Lost & Found network for Kumbh Mela.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _actor_from(request: Request) -> str | None:
    """Best-effort username for tracing (decode the bearer token if present)."""
    from app.core.security import decode_access_token
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        payload = decode_access_token(auth.split(" ", 1)[1].strip())
        if payload:
            return payload.get("username") or payload.get("sub")
    return None


@app.middleware("http")
async def observe(request: Request, call_next):
    from app.core import ratelimit
    req_id = uuid.uuid4().hex[:8]
    method, path = request.method, request.url.path
    ip = ratelimit.client_ip(request.headers, request.client.host if request.client else "")
    cat = ratelimit.category(method, path)
    actor = _actor_from(request)

    # --- dynamic per-IP rate limiting ---
    retry = ratelimit.check(ip, cat)
    if retry is not None:
        ratelimit.record_trace(method, path, 429, 0.0, ip, actor)
        logger.warning(f"rate-limited {ip} {method} {path}")
        return JSONResponse(status_code=429, content={"detail": "Too many requests. Slow down."},
                            headers={"Retry-After": str(retry)})

    start = time.time()
    with logger.contextualize(req_id=req_id):
        try:
            response = await call_next(request)
        except Exception as e:  # safety net -> structured 500
            logger.exception(f"Unhandled error: {e}")
            metrics.incr("http.errors")
            elapsed = (time.time() - start) * 1000
            ratelimit.record_trace(method, path, 500, elapsed, ip, actor)
            return JSONResponse(status_code=500, content={"detail": "Internal server error"})
        elapsed = (time.time() - start) * 1000
        metrics.incr("http.requests")
        metrics.observe(f"http {method} {path}", elapsed)
        ratelimit.record_trace(method, path, response.status_code, elapsed, ip, actor)
        logger.info(f"{method} {path} -> {response.status_code} ({elapsed:.0f}ms) ip={ip}")
        response.headers["X-Request-ID"] = req_id
        return response


# ------------------------------ routers -------------------------------------
from app.api.routers import (  # noqa: E402
    admin, auth, cases, contact, geo, i18n, intake, match, meta, notifications, sync, voice,
)

P = settings.API_PREFIX
app.include_router(meta.router, prefix=P)
app.include_router(i18n.router, prefix=P)
app.include_router(contact.router, prefix=P)
app.include_router(auth.router, prefix=P)
app.include_router(cases.router, prefix=P)
app.include_router(match.router, prefix=P)
app.include_router(intake.router, prefix=P)
app.include_router(notifications.router, prefix=P)
app.include_router(sync.router, prefix=P)
app.include_router(voice.router, prefix=P)
app.include_router(geo.router, prefix=P)
app.include_router(admin.router, prefix=P)


@app.on_event("startup")
def on_startup():
    init_db()
    if settings.SEED_ON_STARTUP:
        from app.services.seed import seed_operators, seed_sample_cases
        seed_operators()
        if settings.SEED_SAMPLE_CASES:
            seed_sample_cases()
    logger.info(f"{settings.APP_NAME} ready (env={settings.APP_ENV}, db={settings.DATABASE_URL})")


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "docs": "/docs", "api": settings.API_PREFIX}
