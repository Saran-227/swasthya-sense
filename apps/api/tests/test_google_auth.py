"""
Unit & Integration Tests for Google Authentication & Patient Registration
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
"""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from apps.api.app.main import app
from apps.api.app.config import settings
from apps.api.app.db.session import db_session

client = TestClient(app)


def test_auth_config_endpoint():
    """Verify auth config returns configured Google Client ID and redirect URI."""
    response = client.get("/api/auth/config")
    assert response.status_code == 200
    data = response.json()
    assert data["google_client_id"] == settings.GOOGLE_CLIENT_ID
    assert data["google_redirect_uri"] == settings.GOOGLE_REDIRECT_URI
    assert "accounts.google.com" in data["auth_url"]


@patch("apps.api.app.auth.router.verify_google_id_token")
def test_google_login_new_registration(mock_verify):
    """
    Simulates Google authentication for a new user.
    Verifies that:
    1. A unique patient ID is assigned.
    2. User record is created in SQLite.
    3. Patient record is created in SQLite.
    4. JWT token is issued.
    5. GET /api/auth/me accepts Bearer token and returns patient info.
    """
    mock_sub = "google-test-sub-100200"
    mock_email = "asim.tester@gmail.com"
    mock_name = "Asim Maji"
    mock_picture = "https://lh3.googleusercontent.com/a/test-avatar"

    mock_verify.return_value = {
        "sub": mock_sub,
        "email": mock_email,
        "name": mock_name,
        "picture": mock_picture,
        "email_verified": True,
    }

    # Clean test records if existed
    with db_session() as conn:
        conn.execute("DELETE FROM users WHERE google_id = ? OR email = ?;", (mock_sub, mock_email))
        conn.execute("DELETE FROM patients WHERE email = ?;", (mock_email,))

    # Call /api/auth/google
    response = client.post("/api/auth/google", json={"credential": "mock_valid_google_token"})
    assert response.status_code == 200
    data = response.json()

    assert data["is_new_registration"] is True
    assert "token" in data
    token = data["token"]

    user = data["user"]
    assert user["email"] == mock_email
    assert user["full_name"] == mock_name
    assert user["picture"] == mock_picture
    patient_id = user["patient_id"]
    assert patient_id.startswith("PT-SENSE-")

    patient = data["patient"]
    assert patient["patient_id"] == patient_id
    assert patient["full_name"] == mock_name
    assert patient["email"] == mock_email

    # Verify persistence in database
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE google_id = ?;", (mock_sub,))
        db_user = cursor.fetchone()
        assert db_user is not None
        assert db_user["patient_id"] == patient_id

        cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
        db_patient = cursor.fetchone()
        assert db_patient is not None
        assert db_patient["full_name"] == mock_name

    # Test GET /api/auth/me with Bearer token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["user"]["user_id"] == user["user_id"]
    assert me_data["patient"]["patient_id"] == patient_id

    # Test repeat login returns existing record (not new registration)
    repeat_resp = client.post("/api/auth/google", json={"credential": "mock_valid_google_token"})
    assert repeat_resp.status_code == 200
    repeat_data = repeat_resp.json()
    assert repeat_data["is_new_registration"] is False
    assert repeat_data["user"]["patient_id"] == patient_id
