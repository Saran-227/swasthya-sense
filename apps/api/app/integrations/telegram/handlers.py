"""
Telegram Bot Command Handlers
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Implements Telegram command protocol (/start, /help, /status, /stop).
Ensures patient privacy, transparent explanation, and clear opt-out.
"""

from __future__ import annotations

from typing import Any, Tuple

from apps.api.app.integrations.telegram.linking import (
    AccountConflictError,
    LinkingError,
    TokenAlreadyUsedError,
    TokenExpiredError,
    TokenNotFoundError,
    get_patient_by_chat_id,
    redeem_linking_token,
    set_telegram_opt_in,
)
from apps.api.app.utils.logger import logger


async def handle_start_command(
    chat_id: int,
    args: str,
    username: str | None = None,
    first_name: str | None = None,
) -> str:
    """Handles /start command, optionally with linking token payload."""
    greeting = f"Namaste {first_name or ''}!".strip()

    # Case 1: Linking token provided via deep link (e.g., /start link_TOKEN or /start TOKEN)
    token_str = args.strip()
    if token_str:
        if token_str.startswith("link_"):
            token_str = token_str[5:]

        try:
            result = redeem_linking_token(token=token_str, chat_id=chat_id, username=username)
            patient = result["patient"]
            return (
                f"<b>{greeting}</b>\n\n"
                f"✅ <b>Telegram Account Successfully Linked!</b>\n\n"
                f"Your Telegram has been connected to <b>SWASTHYA SENSE</b> for:\n"
                f"• <b>Patient:</b> {patient['full_name']}\n"
                f"• <b>Patient ID:</b> {patient['patient_id']}\n\n"
                f"🔔 <i>You will receive administrative reminders for scheduled health check-ins.</i>\n\n"
                f"Type /status anytime to verify your link, or /stop to opt out."
            )
        except TokenNotFoundError:
            return (
                f"<b>{greeting}</b>\n\n"
                f"❌ <b>Invalid Linking Token</b>\n\n"
                f"The link you used is not recognized. Please obtain a fresh linking link from your healthcare dashboard or patient profile."
            )
        except TokenExpiredError:
            return (
                f"<b>{greeting}</b>\n\n"
                f"⚠️ <b>Linking Token Expired</b>\n\n"
                f"For your privacy and security, linking tokens expire after 30 minutes. Please generate a new connection link from your profile."
            )
        except TokenAlreadyUsedError:
            return (
                f"<b>{greeting}</b>\n\n"
                f"⚠️ <b>Token Already Used</b>\n\n"
                f"This single-use link has already been redeemed. If you need to re-link, please generate a new link from your profile."
            )
        except AccountConflictError as err:
            return (
                f"<b>{greeting}</b>\n\n"
                f"⚠️ <b>Account Association Notice</b>\n\n"
                f"{str(err)}"
            )
        except LinkingError as err:
            return f"<b>{greeting}</b>\n\n❌ {str(err)}"

    # Case 2: User opened bot directly without token
    linked_patient = get_patient_by_chat_id(chat_id)
    if linked_patient:
        return (
            f"<b>{greeting}</b>\n\n"
            f"👋 Welcome back to <b>SWASTHYA SENSE</b>!\n"
            f"Your account is currently linked to <b>{linked_patient['full_name']}</b> ({linked_patient['patient_id']}).\n\n"
            f"Available commands:\n"
            f"• /status — View linking and opt-in status\n"
            f"• /stop — Opt out of future reminders\n"
            f"• /help — Learn more about SWASTHYA SENSE"
        )

    return (
        f"<b>{greeting}</b>\n\n"
        f"Welcome to <b>SWASTHYA SENSE</b>\n"
        f"<i>Smart Follow-up. Timely Attention. Better Care.</i>\n\n"
        f"This official bot delivers timely check-in reminders for high-risk patients under healthcare worker supervision.\n\n"
        f"🔗 <b>How to Link Your Account:</b>\n"
        f"1. Open your patient profile or health worker dashboard on the SWASTHYA SENSE web app.\n"
        f"2. Click <b>'Connect Telegram'</b>.\n"
        f"3. Follow the generated deep link back to this bot.\n\n"
        f"Type /help for more information."
    )


async def handle_help_command(chat_id: int) -> str:
    """Handles /help command."""
    return (
        f"<b>SWASTHYA SENSE — Bot Help & Commands</b>\n\n"
        f"• <b>/start</b> — Launch bot or connect with a deep link token\n"
        f"• <b>/status</b> — Check your Telegram linking and reminder subscription status\n"
        f"• <b>/stop</b> — Opt out of automated follow-up reminders\n"
        f"• <b>/help</b> — Show this help message\n\n"
        f"🔒 <b>Privacy Notice:</b>\n"
        f"SWASTHYA SENSE only sends administrative check-in reminders. We never transmit sensitive medical diagnoses, lab values, or imaging records through Telegram."
    )


async def handle_status_command(chat_id: int) -> str:
    """Handles /status command."""
    patient = get_patient_by_chat_id(chat_id)
    if not patient:
        return (
            f"ℹ️ <b>Account Status: Not Linked</b>\n\n"
            f"This Telegram account is not currently connected to any SWASTHYA SENSE patient profile.\n"
            f"To connect, click <b>'Connect Telegram'</b> on your patient profile."
        )

    opt_in_text = "🟢 Active (Subscribed)" if patient.get("telegram_opt_in") else "🔴 Opted Out (Paused)"
    due_date = patient.get("follow_up_due_date", "Not scheduled")

    return (
        f"📋 <b>SWASTHYA SENSE Status</b>\n\n"
        f"• <b>Linked Patient:</b> {patient['full_name']}\n"
        f"• <b>Patient ID:</b> {patient['patient_id']}\n"
        f"• <b>Next Follow-Up Due:</b> {due_date}\n"
        f"• <b>Assigned Health Worker:</b> {patient.get('assigned_worker', 'Frontline Team')}\n"
        f"• <b>Reminder Opt-In:</b> {opt_in_text}\n"
        f"• <b>Linked Since:</b> {patient.get('telegram_linked_at', 'Recorded')[:10]}\n\n"
        f"To pause reminders, type /stop."
    )


async def handle_stop_command(chat_id: int) -> str:
    """Handles /stop command to opt-out from automated reminders."""
    result = set_telegram_opt_in(chat_id=chat_id, opt_in=False)
    if result["affected_patients"] > 0:
        return (
            f"🛑 <b>Reminders Paused</b>\n\n"
            f"You have successfully opted out of automated Telegram follow-up reminders from SWASTHYA SENSE.\n\n"
            f"Your assigned healthcare worker can still reach you through direct in-person visits or phone calls.\n"
            f"You can re-enable Telegram reminders at any time from your profile or by typing /start."
        )
    return (
        f"ℹ️ You do not have an active reminder subscription linked to this Telegram account."
    )


async def dispatch_telegram_update(update: dict[str, Any]) -> Tuple[int, str]:
    """
    Parses an incoming Telegram Update dictionary and dispatches to appropriate command handler.
    Returns (chat_id, response_text).
    """
    message = update.get("message", {})
    text = (message.get("text") or "").strip()
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    from_user = message.get("from", {})
    username = from_user.get("username")
    first_name = from_user.get("first_name")

    if not chat_id:
        return 0, ""

    parts = text.split(maxsplit=1)
    raw_cmd = parts[0] if parts else ""
    cmd = raw_cmd.split("@")[0].lower()
    args = parts[1] if len(parts) > 1 else ""

    if cmd == "/start":
        reply = await handle_start_command(chat_id=chat_id, args=args, username=username, first_name=first_name)
    elif cmd == "/help":
        reply = await handle_help_command(chat_id=chat_id)
    elif cmd == "/status":
        reply = await handle_status_command(chat_id=chat_id)
    elif cmd == "/stop":
        reply = await handle_stop_command(chat_id=chat_id)
    else:
        reply = (
            f"Hello! Type /help to see available SWASTHYA SENSE commands, "
            f"or /status to view your reminder subscription."
        )

    return chat_id, reply
