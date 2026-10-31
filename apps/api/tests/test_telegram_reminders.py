"""
Automated Test Suite for Telegram Bot, Account Linking, and Reminder Delivery
SWASTHYA SENSE - Problem 2: Early Warning and Follow-up for High-Risk Patients
Validates all 15 test scenarios mandated by the project specification.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from apps.api.app.config import settings
from apps.api.app.db.session import db_session, init_db
from apps.api.app.integrations.telegram.client import telegram_client
from apps.api.app.integrations.telegram.handlers import (
    handle_help_command,
    handle_start_command,
    handle_status_command,
    handle_stop_command,
)
from apps.api.app.integrations.telegram.linking import (
    AccountConflictError,
    TokenAlreadyUsedError,
    TokenExpiredError,
    TokenNotFoundError,
    create_linking_token,
    redeem_linking_token,
)
from apps.api.app.main import app
from apps.api.app.services.reminder_scheduler import reminder_scheduler
from apps.api.app.services.reminder_service import (
    check_is_duplicate_reminder,
    determine_reminder_type,
    dispatch_single_reminder,
    execute_daily_reminder_sweep,
    fetch_reminder_recipients,
    get_patient_reminder_history,
)


@pytest.fixture(autouse=True, scope="module")
def setup_database_and_client():
    """Initializes shared SQLite database and test client."""
    init_db()
    with db_session() as conn:
        cursor = conn.cursor()
        # Clean up any test-specific reminder dispatches for clean testing
        cursor.execute("DELETE FROM reminders WHERE reminder_id LIKE 'REM-TEST-%' OR reminder_id LIKE 'REM-2026%';")
    with TestClient(app) as test_client:
        yield test_client


# ==============================================================================
# 1. Bot Connection & Startup
# ==============================================================================

def test_bot_connection_and_get_me():
    """Verify bot client connects and returns valid identity in simulation or live mode."""
    me = asyncio.run(telegram_client.get_me())
    assert me["ok"] is True
    assert "result" in me
    assert me["result"]["is_bot"] is True
    assert me["result"]["username"] == settings.TELEGRAM_BOT_USERNAME


# ==============================================================================
# 2. Bot Commands: /start, /help, /status, /stop
# ==============================================================================

def test_start_command_without_token():
    """User opens bot directly without token -> receives welcome & instructions."""
    reply = asyncio.run(handle_start_command(chat_id=8881001, args="", first_name="Ravi"))
    assert "SWASTHYA SENSE" in reply
    assert "Connect Telegram" in reply
    assert "/help" in reply


def test_help_command():
    """User requests help -> receives command list and clinical privacy assurance."""
    reply = asyncio.run(handle_help_command(chat_id=8881001))
    assert "/start" in reply
    assert "/status" in reply
    assert "/stop" in reply
    assert "Privacy Notice" in reply
    assert "never transmit sensitive medical diagnoses" in reply


def test_status_command_unlinked():
    """Unlinked user checks status -> correctly reports Not Linked."""
    reply = asyncio.run(handle_status_command(chat_id=9990001))
    assert "Account Status: Not Linked" in reply


def test_stop_command_opt_out():
    """User sends /stop -> opts out of automated reminders."""
    # First link to a test patient
    token_data = create_linking_token("PT-SENSE-101")
    redeem_linking_token(token_data["token"], chat_id=7770001, username="test_optout")

    # Now call /stop
    reply = asyncio.run(handle_stop_command(chat_id=7770001))
    assert "Reminders Paused" in reply
    assert "opted out" in reply

    # Verify status reflects paused opt-in
    status_reply = asyncio.run(handle_status_command(chat_id=7770001))
    assert "Opted Out" in status_reply


# ==============================================================================
# 3. Account Linking: Valid, Expired, Already Used, Conflict
# ==============================================================================

def test_valid_linking_token_flow():
    """Generate token -> redeem with chat_id -> verify patient profile updated."""
    token_info = create_linking_token("PT-SENSE-101")
    assert token_info["patient_id"] == "PT-SENSE-101"
    assert token_info["token"]
    assert "https://t.me/" in token_info["deep_link"]

    redeem_result = redeem_linking_token(
        token=token_info["token"],
        chat_id=5551234,
        username="ramesh_kumar_telegram",
    )
    assert redeem_result["success"] is True
    assert redeem_result["patient"]["telegram_linked"] == 1
    assert redeem_result["patient"]["telegram_chat_id"] == 5551234
    assert redeem_result["patient"]["telegram_username"] == "ramesh_kumar_telegram"


def test_token_single_use_enforcement():
    """Attempting to redeem the same token twice must fail with TokenAlreadyUsedError."""
    token_info = create_linking_token("PT-SENSE-101")
    redeem_linking_token(token_info["token"], chat_id=5551234)

    with pytest.raises(TokenAlreadyUsedError):
        redeem_linking_token(token_info["token"], chat_id=5551234)


def test_expired_token_rejection():
    """Attempting to redeem an expired token must fail with TokenExpiredError."""
    token_info = create_linking_token("PT-SENSE-101")
    # Manually expire the token in database
    with db_session() as conn:
        cursor = conn.cursor()
        past_iso = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        cursor.execute("UPDATE linking_tokens SET expires_at = ? WHERE token = ?;", (past_iso, token_info["token"]))

    with pytest.raises(TokenExpiredError):
        redeem_linking_token(token_info["token"], chat_id=6667778)


def test_account_conflict_prevention():
    """An already-linked Telegram chat_id cannot silently switch to another patient."""
    token_patient1 = create_linking_token("PT-SENSE-101")
    redeem_linking_token(token_patient1["token"], chat_id=9998881)

    token_patient2 = create_linking_token("PT-SENSE-106")
    with pytest.raises(AccountConflictError):
        redeem_linking_token(token_patient2["token"], chat_id=9998881)


# ==============================================================================
# 4. Reminder Timing & Categorization
# ==============================================================================

def test_determine_reminder_type():
    """Test calendar categorization: Overdue, Due Today, Upcoming, and Future."""
    today = "2026-11-01"
    assert determine_reminder_type("2026-10-29", today) == "Overdue"
    assert determine_reminder_type("2026-11-01", today) == "Due Today"
    assert determine_reminder_type("2026-11-03", today) == "Upcoming"
    assert determine_reminder_type("2026-11-15", today) is None


# ==============================================================================
# 5. Consent & Opt-In Verification
# ==============================================================================

def test_consent_and_opt_in_filtering():
    """Verify that unconsented or opted-out patients are flagged ineligible."""
    with db_session() as conn:
        conn.execute("UPDATE patients SET consent_given = 0 WHERE patient_id = 'PT-SENSE-105'")
        conn.execute("UPDATE patients SET telegram_opt_in = 0 WHERE patient_id = 'PT-SENSE-104'")

    recipients = fetch_reminder_recipients()
    pt_no_consent = next((r for r in recipients if r["patient_id"] == "PT-SENSE-105"), None)
    if pt_no_consent:
        assert pt_no_consent["eligible"] is False
        assert any("consent" in reason.lower() for reason in pt_no_consent["ineligibility_reasons"])

    pt_opted_out = next((r for r in recipients if r["patient_id"] == "PT-SENSE-104"), None)
    if pt_opted_out:
        assert pt_opted_out["eligible"] is False
        assert any("opted out" in reason.lower() for reason in pt_opted_out["ineligibility_reasons"])


# ==============================================================================
# 6. Reminder Delivery & History Tracking
# ==============================================================================

def test_dispatch_single_reminder_and_history():
    """Dispatch a reminder to a linked patient and verify it appears in patient reminder history."""
    patient = {
        "patient_id": "PT-SENSE-102",
        "full_name": "Priya Sharma",
        "follow_up_due_date": "2026-10-29",
        "follow_up_type": "Antenatal High-Risk Check-up",
        "assigned_worker": "ANM Anita Verma",
        "consent_given": 1,
        "telegram_opt_in": 1,
        "telegram_linked": 1,
        "telegram_chat_id": 100200301,
    }

    result = asyncio.run(dispatch_single_reminder(patient=patient, reminder_type="Overdue", dry_run=True))
    assert result["delivery_status"] in ("Sent", "Simulated")
    assert result["channel"] == "Telegram"
    assert result["reminder_id"].startswith("REM-")

    # Fetch history via database service
    history = get_patient_reminder_history("PT-SENSE-102")
    assert len(history) >= 1
    recent = history[0]
    assert recent["patient_id"] == "PT-SENSE-102"
    assert recent["delivery_status"] in ("Sent", "Simulated")


# ==============================================================================
# 7. Duplicate Reminder Prevention
# ==============================================================================

def test_duplicate_reminder_prevention():
    """Sending the same reminder twice on the same day must raise ValueError."""
    patient = {
        "patient_id": "PT-SENSE-103",
        "full_name": "Anil Verma",
        "follow_up_due_date": "2026-11-03",
        "follow_up_type": "Chronic Care Review",
        "assigned_worker": "Health Worker Rajesh",
        "consent_given": 1,
        "telegram_opt_in": 1,
        "telegram_linked": 1,
        "telegram_chat_id": 100200302,
    }

    # First dispatch succeeds
    res1 = asyncio.run(dispatch_single_reminder(patient=patient, reminder_type="Upcoming", dry_run=True))
    assert res1["delivery_status"] in ("Sent", "Simulated")

    # Immediate second dispatch must be rejected as duplicate
    with pytest.raises(ValueError, match="Duplicate reminder detected"):
        asyncio.run(dispatch_single_reminder(patient=patient, reminder_type="Upcoming", dry_run=True))


# ==============================================================================
# 8. Daily Sweep Execution
# ==============================================================================

def test_daily_reminder_sweep_execution():
    """Run daily sweep -> verifies summary counters and non-crash execution."""
    sweep = asyncio.run(execute_daily_reminder_sweep(dry_run=True))
    assert "total_evaluated" in sweep
    assert "eligible_count" in sweep
    assert "reminders_dispatched" in sweep


# ==============================================================================
# 9. Scheduler Status & Timezone Handling
# ==============================================================================

def test_scheduler_status_and_timezone():
    """Verify scheduler reports configured Asia/Kolkata timezone and running state."""
    status_info = reminder_scheduler.get_status()
    assert "is_running" in status_info
    assert status_info["timezone"] == "Asia/Kolkata"
    assert ":" in status_info["scheduled_time"]


# ==============================================================================
# 10. API Endpoints Integration (HTTP Layer)
# ==============================================================================

def test_api_patients_and_reminders_endpoints(setup_database_and_client):
    """Test HTTP API contract shared with Asim."""
    client = setup_database_and_client

    # List patients
    res_patients = client.get("/api/patients")
    assert res_patients.status_code == 200
    patients = res_patients.json()
    assert len(patients) >= 6
    assert any(p["patient_id"] == "PT-SENSE-101" for p in patients)

    # Generate link token via API
    res_token = client.post("/api/integrations/telegram/link-token", json={"patient_id": "PT-SENSE-101"})
    assert res_token.status_code == 200
    data = res_token.json()
    assert "token" in data
    assert "deep_link" in data

    # Check status endpoint
    res_status = client.get(f"/api/integrations/telegram/status?patient_id=PT-SENSE-102")
    assert res_status.status_code == 200
    assert res_status.json()["is_linked"] is True

    # Check reminder history endpoint (for Asim's UI)
    res_history = client.get("/api/patients/PT-SENSE-102/reminders")
    assert res_history.status_code == 200
    assert isinstance(res_history.json(), list)

    # Check scheduler status
    res_sched = client.get("/api/internal/scheduler/status")
    assert res_sched.status_code == 200
    assert res_sched.json()["timezone"] == "Asia/Kolkata"
