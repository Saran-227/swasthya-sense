"""
FastAPI Router for Telegram Bot, Account Linking, and Reminder Tracking
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Implements shared endpoints co-designed with Asim for patient profiles and reminders.
"""

from __future__ import annotations

from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request, status

from apps.api.app.config import settings
from apps.api.app.db.session import db_session
from apps.api.app.integrations.telegram.bot import bot_service
from apps.api.app.integrations.telegram.client import telegram_client
from apps.api.app.integrations.telegram.linking import (
    AccountConflictError,
    LinkingError,
    TokenAlreadyUsedError,
    TokenExpiredError,
    TokenNotFoundError,
    create_linking_token,
    get_patient_by_chat_id,
    redeem_linking_token,
    unlink_telegram_account,
)
from apps.api.app.schemas.telegram import (
    CreateLinkingTokenRequest,
    CreateLinkingTokenResponse,
    PatientSummarySchema,
    RedeemTokenRequest,
    ReminderRecordSchema,
    TelegramStatusResponse,
    TriggerReminderRequest,
    UnlinkAccountRequest,
)
from apps.api.app.services.reminder_scheduler import reminder_scheduler
from apps.api.app.services.reminder_service import (
    dispatch_single_reminder,
    execute_daily_reminder_sweep,
    fetch_reminder_recipients,
    get_patient_reminder_history,
)
from apps.api.app.utils.logger import logger


telegram_router = APIRouter(tags=["Telegram & Follow-up Reminders"])


# ==============================================================================
# Telegram Account Linking Endpoints
# ==============================================================================

@telegram_router.post(
    "/integrations/telegram/link-token",
    response_model=CreateLinkingTokenResponse,
    summary="Generate Single-Use Telegram Account Linking Token",
)
def api_generate_linking_token(req: CreateLinkingTokenRequest) -> CreateLinkingTokenResponse:
    """Generates a secure, expiring token and deep link for patient profile."""
    try:
        data = create_linking_token(req.patient_id)
        return CreateLinkingTokenResponse(**data)
    except LinkingError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@telegram_router.post(
    "/integrations/telegram/link",
    summary="Validate Linking Token & Associate Telegram Account",
)
def api_redeem_token(req: RedeemTokenRequest) -> dict[str, Any]:
    """Validates linking token and associates chat_id with the patient record."""
    try:
        return redeem_linking_token(
            token=req.token,
            chat_id=req.chat_id,
            username=req.username,
        )
    except TokenNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (TokenExpiredError, TokenAlreadyUsedError) as e:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=str(e))
    except AccountConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except LinkingError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@telegram_router.get(
    "/integrations/telegram/status",
    response_model=TelegramStatusResponse,
    summary="Check Telegram Account Linking Status",
)
def api_get_telegram_status(
    patient_id: Optional[str] = Query(None, description="Check by patient ID"),
    chat_id: Optional[int] = Query(None, description="Check by Telegram chat ID"),
) -> TelegramStatusResponse:
    """Checks whether a patient or chat_id has an active Telegram connection."""
    with db_session() as conn:
        cursor = conn.cursor()
        if patient_id:
            cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
            patient = cursor.fetchone()
            if not patient:
                raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
            patient_dict = dict(patient)
            return TelegramStatusResponse(
                is_linked=bool(patient_dict.get("telegram_linked")),
                patient_id=patient_dict["patient_id"],
                patient_name=patient_dict["full_name"],
                telegram_username=patient_dict.get("telegram_username"),
                telegram_chat_id=patient_dict.get("telegram_chat_id"),
                telegram_linked_at=patient_dict.get("telegram_linked_at"),
                telegram_opt_in=bool(patient_dict.get("telegram_opt_in", True)),
                bot_configured=telegram_client.is_configured,
                bot_username=settings.TELEGRAM_BOT_USERNAME,
            )
        elif chat_id is not None:
            patient = get_patient_by_chat_id(chat_id)
            if not patient:
                return TelegramStatusResponse(
                    is_linked=False,
                    bot_configured=telegram_client.is_configured,
                    bot_username=settings.TELEGRAM_BOT_USERNAME,
                )
            return TelegramStatusResponse(
                is_linked=True,
                patient_id=patient["patient_id"],
                patient_name=patient["full_name"],
                telegram_username=patient.get("telegram_username"),
                telegram_chat_id=patient.get("telegram_chat_id"),
                telegram_linked_at=patient.get("telegram_linked_at"),
                telegram_opt_in=bool(patient.get("telegram_opt_in", True)),
                bot_configured=telegram_client.is_configured,
                bot_username=settings.TELEGRAM_BOT_USERNAME,
            )
        else:
            raise HTTPException(status_code=400, detail="Must provide either patient_id or chat_id.")


@telegram_router.post(
    "/integrations/telegram/unlink",
    summary="Disconnect Telegram Account From Patient Profile",
)
def api_unlink_telegram(req: UnlinkAccountRequest) -> dict[str, Any]:
    """Disconnects Telegram linking for a patient record."""
    try:
        return unlink_telegram_account(req.patient_id)
    except LinkingError as e:
        raise HTTPException(status_code=404, detail=str(e))


@telegram_router.post(
    "/integrations/telegram/webhook",
    summary="Telegram Bot Webhook Receiver",
)
async def api_telegram_webhook(request: Request) -> dict[str, Any]:
    """Receives and processes incoming updates from the Telegram Bot API."""
    try:
        update_data = await request.json()
        return await bot_service.process_update(update_data)
    except Exception as e:
        logger.error(f"Error handling Telegram webhook update: {e}", exc_info=True)
        return {"ok": False, "error": str(e)}


# ==============================================================================
# Reminder Operations & Scheduling Endpoints
# ==============================================================================

@telegram_router.get(
    "/internal/reminder-recipients",
    summary="Get List of Patients Due for Follow-up Reminders",
)
def api_get_reminder_recipients() -> dict[str, Any]:
    """Queries all patients eligible or due for follow-up reminders today."""
    recipients = fetch_reminder_recipients()
    return {
        "count": len(recipients),
        "eligible_count": len([r for r in recipients if r["eligible"]]),
        "recipients": recipients,
    }


@telegram_router.post(
    "/internal/reminders",
    summary="Dispatch Follow-Up Reminder (On-Demand or Sweep)",
)
async def api_trigger_reminders(req: Optional[TriggerReminderRequest] = None) -> dict[str, Any]:
    """
    Delivers a reminder for a specific patient, or runs the full daily sweep if no patient specified.
    Supports dry_run simulation for evaluation.
    """
    req = req or TriggerReminderRequest()

    if req.patient_id:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (req.patient_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Patient '{req.patient_id}' not found.")
            patient = dict(row)

        reminder_type = req.reminder_type or "Upcoming"
        try:
            result = await dispatch_single_reminder(
                patient=patient,
                reminder_type=reminder_type,
                dry_run=req.dry_run,
            )
            return {"success": True, "result": result}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Sweep all eligible
    sweep_result = await execute_daily_reminder_sweep(dry_run=req.dry_run)
    return {"success": True, "sweep": sweep_result}


@telegram_router.get(
    "/internal/scheduler/status",
    summary="Check Daily Reminder Scheduler Telemetry",
)
def api_scheduler_status() -> dict[str, Any]:
    """Returns scheduler running state, target time, and next run timestamp."""
    return reminder_scheduler.get_status()


@telegram_router.post(
    "/internal/scheduler/trigger",
    summary="Manually Trigger Daily Reminder Job Now",
)
async def api_manual_scheduler_trigger(dry_run: bool = Query(default=True)) -> dict[str, Any]:
    """Forces immediate execution of the daily reminder sweep for demonstration/testing."""
    return await reminder_scheduler.trigger_manual_sweep(dry_run=dry_run)


# ==============================================================================
# Patient Registry & Reminder History Endpoints (Shared With Asim)
# ==============================================================================

@telegram_router.get(
    "/patients",
    response_model=List[PatientSummarySchema],
    summary="List All Patients in Synthetic Registry",
)
def api_list_patients() -> List[PatientSummarySchema]:
    """Returns all synthetic patient records with current Telegram linking and follow-up status."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients ORDER BY follow_up_due_date ASC;")
        rows = [dict(r) for r in cursor.fetchall()]
        return [PatientSummarySchema(**r) for r in rows]


@telegram_router.get(
    "/patients/{patient_id}",
    response_model=PatientSummarySchema,
    summary="Get Patient Profile by ID",
)
def api_get_patient(patient_id: str) -> PatientSummarySchema:
    """Returns single patient details."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
        return PatientSummarySchema(**dict(row))


@telegram_router.get(
    "/patients/{patient_id}/reminders",
    response_model=List[ReminderRecordSchema],
    summary="Get Patient Reminder History (Asim's Profile Interface)",
)
def api_get_patient_reminders(patient_id: str) -> List[ReminderRecordSchema]:
    """Retrieves all past reminder delivery attempts for display in patient profile."""
    history = get_patient_reminder_history(patient_id)
    return [ReminderRecordSchema(**r) for r in history]
