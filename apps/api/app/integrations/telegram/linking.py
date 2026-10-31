"""
Telegram Account Linking Service
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Implements secure, single-use, time-bounded deep linking between synthetic patients
and personal Telegram chat IDs.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from apps.api.app.config import settings
from apps.api.app.db.session import db_session
from apps.api.app.utils.logger import logger


class LinkingError(Exception):
    """Base exception for account linking errors."""
    pass


class TokenNotFoundError(LinkingError):
    pass


class TokenExpiredError(LinkingError):
    pass


class TokenAlreadyUsedError(LinkingError):
    pass


class AccountConflictError(LinkingError):
    pass


def create_linking_token(patient_id: str) -> dict[str, Any]:
    """
    Generates a secure, single-use linking token for a synthetic patient record.
    Returns token, expiry timestamp, and Telegram bot deep link.
    """
    with db_session() as conn:
        cursor = conn.cursor()

        # 1. Verify patient exists
        cursor.execute("SELECT patient_id, full_name FROM patients WHERE patient_id = ?;", (patient_id,))
        patient = cursor.fetchone()
        if not patient:
            raise LinkingError(f"Patient ID '{patient_id}' not found in registry.")

        # 2. Invalidate prior unused tokens for this patient to maintain single active token
        now_utc = datetime.now(timezone.utc)
        iso_now = now_utc.isoformat()
        cursor.execute(
            "UPDATE linking_tokens SET used = 1, used_at = ? WHERE patient_id = ? AND used = 0;",
            (iso_now, patient_id),
        )

        # 3. Generate token & expiry
        token = secrets.token_urlsafe(16)
        expires_at = (now_utc + timedelta(minutes=settings.LINKING_TOKEN_EXPIRE_MINUTES)).isoformat()

        cursor.execute(
            """
            INSERT INTO linking_tokens (token, patient_id, created_at, expires_at, used)
            VALUES (?, ?, ?, ?, 0);
            """,
            (token, patient_id, iso_now, expires_at),
        )

    deep_link = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start=link_{token}"
    logger.info(f"Generated linking token for patient {patient_id}. Expires: {expires_at}")

    return {
        "patient_id": patient_id,
        "patient_name": patient["full_name"],
        "token": token,
        "expires_at": expires_at,
        "deep_link": deep_link,
        "bot_username": settings.TELEGRAM_BOT_USERNAME,
    }


def redeem_linking_token(
    token: str,
    chat_id: int,
    username: str | None = None,
) -> dict[str, Any]:
    """
    Validates token and associates Telegram chat_id and username with the patient.
    Enforces expiration, single-use, and prevents silent switching of accounts.
    """
    with db_session() as conn:
        cursor = conn.cursor()

        # 1. Lookup token
        cursor.execute(
            "SELECT token, patient_id, created_at, expires_at, used FROM linking_tokens WHERE token = ?;",
            (token,),
        )
        record = cursor.fetchone()
        if not record:
            raise TokenNotFoundError("Invalid or unrecognized linking token.")

        if record["used"]:
            raise TokenAlreadyUsedError("This linking token has already been redeemed.")

        now_utc = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(record["expires_at"])
        if now_utc > expires_at:
            raise TokenExpiredError("This linking token has expired. Please generate a new link.")

        target_patient_id = record["patient_id"]

        # 2. Prevent silent account switching: check if this chat_id is already linked to another patient
        cursor.execute(
            "SELECT patient_id, full_name FROM patients WHERE telegram_chat_id = ? AND patient_id != ? AND telegram_linked = 1;",
            (chat_id, target_patient_id),
        )
        existing = cursor.fetchone()
        if existing:
            raise AccountConflictError(
                f"This Telegram account is already linked to patient {existing['full_name']} ({existing['patient_id']}). "
                "Please disconnect the previous profile first."
            )

        # 3. Mark token as consumed
        iso_now = now_utc.isoformat()
        cursor.execute(
            "UPDATE linking_tokens SET used = 1, used_at = ? WHERE token = ?;",
            (iso_now, token),
        )

        # 4. Associate Telegram account with target patient
        cursor.execute(
            """
            UPDATE patients
            SET telegram_chat_id = ?,
                telegram_username = ?,
                telegram_linked = 1,
                telegram_linked_at = ?,
                telegram_opt_in = 1,
                updated_at = ?
            WHERE patient_id = ?;
            """,
            (chat_id, username, iso_now, iso_now, target_patient_id),
        )

        # Fetch updated record
        cursor.execute(
            """
            SELECT patient_id, full_name, telegram_chat_id, telegram_username,
                   telegram_linked, telegram_linked_at, telegram_opt_in
            FROM patients
            WHERE patient_id = ?;
            """,
            (target_patient_id,),
        )
        updated_patient = dict(cursor.fetchone())

    logger.info(
        f"Successfully linked Telegram chat_id {chat_id} (@{username}) to patient {target_patient_id} ({updated_patient['full_name']})"
    )

    return {
        "success": True,
        "message": f"Telegram account linked successfully to patient {updated_patient['full_name']}.",
        "patient": updated_patient,
    }


def unlink_telegram_account(patient_id: str) -> dict[str, Any]:
    """Disconnects a Telegram account from a patient record."""
    with db_session() as conn:
        cursor = conn.cursor()
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            UPDATE patients
            SET telegram_linked = 0,
                telegram_chat_id = NULL,
                telegram_username = NULL,
                telegram_linked_at = NULL,
                updated_at = ?
            WHERE patient_id = ?;
            """,
            (now_iso, patient_id),
        )
        if cursor.rowcount == 0:
            raise LinkingError(f"Patient ID '{patient_id}' not found.")

    return {"success": True, "patient_id": patient_id, "message": "Telegram account disconnected."}


def set_telegram_opt_in(chat_id: int, opt_in: bool) -> dict[str, Any]:
    """Updates Telegram reminder opt-in status for all patients associated with chat_id."""
    with db_session() as conn:
        cursor = conn.cursor()
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            UPDATE patients
            SET telegram_opt_in = ?,
                updated_at = ?
            WHERE telegram_chat_id = ?;
            """,
            (1 if opt_in else 0, now_iso, chat_id),
        )
        count = cursor.rowcount

    return {"success": True, "chat_id": chat_id, "opt_in": opt_in, "affected_patients": count}


def get_patient_by_chat_id(chat_id: int) -> Optional[dict[str, Any]]:
    """Retrieves patient associated with Telegram chat_id if linked."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT patient_id, full_name, telegram_chat_id, telegram_username,
                   telegram_linked, telegram_linked_at, telegram_opt_in, follow_up_due_date,
                   assigned_worker, risk_tier
            FROM patients
            WHERE telegram_chat_id = ? AND telegram_linked = 1;
            """,
            (chat_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
