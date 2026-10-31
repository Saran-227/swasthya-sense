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
    risk_tier: str = "Low"
    assigned_worker: Optional[str] = None
    consent_given: bool = True
    consent_updated_at: Optional[str] = None
    follow_up_due_date: str
    follow_up_type: str = "Routine Check-in"
    telegram_username: Optional[str] = None
    telegram_chat_id: Optional[int] = None
    telegram_linked: bool = False
    telegram_opt_in: bool = True
    telegram_linked_at: Optional[str] = None
    reminder_window: Optional[str] = "09:00 AM"
    notify_upcoming: Optional[bool] = True
    notify_overdue: Optional[bool] = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PatientCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    age: int = Field(..., ge=1, le=125)
    gender: str = Field(..., description="Male, Female, or Other")
    contact_phone: Optional[str] = Field(None, max_length=30)
    condition_summary: Optional[str] = Field(None, max_length=500)
    risk_tier: str = Field(default="Low")
    assigned_worker: Optional[str] = Field(default="Nurse Sunita Sharma")
    consent_given: bool = Field(default=True)
    follow_up_due_date: str = Field(..., description="YYYY-MM-DD")
    follow_up_type: str = Field(default="Routine Check-in")
    telegram_opt_in: bool = Field(default=True)
    reminder_window: Optional[str] = Field(default="09:00 AM")
    notify_upcoming: Optional[bool] = Field(default=True)
    notify_overdue: Optional[bool] = Field(default=True)


class PatientUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    contact_phone: Optional[str] = None
    condition_summary: Optional[str] = None
    risk_tier: Optional[str] = None
    assigned_worker: Optional[str] = None
    consent_given: Optional[bool] = None
    follow_up_due_date: Optional[str] = None
    follow_up_type: Optional[str] = None
    telegram_opt_in: Optional[bool] = None
    reminder_window: Optional[str] = None
    notify_upcoming: Optional[bool] = None
    notify_overdue: Optional[bool] = None


class TelegramPreferencesRequest(BaseModel):
    patient_id: str = Field(..., description="Patient ID")
    telegram_opt_in: bool = Field(default=True)
    reminder_window: Optional[str] = Field(default="09:00 AM")
    notify_upcoming: Optional[bool] = Field(default=True)
    notify_overdue: Optional[bool] = Field(default=True)

