"""
Telegram Bot Worker & Lifecycle Manager
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Coordinates background polling or webhook ingestion for Telegram updates.
"""

from __future__ import annotations

import asyncio
from typing import Any

from apps.api.app.config import settings
from apps.api.app.integrations.telegram.client import telegram_client
from apps.api.app.integrations.telegram.handlers import dispatch_telegram_update
from apps.api.app.utils.logger import logger


class TelegramBotService:
    """Manages Telegram Bot execution, update consumption, and reply dispatch."""

    def __init__(self) -> None:
        self.polling_task: asyncio.Task | None = None
        self.is_running: bool = False
        self.last_update_id: int = 0

    async def process_update(self, update: dict[str, Any]) -> dict[str, Any]:
        """Processes a single incoming Telegram update and dispatches response."""
        chat_id, reply_text = await dispatch_telegram_update(update)
        if chat_id and reply_text:
            return await telegram_client.send_message(chat_id=chat_id, text=reply_text)
        return {"ok": True, "skipped": True}

    async def start_polling(self) -> None:
        """Starts background long-polling if Telegram integration is configured."""
        if not telegram_client.is_configured or telegram_client.dry_run:
            logger.info("Telegram Bot running in DRY-RUN / SIMULATION mode. Polling loop idle.")
            return

        self.is_running = True
        logger.info(f"Starting Telegram long-polling worker for @{settings.TELEGRAM_BOT_USERNAME}...")

        # Clear any prior webhook before polling
        await telegram_client.delete_webhook()

        while self.is_running:
            try:
                updates = await telegram_client.get_updates(offset=self.last_update_id + 1, timeout=5)
                for update in updates:
                    update_id = update.get("update_id", 0)
                    if update_id > self.last_update_id:
                        self.last_update_id = update_id
                    await self.process_update(update)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in Telegram polling loop: {e}", exc_info=True)
                await asyncio.sleep(5)

    def stop_polling(self) -> None:
        """Stops background polling worker."""
        self.is_running = False
        if self.polling_task and not self.polling_task.done():
            self.polling_task.cancel()
            logger.info("Telegram polling worker stopped.")


bot_service = TelegramBotService()
