"""API-level tests: auth, intake->match, sync idempotency, verify, privacy."""


def test_health(client):
    assert client.get("/api/v1/health").json()["status"] == "ok"


def test_login_bad_password(client):
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_auth_required(client):
    assert client.get("/api/v1/cases").status_code == 401


def _missing(name="Lakshmi Bai", **kw):
    base = {
        "case_type": "missing", "person_name": name, "gender": "Female", "age_band": "61-70",
        "state": "Maharashtra", "language": "Marathi", "last_seen_location": "Ramkund Ghat",
        "physical_description": "old woman in white saree, walking stick", "reporter_mobile": "+91 9876543210",
    }
    base.update(kw)
    return base


def test_create_match_and_reunite(client, vol_headers):
    # File a MISSING report.
    m = client.post("/api/v1/cases", json=_missing(), headers=vol_headers).json()
    missing_id = m["query_case_id"]
    # A FOUND report of (plausibly) the same person at another center, no name.
    found_payload = {
        "case_type": "found", "gender": "Female", "age_band": "61-70", "language": "Marathi",
        "last_seen_location": "Panchavati Circle",
        "physical_description": "elderly lady, safed saree, lathi", "reporting_center": "Found Desk",
    }
    f = client.post("/api/v1/cases", json=found_payload, headers=vol_headers).json()
    found_id = f["query_case_id"]
    # The found query should surface the missing case as a candidate.
    ids = [c["case"]["id"] for c in f["candidates"]]
    assert missing_id in ids
    # Confirm the match -> both become Reunited.
    d = client.post("/api/v1/matches/decide", json={
        "missing_case_id": missing_id, "found_case_id": found_id, "decision": "confirm"
    }, headers=vol_headers)
    assert d.json()["status"] == "confirmed"
    assert client.get(f"/api/v1/cases/{missing_id}", headers=vol_headers).json()["status"] == "Reunited"


def test_mobile_is_masked_never_clear(client, vol_headers):
    m = client.post("/api/v1/cases", json=_missing(name="Test Mask"), headers=vol_headers).json()
    case = client.get(f"/api/v1/cases/{m['query_case_id']}", headers=vol_headers).json()
    assert case["reporter_mobile_masked"] == "98xxxx10"
    # The clear number must not appear anywhere in the serialized case.
    assert "9876543210" not in str(case)


def test_sync_push_is_idempotent(client, vol_headers):
    payload = {"cases": [{
        "client_uuid": "fixed-uuid-123", "case_type": "missing", "person_name": "Sync Test",
        "gender": "Male", "age_band": "41-60", "last_seen_location": "Ramkund Ghat",
    }]}
    r1 = client.post("/api/v1/sync/push", json=payload, headers=vol_headers).json()
    r2 = client.post("/api/v1/sync/push", json=payload, headers=vol_headers).json()
    assert r1["results"][0]["server_id"] == r2["results"][0]["server_id"]  # same record
    assert r2["results"][0]["status"] == "updated"  # not a duplicate create


def test_verify_secret(client, vol_headers):
    payload = _missing(name="Secret Kid", case_type="found", age_band="0-12",
                       secret_question="Pet name?", secret_answer="Chintu")
    f = client.post("/api/v1/cases", json=payload, headers=vol_headers).json()
    cid = f["query_case_id"]
    assert client.post(f"/api/v1/cases/{cid}/verify", json={"answer": "chintu"}, headers=vol_headers).json()["verified"] is True
    assert client.post(f"/api/v1/cases/{cid}/verify", json={"answer": "wrong"}, headers=vol_headers).json()["verified"] is False


def test_refine_updates_case_and_rematches(client, vol_headers):
    f = client.post("/api/v1/cases", json={
        "case_type": "found", "gender": "Female", "age_band": "61-70", "last_seen_location": "Ramkund Ghat",
        "physical_description": "elderly lady",
    }, headers=vol_headers).json()
    cid = f["query_case_id"]
    r = client.post(f"/api/v1/cases/{cid}/refine", json={"language": "Marathi", "add_stable": "walking_stick"}, headers=vol_headers)
    assert r.status_code == 200
    assert "candidates" in r.json()
    case = client.get(f"/api/v1/cases/{cid}", headers=vol_headers).json()
    assert case["language"] == "Marathi"
    assert "walking_stick" in case["normalized"].get("stable", [])


def test_intake_parse_text(client, vol_headers):
    r = client.post("/api/v1/intake/parse", json={
        "transcript": "ek lady hai, white saree pehni hai, walking stick hai", "case_type": "found"
    }, headers=vol_headers).json()
    draft = r["draft"]
    assert draft["gender"] == "Female"
    assert "white" in draft["colors"]
    assert "walking_stick" in draft["stable"]
