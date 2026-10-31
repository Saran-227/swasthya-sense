"""
Pydantic Schemas for Telegram Integration & Follow-up Reminders
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
"""

from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class CreateLinkingTokenRequest(BaseModel):
    patient_id: str = Field(..., description="Target patient ID to link")


class CreateLinkingTokenResponse(BaseModel):
    patient_id: str
    patient_name: str
    token: str
    expires_at: str
    deep_link: str
    bot_username: str


class RedeemTokenRequest(BaseModel):
    token: str = Field(..., description="Single-use linking token")
    chat_id: int = Field(..., description="Telegram user chat ID")
    username: Optional[str] = Field(None, description="Telegram username for display")


class UnlinkAccountRequest(BaseModel):
    patient_id: str = Field(..., description="Patient ID to unlink")


class TelegramStatusResponse(BaseModel):
    is_linked: bool
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    telegram_username: Optional[str] = None
    telegram_chat_id: Optional[int] = None
    telegram_linked_at: Optional[str] = None
    telegram_opt_in: bool = True
    bot_configured: bool = False
    bot_username: str


class TriggerReminderRequest(BaseModel):
    patient_id: Optional[str] = Field(None, description="Specific patient ID, or omit for all due")
    reminder_type: Optional[str] = Field(None, description="Upcoming, Due Today, or Overdue")
    dry_run: Optional[bool] = Field(None, description="Simulate without network dispatch")


class ReminderRecordSchema(BaseModel):
    reminder_id: str
    patient_id: str
    channel: str = "Telegram"
    reminder_type: str
    message_summary: str
    scheduled_at: str
    sent_at: Optional[str] = None
    delivery_status: str
    telegram_message_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str


class PatientSummarySchema(BaseModel):
    patient_id: str
    full_name: str
    age: int
    gender: str
    contact_phone: Optional[str] = None
    condition_summary: Optional[str] = None
    risk_tier: str
    assigned_worker: Optional[str] = None
    consent_given: bool
    follow_up_due_date: str
    follow_up_type: str
    telegram_username: Optional[str] = None
    telegram_chat_id: Optional[int] = None
    telegram_linked: bool
    telegram_opt_in: bool
    telegram_linked_at: Optional[str] = None
