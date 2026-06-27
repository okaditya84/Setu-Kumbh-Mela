"""Real end-to-end + load test against a LIVE running server.

Not unit stubs — this drives the actual HTTP API: real DB, real matching engine,
real LLM (Claude) for intake parsing and announcements, real concurrency.

Usage:
    # terminal 1
    uvicorn app.main:app --port 8099
    # terminal 2
    BASE_URL=http://127.0.0.1:8099 python -m scripts.e2e_load_test

Phases:
  1. Functional E2E (correctness) — exercises every flow with assertions,
     including a real Claude call for /intake/parse and /announcement.
  2. Load — fires many concurrent report+match requests derived from the real
     seeded data and reports throughput + p50/p95/p99 latency + error rate.
"""
from __future__ import annotations

import os
import random
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8099").rstrip("/")
API = f"{BASE}/api/v1"
PASS, FAIL = 0, 0


def check(name: str, cond: bool, extra: str = "") -> None:
    global PASS, FAIL
    mark = "✅" if cond else "❌"
    if cond:
        PASS += 1
    else:
        FAIL += 1
    print(f"  {mark} {name}{(' — ' + extra) if extra else ''}")


def login(client: httpx.Client, user: str, pw: str) -> str:
    r = client.post(f"{API}/auth/login", json={"username": user, "password": pw})
    r.raise_for_status()
    return r.json()["access_token"]


def functional(client: httpx.Client) -> None:
    print("\n── Phase 1: functional E2E (real HTTP + real Claude) ──")
    vol = {"Authorization": f"Bearer {login(client, 'volunteer', 'volunteer123')}"}
    adm = {"Authorization": f"Bearer {login(client, 'admin', 'admin123')}"}
    check("login (volunteer + admin)", True)

    # auth gate
    check("auth required without token", client.get(f"{API}/cases").status_code == 401)

    # real LLM: voice-first intake parsing of mixed Hinglish
    rp = client.post(f"{API}/intake/parse", headers=vol,
                     json={"transcript": "ek budhi aurat hai, safed saree, 70 saal, Marathi bolti, Ramkund ke paas",
                           "case_type": "found"})
    draft = rp.json()["draft"]
    check("intake/parse extracts gender", draft.get("gender") == "Female", str(draft.get("gender")))
    check("intake/parse normalizes colour→white", "white" in (draft.get("colors") or []))
    check("intake/parse used the live LLM", draft.get("source") == "llm", str(draft.get("source")))

    # File a MISSING report, then a matching FOUND report at another center.
    miss = client.post(f"{API}/cases", headers=vol, json={
        "case_type": "missing", "person_name": "Test Aaji", "gender": "Female", "age_band": "61-70",
        "state": "Maharashtra", "language": "Marathi", "last_seen_location": "Ramkund Ghat",
        "physical_description": "old woman in white saree, walking stick",
        "reporter_mobile": "+91 9988776655", "secret_question": "Village name?", "secret_answer": "Ozar",
    }).json()
    missing_id = miss["query_case_id"]
    found = client.post(f"{API}/cases", headers=vol, json={
        "case_type": "found", "gender": "Female", "age_band": "61-70", "language": "Marathi",
        "last_seen_location": "Panchavati Circle", "physical_description": "elderly lady, safed saree, lathi",
    }).json()
    found_id = found["query_case_id"]
    ids = [c["case"]["id"] for c in found["candidates"]]
    check("found report surfaces the missing case as candidate", missing_id in ids,
          f"{len(found['candidates'])} candidates, considered {found['total_considered']}")
    if found["candidates"]:
        top = found["candidates"][0]
        check("top candidate has an explanation", bool(top["explanation"]))
        check("top candidate has evidence breakdown", len(top["breakdown"]) > 0)

    # anti-impersonation verify (real hashing)
    v_ok = client.post(f"{API}/cases/{missing_id}/verify", headers=vol, json={"answer": "ozar"}).json()
    v_no = client.post(f"{API}/cases/{missing_id}/verify", headers=vol, json={"answer": "wrong"}).json()
    check("secret verify accepts correct answer", v_ok["verified"] is True)
    check("secret verify rejects wrong answer", v_no["verified"] is False)

    # mobile masked, never clear
    case = client.get(f"{API}/cases/{missing_id}", headers=vol).json()
    check("mobile stored masked, not clear", case["reporter_mobile_masked"] == "99xxxx55" and "9988776655" not in str(case))

    # real Claude announcement in Marathi
    ann = client.get(f"{API}/cases/{found_id}/announcement?language=Marathi", headers=vol).json()
    check("announcement generated", bool(ann.get("text")), f"by={ann.get('generated_by')}")

    # confirm reunion → both Reunited
    client.post(f"{API}/matches/decide", headers=vol,
                json={"missing_case_id": missing_id, "found_case_id": found_id, "decision": "confirm"})
    st = client.get(f"{API}/cases/{missing_id}", headers=vol).json()["status"]
    check("confirm reunion flips status to Reunited", st == "Reunited", st)

    # sync idempotency (the anti-duplicate guarantee)
    payload = {"cases": [{"client_uuid": "e2e-fixed-001", "case_type": "missing", "person_name": "Sync Dedup",
                          "gender": "Male", "age_band": "41-60", "last_seen_location": "Ramkund Ghat"}]}
    r1 = client.post(f"{API}/sync/push", headers=vol, json=payload).json()["results"][0]
    r2 = client.post(f"{API}/sync/push", headers=vol, json=payload).json()["results"][0]
    check("offline sync is idempotent (no duplicate)", r1["server_id"] == r2["server_id"] and r2["status"] == "updated")

    # geo
    layers = client.get(f"{API}/geo/layers", headers=vol).json()
    check("geo layers loaded (cctv/police/chokepoints/zones)",
          len(layers["cctv"]) > 1000 and len(layers["police_stations"]) >= 10 and len(layers["chokepoints"]) >= 50)
    hot = client.get(f"{API}/geo/hotspots", headers=vol).json()["hotspots"]
    check("hotspots computed", len(hot) > 0, f"top={hot[0]['name']}")
    nh = client.get(f"{API}/geo/nearest-help?lat=20.0067&lng=73.7906", headers=vol).json()
    check("nearest-help routing works", nh["nearest_police_station"] is not None)

    # admin
    m = client.get(f"{API}/admin/metrics", headers=adm).json()
    check("admin metrics (≥2500 cases seeded)", m["totals"]["cases"] >= 2500, str(m["totals"]["cases"]))
    check("admin role gate (volunteer blocked)", client.get(f"{API}/admin/metrics", headers=vol).status_code == 403)


def _make_found_from(missing: dict) -> dict:
    """Build a realistic noisy FOUND report from a real seeded missing case."""
    return {
        "case_type": "found",
        "gender": missing.get("gender"),
        "age_band": missing.get("age_band"),
        "language": missing.get("language") if random.random() < 0.85 else None,
        "state": missing.get("state") if random.random() < 0.6 else None,
        "last_seen_location": missing.get("last_seen_location"),
        "physical_description": "found at desk, " + (missing.get("physical_description") or "elderly person")[:40],
    }


def load(client: httpx.Client, total: int, concurrency: int) -> None:
    print(f"\n── Phase 2: load ({total} requests, {concurrency} concurrent) ──")
    vol = {"Authorization": f"Bearer {login(client, 'volunteer', 'volunteer123')}"}
    pool = client.get(f"{API}/cases?case_type=missing&limit=400", headers=vol).json()
    seeds = [c for c in pool if c.get("gender")]
    if not seeds:
        print("  ⚠ no seed cases; skipping load")
        return

    def one(_i: int):
        body = _make_found_from(random.choice(seeds))
        t0 = time.perf_counter()
        try:
            with httpx.Client(timeout=30) as c:
                r = c.post(f"{API}/cases", headers=vol, json=body)
            ok = r.status_code == 201
            n = len(r.json().get("candidates", [])) if ok else 0
            return (time.perf_counter() - t0) * 1000, ok, n
        except Exception:
            return (time.perf_counter() - t0) * 1000, False, 0

    start = time.perf_counter()
    lat, errors, with_cands = [], 0, 0
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        for ms, ok, n in [f.result() for f in as_completed([ex.submit(one, i) for i in range(total)])]:
            lat.append(ms)
            errors += 0 if ok else 1
            with_cands += 1 if n > 0 else 0
    wall = time.perf_counter() - start
    lat.sort()

    def pct(p):
        return lat[min(len(lat) - 1, int(len(lat) * p))]

    print(f"  requests       : {total}")
    print(f"  errors         : {errors}")
    print(f"  throughput     : {total / wall:.1f} req/s  (wall {wall:.1f}s)")
    print(f"  latency p50    : {pct(0.50):.0f} ms")
    print(f"  latency p95    : {pct(0.95):.0f} ms")
    print(f"  latency p99    : {pct(0.99):.0f} ms")
    print(f"  max latency    : {lat[-1]:.0f} ms")
    print(f"  with matches   : {with_cands}/{total}")
    check("load: zero errors", errors == 0, f"{errors} errors")
    check("load: p95 under 1500 ms", pct(0.95) < 1500, f"{pct(0.95):.0f} ms")


def main() -> None:
    random.seed(7)
    with httpx.Client(timeout=60) as client:
        # wait for server
        for _ in range(60):
            try:
                if client.get(f"{API}/health").status_code == 200:
                    break
            except Exception:
                time.sleep(0.5)
        functional(client)
        load(client, total=int(os.environ.get("LOAD_N", 300)), concurrency=int(os.environ.get("LOAD_C", 24)))
    print(f"\n=== RESULT: {PASS} passed, {FAIL} failed ===")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
