#!/usr/bin/env python3
"""
Comprehensive Verification Script for Google Auth & Patient Registration Flow
SWASTHYA SENSE - Smart Follow-up. Timely Attention. Better Care.
Tests:
1. Google Auth registration -> Unique Patient ID assignment -> Dual SQLite & MongoDB Atlas storage
2. User session verification (/api/auth/me)
3. Personalized patient data retrieval for dashboard
4. Direct MongoDB Atlas verification
"""

import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from apps.api.app.main import app
from apps.api.app.config import settings
from apps.api.app.db.session import db_session
from apps.api.app.services.mongodb_service import mongodb_service
from apps.api.app.auth.router import create_jwt_token

client = TestClient(app)

def test_full_google_registration_and_dashboard_flow():
    print("=" * 70)
    print("TEST: Google Authentication Registration & Unique Patient ID Assignment")
    print("=" * 70)

    unique_sub = f"google_test_sub_{uuid.uuid4().hex[:8]}"
    test_email = f"test.patient.{uuid.uuid4().hex[:6]}@gmail.com"
    test_name = "Dr. Ananya Sharma"
    test_picture = "https://lh3.googleusercontent.com/a/ACg8ocISamplePic123"

    mock_profile = {
        "sub": unique_sub,
        "email": test_email,
        "name": test_name,
        "picture": test_picture,
        "email_verified": True,
    }

    # 1. Simulate Google Login / Registration
    with patch("apps.api.app.auth.router.verify_google_id_token", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_profile

        resp = client.post("/api/auth/google", json={"credential": "mock_valid_google_credential_jwt"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        token = data["token"]
        user = data["user"]
        patient = data["patient"]
        is_new = data["is_new_registration"]

        print(f"✓ Google Auth Succeeded! is_new_registration={is_new}")
        print(f"✓ User ID: {user['user_id']}")
        print(f"✓ Assigned Unique Patient ID: {user['patient_id']}")
        print(f"✓ Full Name: {user['full_name']}")
        print(f"✓ Email: {user['email']}")
        print(f"✓ Picture: {user['picture']}")

        assert is_new is True, "First login must be flagged as new registration"
        assert user["patient_id"].startswith("PT-SENSE-"), f"Invalid ID format: {user['patient_id']}"
        assert patient["patient_id"] == user["patient_id"], "Patient ID must match between user and patient"
        assert patient["email"] == test_email
        assert patient["profile_picture"] == test_picture

        # 2. Verify in SQLite Database
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE google_id = ?;", (unique_sub,))
            sqlite_user = cursor.fetchone()
            assert sqlite_user is not None, "User not found in SQLite users table!"

            cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (user['patient_id'],))
            sqlite_patient = cursor.fetchone()
            assert sqlite_patient is not None, "Patient not found in SQLite patients table!"
            assert sqlite_patient["email"] == test_email
            assert sqlite_patient["user_id"] == user["user_id"]

        print("✓ Verified user & patient record in SQLite database.")

        # 3. Verify in MongoDB Atlas
        atlas_db = mongodb_service.get_database()
        if atlas_db is not None:
            atlas_patient = atlas_db.patients.find_one({"patientId": user["patient_id"]})
            assert atlas_patient is not None, f"Patient {user['patient_id']} was not synced to MongoDB Atlas!"
            print(f"✓ Verified patient in MongoDB Atlas cluster! Document ID: {atlas_patient.get('_id')}")
            print(f"  • MongoDB patientId: {atlas_patient.get('patientId')}")
            print(f"  • MongoDB email: {atlas_patient.get('email')}")
            print(f"  • MongoDB fullName: {atlas_patient.get('fullName')}")
        else:
            print("⚠ MongoDB Atlas connection skipped (offline or not configured).")

        # 4. Verify /api/auth/me using the issued JWT
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200, f"/api/auth/me failed: {me_resp.text}"
        me_data = me_resp.json()
        assert me_data["user"]["patient_id"] == user["patient_id"]
        assert me_data["patient"]["patient_id"] == user["patient_id"]
        print("✓ Verified /api/auth/me session validation with JWT token.")

        # 5. Verify Dashboard personalized data retrieval
        # In the dashboard, the frontend requests /api/patients/{patient_id} and /api/patients/{patient_id}/reminders
        pat_resp = client.get(f"/api/patients/{user['patient_id']}")
        assert pat_resp.status_code == 200, f"Dashboard patient lookup failed: {pat_resp.text}"
        dash_patient = pat_resp.json()
        assert dash_patient["patient_id"] == user["patient_id"]
        assert dash_patient["full_name"] == test_name
        print(f"✓ Dashboard patient endpoint returned personalized data for {dash_patient['patient_id']}.")

        rem_resp = client.get(f"/api/patients/{user['patient_id']}/reminders")
        assert rem_resp.status_code == 200, f"Dashboard reminders lookup failed: {rem_resp.text}"
        print(f"✓ Dashboard reminders endpoint succeeded for {user['patient_id']}.")

        # 6. Verify repeat login does NOT create duplicate, but updates existing
        resp2 = client.post("/api/auth/google", json={"credential": "mock_valid_google_credential_jwt"})
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["is_new_registration"] is False, "Repeat login should not be marked new"
        assert data2["user"]["patient_id"] == user["patient_id"], "Patient ID must remain stable"
        print("✓ Verified idempotent repeat login preserves same unique Patient ID.")


def test_google_code_exchange_and_get_callback():
    print("\n" + "=" * 70)
    print("TEST: Authorization Code Exchange & Direct Backend GET Callback")
    print("=" * 70)

    unique_sub = f"google_code_sub_{uuid.uuid4().hex[:8]}"
    test_email = f"test.code.{uuid.uuid4().hex[:6]}@gmail.com"
    test_name = "Rajesh Verma"

    mock_profile = {
        "sub": unique_sub,
        "email": test_email,
        "name": test_name,
        "picture": "https://lh3.googleusercontent.com/sample_pic_rajesh",
        "email_verified": True,
    }

    # Test POST /api/auth/google with code & redirect_uri
    with patch("apps.api.app.auth.router.exchange_google_code", new_callable=AsyncMock) as mock_exchange:
        mock_exchange.return_value = mock_profile

        resp = client.post(
            "/api/auth/google",
            json={
                "code": "4/0Abc_Test_Auth_Code_Production_Flow",
                "redirect_uri": "https://swasthya-sense-peach.vercel.app/api/auth/callback/google",
            },
        )
        assert resp.status_code == 200, f"Code exchange failed: {resp.text}"
        data = resp.json()
        assert data["user"]["full_name"] == test_name
        assert data["user"]["patient_id"].startswith("PT-SENSE-")
        print(f"✓ Authorization Code POST exchange verified for {data['user']['patient_id']}")

    # Test GET /api/auth/callback/google?code=... (Backend callback redirect)
    with patch("apps.api.app.auth.router.exchange_google_code", new_callable=AsyncMock) as mock_exchange:
        mock_exchange.return_value = mock_profile

        get_resp = client.get(
            "/api/auth/callback/google?code=4/0Abc_Test_Auth_Code_Production_Flow",
            follow_redirects=False,
        )
        assert get_resp.status_code in (302, 307), f"Expected redirect, got {get_resp.status_code}"
        location = get_resp.headers.get("location", "")
        assert "token=" in location, f"Expected token in redirect location: {location}"
        print(f"✓ Direct GET callback redirect verified: Location contains JWT token")

    print("\n" + "=" * 70)
    print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    test_full_google_registration_and_dashboard_flow()
    test_google_code_exchange_and_get_callback()

