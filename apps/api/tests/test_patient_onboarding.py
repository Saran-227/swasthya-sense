"""
Unit & Integration Tests for Patient Onboarding, Profiles, Consent, and Preferences
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Tests for Asim's onboarding experience and shared backend integration.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from apps.api.app.config import settings
from apps.api.app.db.session import db_session, reset_synthetic_cohort
from apps.api.app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db():
    """Ensure clean synthetic cohort state before each test."""
    reset_synthetic_cohort()
    yield


def test_list_synthetic_patients():
    """Test retrieving list of seeded synthetic patients."""
    response = client.get("/api/patients")
    assert response.status_code == 200
    patients = response.json()
    assert len(patients) >= 6
    ids = [p["patient_id"] for p in patients]
    assert "PT-SENSE-101" in ids  # Ramesh Kumar (Unlinked)
    assert "PT-SENSE-102" in ids  # Priya Sharma (Linked)


def test_patient_registration_full_flow():
    """Test registering a new patient with complete onboarding data."""
    now_str = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
    payload = {
        "full_name": "Aarav Gupta",
        "age": 52,
        "gender": "Male",
        "contact_phone": "+91 91234 56789",
        "condition_summary": "Type-2 Diabetes & Hypertension; Post-CABG recovery.",
        "risk_tier": "Moderate",
        "assigned_worker": "Nurse Sunita Sharma",
        "consent_given": True,
        "follow_up_due_date": now_str,
        "follow_up_type": "Cardiology Post-CABG Follow-up",
        "telegram_opt_in": True,
        "reminder_window": "09:00 AM",
        "notify_upcoming": True,
        "notify_overdue": True,
    }

    response = client.post("/api/patients", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["patient_id"].startswith("PT-SENSE-")
    assert created["full_name"] == "Aarav Gupta"
    assert created["age"] == 52
    assert created["consent_given"] is True
    assert created["consent_updated_at"] is not None
    assert created["telegram_linked"] is False

    # Verify patient can be fetched
    fetch_resp = client.get(f"/api/patients/{created['patient_id']}")
    assert fetch_resp.status_code == 200
    assert fetch_resp.json()["full_name"] == "Aarav Gupta"


def test_patient_registration_validation():
    """Test that invalid registration payloads are rejected with 422."""
    # Missing full_name and invalid age
    response = client.post("/api/patients", json={"age": -5, "gender": "Male"})
    assert response.status_code == 422


def test_patient_profile_update_and_consent():
    """Test updating demographic details and toggling consent."""
    patient_id = "PT-SENSE-101"

    # Initially consent_given is True
    update_payload = {
        "contact_phone": "+91 99999 00000",
        "condition_summary": "Updated clinical summary: stent stable.",
        "consent_given": False,
    }
    response = client.put(f"/api/patients/{patient_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["contact_phone"] == "+91 99999 00000"
    assert data["condition_summary"] == "Updated clinical summary: stent stable."
    assert data["consent_given"] is False
    assert data["consent_updated_at"] is not None


def test_telegram_preferences_persistence():
    """Test updating and persisting reminder preferences."""
    patient_id = "PT-SENSE-102"
    pref_payload = {
        "patient_id": patient_id,
        "telegram_opt_in": False,
        "reminder_window": "02:00 PM",
        "notify_upcoming": False,
        "notify_overdue": True,
    }
    response = client.post("/api/integrations/telegram/preferences", json=pref_payload)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["telegram_opt_in"] is False
    assert response.json()["reminder_window"] == "02:00 PM"

    # Verify reflected in patient record
    patient = client.get(f"/api/patients/{patient_id}").json()
    assert patient["telegram_opt_in"] is False
    assert patient["reminder_window"] == "02:00 PM"


def test_patient_login_lookup():
    """Test logging in / looking up patient by ID or phone number."""
    # Look up by exact patient_id
    resp = client.post("/api/patients/login", json={"query": "PT-SENSE-101"})
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Ramesh Kumar"

    # Look up by phone digits
    resp_phone = client.post("/api/patients/login", json={"query": "9812345678"})
    assert resp_phone.status_code == 200
    assert resp_phone.json()["patient_id"] == "PT-SENSE-102"

    # Non-existent query
    resp_404 = client.post("/api/patients/login", json={"query": "NON_EXISTENT_ID"})
    assert resp_404.status_code == 404


def test_reset_demo_cohort():
    """Test reset-demo endpoint re-initializes patients and history."""
    # First add a custom patient
    client.post(
        "/api/patients",
        json={
            "full_name": "Temporary Patient",
            "age": 40,
            "gender": "Other",
            "follow_up_due_date": "2026-11-10",
        },
    )
    # Call reset
    resp = client.post("/api/patients/reset-demo")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Check patients count is back to 6
    patients = client.get("/api/patients").json()
    assert len(patients) == 6


def test_telegram_link_token_and_verification_flow():
    """Test the complete linking lifecycle from link-token to status."""
    patient_id = "PT-SENSE-101"

    # 1. Check initially unlinked
    status_resp = client.get(f"/api/integrations/telegram/status?patient_id={patient_id}")
    assert status_resp.status_code == 200
    assert status_resp.json()["is_linked"] is False

    # 2. Request linking token
    token_resp = client.post("/api/integrations/telegram/link-token", json={"patient_id": patient_id})
    assert token_resp.status_code == 200
    token_data = token_resp.json()
    token = token_data["token"]
    assert "t.me" in token_data["deep_link"]
    assert token in token_data["deep_link"]

    # 3. Simulate bot linking redemption
    link_resp = client.post(
        "/api/integrations/telegram/link",
        json={"token": token, "chat_id": 99887766, "username": "ramesh_kumar_tg"},
    )
    assert link_resp.status_code == 200
    assert link_resp.json()["success"] is True

    # 4. Status should now be linked
    status_after = client.get(f"/api/integrations/telegram/status?patient_id={patient_id}")
    assert status_after.status_code == 200
    after_data = status_after.json()
    assert after_data["is_linked"] is True
    assert after_data["telegram_username"] == "ramesh_kumar_tg"
    assert after_data["telegram_chat_id"] == 99887766

    # 5. Unlink account
    unlink_resp = client.post("/api/integrations/telegram/unlink", json={"patient_id": patient_id})
    assert unlink_resp.status_code == 200

    # 6. Status should be unlinked again
    status_final = client.get(f"/api/integrations/telegram/status?patient_id={patient_id}")
    assert status_final.json()["is_linked"] is False
