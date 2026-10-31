"""
Telegram Integration Package
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
"""

from .client import telegram_client, TelegramClient
from .linking import (
    create_linking_token,
    redeem_linking_token,
    unlink_telegram_account,
    set_telegram_opt_in,
    get_patient_by_chat_id,
    LinkingError,
    TokenExpiredError,
    TokenNotFoundError,
    TokenAlreadyUsedError,
    AccountConflictError,
)
from .handlers import dispatch_telegram_update
from .bot import bot_service, TelegramBotService

__all__ = [
    "telegram_client",
    "TelegramClient",
    "create_linking_token",
    "redeem_linking_token",
    "unlink_telegram_account",
    "set_telegram_opt_in",
    "get_patient_by_chat_id",
    "LinkingError",
    "TokenExpiredError",
    "TokenNotFoundError",
    "TokenAlreadyUsedError",
    "AccountConflictError",
    "dispatch_telegram_update",
    "bot_service",
    "TelegramBotService",
]
