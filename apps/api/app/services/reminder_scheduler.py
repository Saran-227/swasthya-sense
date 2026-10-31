"""
Daily Reminder Scheduler
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Runs daily at configurable time (default 09:00 AM IST) using APScheduler.
Coordinates the automatic sweep of due/overdue patients and Telegram reminder dispatch.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Optional
import zoneinfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from apps.api.app.config import settings
from apps.api.app.services.reminder_service import execute_daily_reminder_sweep
from apps.api.app.utils.logger import logger


class ReminderSchedulerService:
    """Manages the lifecycle of daily automated reminder jobs."""

    def __init__(self) -> None:
        self.scheduler: AsyncIOScheduler | None = None
        self.is_running: bool = False
        self.last_run_at: datetime | None = None
        self.last_result: dict[str, Any] | None = None

    def _parse_time(self) -> tuple[int, int]:
        """Parses REMINDER_TIME (HH:MM) into integer hour and minute."""
        raw = settings.REMINDER_TIME.strip()
        try:
            parts = raw.split(":")
            return int(parts[0]), int(parts[1])
        except Exception:
            logger.warning(f"Invalid REMINDER_TIME '{raw}'. Defaulting to 09:00.")
            return 9, 0

    def start(self) -> None:
        """Initializes and starts the background AsyncIOScheduler."""
        if self.is_running:
            return

        hour, minute = self._parse_time()
        tz_name = settings.REMINDER_TIMEZONE

        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception as e:
            logger.warning(f"Could not load timezone '{tz_name}' ({e}). Falling back to UTC.")
            tz = zoneinfo.ZoneInfo("UTC")

        self.scheduler = AsyncIOScheduler(timezone=tz)
        trigger = CronTrigger(hour=hour, minute=minute, timezone=tz)

        self.scheduler.add_job(
            self._scheduled_job_wrapper,
            trigger=trigger,
            id="daily_patient_reminder_job",
            name="SWASTHYA SENSE Daily Patient Reminder Sweep",
            replace_existing=True,
        )

        self.scheduler.start()
        self.is_running = True
        logger.info(
            f"Daily reminder scheduler initialized: {hour:02d}:{minute:02d} ({tz_name})"
        )

    async def _scheduled_job_wrapper(self) -> None:
        """Invoked by APScheduler when the scheduled time arrives."""
        logger.info("Executing scheduled daily patient reminder sweep...")
        try:
            # Enforce dry_run=True so automatic background sweeps never send unsolicited live messages
            result = await execute_daily_reminder_sweep(dry_run=True)
            self.last_run_at = datetime.now()
            self.last_result = result
            logger.info(
                f"Completed scheduled daily sweep. Eligible: {result['eligible_count']} | Dispatched: {result['reminders_dispatched']}"
            )
        except Exception as e:
            logger.error(f"Error during scheduled daily reminder sweep: {e}", exc_info=True)

    async def trigger_manual_sweep(self, dry_run: bool | None = None) -> dict[str, Any]:
        """Allows immediate execution of the reminder sweep for testing and demonstration."""
        logger.info("Triggering on-demand reminder sweep...")
        result = await execute_daily_reminder_sweep(dry_run=dry_run)
        self.last_run_at = datetime.now()
        self.last_result = result
        return result

    def stop(self) -> None:
        """Shuts down the scheduler gracefully."""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("Daily reminder scheduler stopped.")

    def get_status(self) -> dict[str, Any]:
        """Returns current scheduler configuration and execution telemetry."""
        hour, minute = self._parse_time()
        next_run = None
        if self.scheduler and self.scheduler.running:
            job = self.scheduler.get_job("daily_patient_reminder_job")
            if job and job.next_run_time:
                next_run = job.next_run_time.isoformat()

        return {
            "is_running": self.is_running,
            "scheduled_time": f"{hour:02d}:{minute:02d}",
            "timezone": settings.REMINDER_TIMEZONE,
            "next_run_at": next_run,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
            "last_result": self.last_result,
        }


reminder_scheduler = ReminderSchedulerService()
