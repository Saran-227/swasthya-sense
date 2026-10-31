"""
MongoDB Atlas Synchronization Service
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Persists patient & user profiles to MongoDB Atlas healthCare cluster with SSL and resilient fallback.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
import certifi
import pymongo

from apps.api.app.config import settings
from apps.api.app.utils.logger import logger


class MongoDBService:
    def __init__(self) -> None:
        self._client: Optional[pymongo.MongoClient] = None
        self._db: Optional[Any] = None

    def get_database(self) -> Optional[Any]:
        """Lazy connection to MongoDB Atlas."""
        if not settings.MONGODB_URI:
            return None

        if self._db is not None:
            return self._db

        try:
            self._client = pymongo.MongoClient(
                settings.MONGODB_URI,
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=4000,
                connectTimeoutMS=4000,
            )
            # Test connectivity
            self._client.admin.command("ping")
            self._db = self._client[settings.MONGODB_DATABASE]
            logger.info(f"Connected to MongoDB Atlas database: {settings.MONGODB_DATABASE}")
            return self._db
        except Exception as e:
            logger.warning(f"Could not connect to MongoDB Atlas ({e}). Operating in local SQLite mode.")
            return None

    def sync_patient(self, patient_data: dict[str, Any]) -> bool:
        """
        Upserts patient document into MongoDB Atlas patients collection.
        Non-blocking error handling to ensure local operations remain fast and uninterrupted.
        """
        db = self.get_database()
        if db is None:
            return False

        patient_id = patient_data.get("patient_id") or patient_data.get("patientId")
        if not patient_id:
            return False

        now = datetime.now(timezone.utc)
        doc: dict[str, Any] = {
            "patientId": patient_id,
            "googleSub": patient_data.get("google_id") or patient_data.get("googleSub") or patient_data.get("user_id"),
            "fullName": patient_data.get("full_name") or patient_data.get("fullName"),
            "email": patient_data.get("email"),
            "profilePicture": patient_data.get("profile_picture") or patient_data.get("profilePicture"),
            "emailVerified": True,
            "phoneNumber": patient_data.get("contact_phone") or patient_data.get("phoneNumber"),
            "gender": patient_data.get("gender"),
            "age": patient_data.get("age"),
            "riskTier": patient_data.get("risk_tier") or patient_data.get("riskTier", "Low"),
            "conditionSummary": patient_data.get("condition_summary") or patient_data.get("conditionSummary"),
            "assignedWorker": patient_data.get("assigned_worker") or patient_data.get("assignedWorker"),
            "followUpDueDate": patient_data.get("follow_up_due_date") or patient_data.get("followUpDueDate"),
            "followUpType": patient_data.get("follow_up_type") or patient_data.get("followUpType", "Routine Check-in"),
            "role": "patient",
            "consent": {
                "status": "granted" if patient_data.get("consent_given") else "pending",
                "acceptedAt": patient_data.get("consent_updated_at") or now.isoformat(),
                "version": "1.0",
            },
            "telegram": {
                "linked": bool(patient_data.get("telegram_linked")),
                "chatId": patient_data.get("telegram_chat_id"),
                "username": patient_data.get("telegram_username"),
                "optIn": bool(patient_data.get("telegram_opt_in")),
            },
            "updatedAt": now,
        }

        try:
            db.patients.update_one(
                {"patientId": patient_id},
                {"$set": doc, "$setOnInsert": {"createdAt": now}},
                upsert=True,
            )
            logger.info(f"Synchronized patient {patient_id} to MongoDB Atlas.")
            return True
        except Exception as e:
            logger.warning(f"Failed to sync patient {patient_id} to MongoDB: {e}")
            return False


mongodb_service = MongoDBService()
