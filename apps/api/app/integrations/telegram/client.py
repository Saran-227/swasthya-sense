"""
Telegram Bot API Client
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Implements official Telegram Bot API HTTPS protocol via httpx.
Supports live API calls, dry-run simulation, and resilient error recovery.
"""

from __future__ import annotations

import uuid
from typing import Any, Optional
import httpx

from apps.api.app.config import settings
from apps.api.app.utils.logger import logger


class TelegramClient:
    """Asynchronous client for Telegram Bot API with graceful simulation fallback."""

    def __init__(
        self,
        bot_token: str | None = None,
        dry_run: bool | None = None,
        enabled: bool | None = None,
    ) -> None:
        self.bot_token = bot_token if bot_token is not None else settings.TELEGRAM_BOT_TOKEN
        self.dry_run = dry_run if dry_run is not None else settings.TELEGRAM_DRY_RUN
        self.enabled = enabled if enabled is not None else settings.TELEGRAM_ENABLED
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else ""

    @property
    def is_configured(self) -> bool:
        """Returns True if bot token is present and integration is enabled."""
        return bool(self.bot_token and self.enabled)

    async def get_me(self) -> dict[str, Any]:
        """Calls getMe on Telegram API to verify credentials, or returns simulation metadata."""
        if not self.is_configured or self.dry_run:
            return {
                "ok": True,
                "result": {
                    "id": 999999999,
                    "is_bot": True,
                    "first_name": "SWASTHYA SENSE Reminder Bot",
                    "username": settings.TELEGRAM_BOT_USERNAME,
                    "can_join_groups": False,
                    "can_read_all_group_messages": False,
                    "supports_inline_queries": False,
                },
                "simulated": True,
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self.base_url}/getMe")
            resp.raise_for_status()
            return resp.json()

    async def send_message(
        self,
        chat_id: int | str,
        text: str,
        parse_mode: str = "HTML",
        disable_web_page_preview: bool = True,
    ) -> dict[str, Any]:
        """
        Dispatches a message to the specified Telegram chat_id.
        In dry-run or unconfigured mode, simulates successful dispatch.
        """
        if not self.is_configured or self.dry_run:
            simulated_id = f"sim_msg_{uuid.uuid4().hex[:10]}"
            logger.info(
                f"[TELEGRAM SIMULATION] Target Chat: {chat_id} | Status: Simulated | ID: {simulated_id}"
            )
            return {
                "ok": True,
                "result": {
                    "message_id": simulated_id,
                    "chat": {"id": chat_id, "type": "private"},
                    "text": text,
                },
                "simulated": True,
            }

        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": disable_web_page_preview,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{self.base_url}/sendMessage", json=payload)
            if resp.status_code >= 400:
                logger.error(f"Telegram API delivery error: {resp.status_code} - {resp.text}")
                resp.raise_for_status()
            return resp.json()

    async def set_webhook(self, url: str) -> dict[str, Any]:
        """Configures the Telegram webhook endpoint for incoming updates."""
        if not self.is_configured or self.dry_run:
            return {"ok": True, "description": "Webhook simulation configured.", "simulated": True}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{self.base_url}/setWebhook", json={"url": url})
            resp.raise_for_status()
            return resp.json()

    async def delete_webhook(self) -> dict[str, Any]:
        """Removes webhook configuration (used when switching to long-polling)."""
        if not self.is_configured or self.dry_run:
            return {"ok": True, "description": "Webhook deleted (simulation).", "simulated": True}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{self.base_url}/deleteWebhook")
            resp.raise_for_status()
            return resp.json()

    async def get_updates(self, offset: int | None = None, timeout: int = 10) -> list[dict[str, Any]]:
        """Long-polling update retrieval for local development and test automation."""
        if not self.is_configured or self.dry_run:
            return []

        params = {"timeout": timeout}
        if offset is not None:
            params["offset"] = offset

        async with httpx.AsyncClient(timeout=timeout + 5) as client:
            resp = await client.get(f"{self.base_url}/getUpdates", params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("result", [])


telegram_client = TelegramClient()
