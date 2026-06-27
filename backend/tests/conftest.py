import os
import tempfile

# Isolated DB + no heavy sample seed, before app import (engine binds at import).
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_tmp, 'test.db')}"
os.environ["SEED_ON_STARTUP"] = "true"
os.environ["SEED_SAMPLE_CASES"] = "false"
os.environ["LLM_PROVIDER"] = "none"
os.environ["VOICE_PROVIDER"] = "none"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def vol_headers(client):
    r = client.post("/api/v1/auth/login", json={"username": "volunteer", "password": "volunteer123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin_headers(client):
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
