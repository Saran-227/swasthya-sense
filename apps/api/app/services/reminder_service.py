"""
Patient Reminder Service
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Evaluates due follow-ups, enforces consent/opt-in guardrails, formats privacy-safe templates,
and tracks delivery outcomes in the shared SQLite database.
"""

from __future__ import annotations

import uuid
from datetime import datetime, date, timedelta, timezone
from typing import Any, List, Optional

from apps.api.app.config import settings
from apps.api.app.db.session import db_session
from apps.api.app.integrations.telegram.client import telegram_client
from apps.api.app.utils.logger import logger


def get_target_today_str() -> str:
    """Returns today's date formatted as YYYY-MM-DD."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def determine_reminder_type(due_date_str: str, today_str: str | None = None) -> Optional[str]:
    """
    Categorizes the follow-up reminder event based on calendar due date.
    Returns: 'Overdue', 'Due Today', 'Upcoming' (within 2 days), or None.
    """
    if not today_str:
        today_str = get_target_today_str()

    try:
        due_d = datetime.strptime(due_date_str, "%Y-%m-%d").date()
        today_d = datetime.strptime(today_str, "%Y-%m-%d").date()
    except ValueError:
        return None

    delta_days = (due_d - today_d).days

    if delta_days < 0:
        return "Overdue"
    elif delta_days == 0:
        return "Due Today"
    elif 0 < delta_days <= 2:
        return "Upcoming"
    else:
        return None  # Due in > 2 days; no reminder needed today


def build_privacy_safe_message(patient: dict[str, Any], reminder_type: str) -> str:
    """
    Constructs privacy-conscious reminder text.
    Strictly avoids transmitting medical diagnoses, clinical values, or lab results.
    """
    name = patient.get("full_name", "Valued Patient")
    due_date = patient.get("follow_up_due_date", "soon")
    worker = patient.get("assigned_worker") or "your assigned healthcare worker"
    fup_type = patient.get("follow_up_type") or "routine health check-in"

    if reminder_type == "Overdue":
        return (
            f"Hello {name}!\n\n"
            f"This is a <b>SWASTHYA SENSE</b> demo reminder.\n"
            f"Your scheduled {fup_type} appears to be <b>overdue</b> (scheduled for {due_date}).\n\n"
            f"Please contact {worker} to arrange your follow-up check-in.\n\n"
            f"<i>Type /status to review your subscription or /stop to opt out.</i>"
        )
    elif reminder_type == "Due Today":
        return (
            f"Hello {name}!\n\n"
            f"This is a <b>SWASTHYA SENSE</b> demo reminder.\n"
            f"Your scheduled {fup_type} is <b>due today</b> ({due_date}).\n\n"
            f"Please reach out to {worker} if you need assistance or wish to confirm your visit.\n\n"
            f"<i>Type /status to review your subscription or /stop to opt out.</i>"
        )
    else:  # Upcoming
        return (
            f"Hello {name}!\n\n"
            f"This is a <b>SWASTHYA SENSE</b> demo reminder.\n"
            f"Your scheduled {fup_type} is coming up on <b>{due_date}</b>.\n\n"
            f"Please contact {worker} if you need to reschedule or have questions.\n\n"
            f"<i>Type /status to review your subscription or /stop to opt out.</i>"
        )


def check_is_duplicate_reminder(
    patient_id: str,
    reminder_type: str,
    today_str: str | None = None,
) -> bool:
    """Checks whether a reminder of this type has already been sent to this patient today."""
    if not today_str:
        today_str = get_target_today_str()

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT COUNT(*) as cnt
            FROM reminders
            WHERE patient_id = ?
              AND reminder_type = ?
              AND DATE(scheduled_at) = ?
              AND delivery_status IN ('Sent', 'Simulated');
            """,
            (patient_id, reminder_type, today_str),
        )
        return cursor.fetchone()["cnt"] > 0


def fetch_reminder_recipients(today_str: str | None = None) -> list[dict[str, Any]]:
    """
    Queries all patients who are candidates for follow-up reminders.
    Returns candidates annotated with qualification flags.
    """
    if not today_str:
        today_str = get_target_today_str()

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients ORDER BY follow_up_due_date ASC;")
        rows = [dict(r) for r in cursor.fetchall()]

    recipients = []
    for patient in rows:
        r_type = determine_reminder_type(patient["follow_up_due_date"], today_str)
        if not r_type:
            continue

        is_linked = bool(patient.get("telegram_linked") and patient.get("telegram_chat_id"))
        has_consent = bool(patient.get("consent_given"))
        has_opt_in = bool(patient.get("telegram_opt_in"))
        is_duplicate = check_is_duplicate_reminder(patient["patient_id"], r_type, today_str)

        eligible = is_linked and has_consent and has_opt_in and not is_duplicate
        reasons_ineligible = []
        if not is_linked:
            reasons_ineligible.append("Telegram account not linked")
        if not has_consent:
            reasons_ineligible.append("Patient consent not granted")
        if not has_opt_in:
            reasons_ineligible.append("Patient opted out of reminders")
        if is_duplicate:
            reasons_ineligible.append(f"Reminder of type '{r_type}' already sent today")

        recipients.append({
            "patient_id": patient["patient_id"],
            "full_name": patient["full_name"],
            "contact_phone": patient["contact_phone"],
            "follow_up_due_date": patient["follow_up_due_date"],
            "follow_up_type": patient["follow_up_type"],
            "risk_tier": patient["risk_tier"],
            "assigned_worker": patient["assigned_worker"],
            "reminder_type": r_type,
            "telegram_chat_id": patient.get("telegram_chat_id"),
            "telegram_username": patient.get("telegram_username"),
            "eligible": eligible,
            "ineligibility_reasons": reasons_ineligible,
        })

    return recipients


async def dispatch_single_reminder(
    patient: dict[str, Any],
    reminder_type: str,
    dry_run: bool | None = None,
) -> dict[str, Any]:
    """
    Delivers a reminder for a single patient and records outcome in the shared database.
    Statuses: 'Sent', 'Simulated', 'Failed'.
    """
    patient_id = patient["patient_id"]
    chat_id = patient.get("telegram_chat_id")
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    today_str = now_utc.strftime("%Y-%m-%d")

    # Safety checks
    if not patient.get("consent_given"):
        raise ValueError(f"Cannot dispatch reminder to {patient_id}: Consent not granted.")
    if not patient.get("telegram_opt_in"):
        raise ValueError(f"Cannot dispatch reminder to {patient_id}: Patient has opted out.")
    if not patient.get("telegram_linked") or not chat_id:
        raise ValueError(f"Cannot dispatch reminder to {patient_id}: Telegram not linked.")
    if check_is_duplicate_reminder(patient_id, reminder_type, today_str):
        raise ValueError(f"Duplicate reminder detected for patient {patient_id} today.")

    message_text = build_privacy_safe_message(patient, reminder_type)
    reminder_id = f"REM-{now_utc.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    # Determine delivery status
    effective_dry_run = dry_run if dry_run is not None else settings.TELEGRAM_DRY_RUN
    delivery_status = "Pending"
    telegram_msg_id = None
    error_message = None

    try:
        resp = await telegram_client.send_message(
            chat_id=chat_id,
            text=message_text,
            dry_run=effective_dry_run,
        )
        is_sim = resp.get("simulated", False) or effective_dry_run
        delivery_status = "Simulated" if is_sim else "Sent"
        telegram_msg_id = str(resp.get("result", {}).get("message_id", "simulated"))
    except Exception as e:
        delivery_status = "Failed"
        error_message = str(e)
        logger.error(f"Failed to dispatch reminder to patient {patient_id}: {e}", exc_info=True)

    # Persist record in shared reminders table
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO reminders (
                reminder_id, patient_id, channel, reminder_type, message_summary,
                scheduled_at, sent_at, delivery_status, telegram_message_id, error_message, created_at
            ) VALUES (?, ?, 'Telegram', ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                reminder_id,
                patient_id,
                reminder_type,
                f"SWASTHYA SENSE {reminder_type} reminder for {patient.get('follow_up_type', 'check-in')}",
                now_iso,
                now_iso if delivery_status in ("Sent", "Simulated") else None,
                delivery_status,
                telegram_msg_id,
                error_message,
                now_iso,
            ),
        )

    logger.info(
        f"Reminder {reminder_id} ({reminder_type}) logged for {patient_id} | Status: {delivery_status}"
    )

    return {
        "reminder_id": reminder_id,
        "patient_id": patient_id,
        "patient_name": patient.get("full_name"),
        "channel": "Telegram",
        "reminder_type": reminder_type,
        "delivery_status": delivery_status,
        "telegram_message_id": telegram_msg_id,
        "sent_at": now_iso if delivery_status in ("Sent", "Simulated") else None,
        "error_message": error_message,
    }


async def execute_daily_reminder_sweep(dry_run: bool | None = None) -> dict[str, Any]:
    """
    Processes all eligible patients due for reminders today.
    Called by the daily scheduler or manual test triggers.
    """
    candidates = fetch_reminder_recipients()
    eligible_candidates = [c for c in candidates if c["eligible"]]

    results = []
    with db_session() as conn:
        cursor = conn.cursor()
        for cand in eligible_candidates:
            cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (cand["patient_id"],))
            row = cursor.fetchone()
            if not row:
                continue
            patient_record = dict(row)

            try:
                res = await dispatch_single_reminder(
                    patient=patient_record,
                    reminder_type=cand["reminder_type"],
                    dry_run=dry_run,
                )
                results.append(res)
            except Exception as e:
                logger.error(f"Error processing reminder for {cand['patient_id']}: {e}")
                results.append({
                    "patient_id": cand["patient_id"],
                    "delivery_status": "Failed",
                    "error_message": str(e),
                })

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_evaluated": len(candidates),
        "eligible_count": len(eligible_candidates),
        "reminders_dispatched": len(results),
        "results": results,
    }


def get_patient_reminder_history(patient_id: str) -> list[dict[str, Any]]:
    """Retrieves all reminder records for a given patient from the shared database."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT reminder_id, patient_id, channel, reminder_type, message_summary,
                   scheduled_at, sent_at, delivery_status, telegram_message_id, error_message, created_at
            FROM reminders
            WHERE patient_id = ?
            ORDER BY scheduled_at DESC;
            """,
            (patient_id,),
        )
        return [dict(r) for r in cursor.fetchall()]
