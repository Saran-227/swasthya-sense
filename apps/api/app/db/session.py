"""
Database Session & SQLite Schema Management
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Shared Database Architecture for Patient Registry, Telegram Linking, and Reminders
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator, Any, Optional

from apps.api.app.config import settings
from apps.api.app.utils.logger import logger


DB_PATH = settings.DATABASE_PATH


def get_db_connection() -> sqlite3.Connection:
    """Creates a configured connection to the shared SQLite database."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for atomic database transactions."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initializes tables and seeds initial synthetic patient cohort if empty."""
    with db_session() as conn:
        cursor = conn.cursor()

        # 1. Patients Table (Shared with Asim)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS patients (
                patient_id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                contact_phone TEXT,
                condition_summary TEXT,
                risk_tier TEXT NOT NULL DEFAULT 'Low',
                assigned_worker TEXT,
                consent_given BOOLEAN NOT NULL DEFAULT 1,
                consent_updated_at TEXT,
                follow_up_due_date TEXT NOT NULL,
                follow_up_type TEXT NOT NULL DEFAULT 'Routine Check-in',
                telegram_username TEXT,
                telegram_chat_id INTEGER,
                telegram_linked BOOLEAN NOT NULL DEFAULT 0,
                telegram_linked_at TEXT,
                telegram_opt_in BOOLEAN NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )

        # 2. Account Linking Tokens Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS linking_tokens (
                token TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used BOOLEAN NOT NULL DEFAULT 0,
                used_at TEXT,
                FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
            );
            """
        )

        # 3. Reminder History Table (Shared with Asim)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS reminders (
                reminder_id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                channel TEXT NOT NULL DEFAULT 'Telegram',
                reminder_type TEXT NOT NULL,
                message_summary TEXT NOT NULL,
                scheduled_at TEXT NOT NULL,
                sent_at TEXT,
                delivery_status TEXT NOT NULL,
                telegram_message_id TEXT,
                error_message TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
            );
            """
        )

        # 4. Users Table (Google Authentication & Account Binding)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                google_id TEXT UNIQUE,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                picture TEXT,
                patient_id TEXT UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE SET NULL
            );
            """
        )

        # Ensure preference and user linking columns exist if table was previously created
        for col_def in [
            ("reminder_window", "TEXT DEFAULT '09:00 AM'"),
            ("notify_upcoming", "BOOLEAN DEFAULT 1"),
            ("notify_overdue", "BOOLEAN DEFAULT 1"),
            ("user_id", "TEXT"),
            ("email", "TEXT"),
            ("profile_picture", "TEXT"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE patients ADD COLUMN {col_def[0]} {col_def[1]};")
            except sqlite3.OperationalError:
                pass

        # Create indexes for high-frequency queries
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_patients_follow_up ON patients(follow_up_due_date, telegram_linked);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_patients_chat_id ON patients(telegram_chat_id);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_reminders_patient ON reminders(patient_id, scheduled_at);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_tokens_patient ON linking_tokens(patient_id, used);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);"
        )

        # Check if synthetic seed data is required
        cursor.execute("SELECT COUNT(*) as cnt FROM patients;")
        count = cursor.fetchone()["cnt"]
        if count == 0:
            logger.info("Seeding synthetic patient cohort for SWASTHYA SENSE demonstration...")
            _seed_synthetic_patients(cursor)


def reset_synthetic_cohort() -> None:
    """Resets the patients and sample reminders back to clean demonstration cohort."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM reminders;")
        cursor.execute("DELETE FROM linking_tokens;")
        cursor.execute("DELETE FROM patients;")
        _seed_synthetic_patients(cursor)
    logger.info("Synthetic patient cohort successfully re-seeded.")



def _seed_synthetic_patients(cursor: sqlite3.Cursor) -> None:
    """Pre-populates clinical cohort with diverse follow-up statuses for demonstration."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    overdue_str = (now - timedelta(days=3)).strftime("%Y-%m-%d")
    upcoming_str = (now + timedelta(days=2)).strftime("%Y-%m-%d")
    future_str = (now + timedelta(days=14)).strftime("%Y-%m-%d")
    iso_now = now.isoformat()

    patients = [
        (
            "PT-SENSE-101",
            "Ramesh Kumar",
            58,
            "Male",
            "+91 98765 43210",
            "Post-PCI (Stent Placement) recovery; needs BP and anti-platelet compliance check",
            "High",
            "Nurse Sunita Sharma",
            1,
            iso_now,
            today_str,  # Due Today!
            "Cardiology Stent Follow-up",
            None,
            None,
            0,  # Unlinked (Ideal for Deep-Link Demo)
            None,
            1,
            iso_now,
            iso_now,
        ),
        (
            "PT-SENSE-102",
            "Priya Sharma",
            31,
            "Female",
            "+91 98123 45678",
            "High-risk Pregnancy (Gestational Hypertension, 32 weeks); requires proteinuria & BP tracking",
            "High",
            "ANM Anita Verma",
            1,
            iso_now,
            overdue_str,  # Overdue!
            "Antenatal High-Risk Check-up",
            "priya_sharma_demo",
            100200301,  # Linked
            1,
            iso_now,
            1,
            iso_now,
            iso_now,
        ),
        (
            "PT-SENSE-103",
            "Anil Verma",
            64,
            "Male",
            "+91 97234 56789",
            "Congestive Heart Failure & Type 2 Diabetes; weight & edema monitoring",
            "Moderate",
            "Health Worker Rajesh",
            1,
            iso_now,
            upcoming_str,  # Upcoming!
            "Chronic Care Review",
            "anil_verma_demo",
            100200302,  # Linked
            1,
            iso_now,
            1,
            iso_now,
            iso_now,
        ),
        (
            "PT-SENSE-104",
            "Sunita Devi",
            49,
            "Female",
            "+91 96345 67890",
            "Chronic Ischemic Heart Disease; requested SMS only, opted out of Telegram",
            "Moderate",
            "Nurse Sunita Sharma",
            1,
            iso_now,
            today_str,  # Due today, but opted out!
            "Routine Vitals Check",
            "sunita_d_demo",
            100200303,
            1,
            iso_now,
            0,  # telegram_opt_in = 0 (Suppressed)
            iso_now,
            iso_now,
        ),
        (
            "PT-SENSE-105",
            "Vikram Patel",
            72,
            "Male",
            "+91 95456 78901",
            "Post-Infarction Rehabilitation; Consent pending verification",
            "High",
            "ANM Anita Verma",
            0,  # No consent
            None,
            today_str,  # Due today, but no consent (Suppressed)
            "Cardiac Rehabilitation",
            None,
            None,
            0,
            None,
            1,
            iso_now,
            iso_now,
        ),
        (
            "PT-SENSE-106",
            "Meera Joshi",
            42,
            "Female",
            "+91 94567 89012",
            "Mild Essential Hypertension; diet & lifestyle monitoring",
            "Low",
            "Health Worker Rajesh",
            1,
            iso_now,
            future_str,  # Future date (Not due yet)
            "Quarterly BP Review",
            "meera_j_demo",
            100200304,
            1,
            iso_now,
            1,
            iso_now,
            iso_now,
        ),
    ]

    cursor.executemany(
        """
        INSERT INTO patients (
            patient_id, full_name, age, gender, contact_phone, condition_summary,
            risk_tier, assigned_worker, consent_given, consent_updated_at,
            follow_up_due_date, follow_up_type, telegram_username, telegram_chat_id,
            telegram_linked, telegram_linked_at, telegram_opt_in, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        patients,
    )

    # Pre-seed sample historical reminder records for Asim's UI
    sample_reminders = [
        (
            "REM-HIST-001",
            "PT-SENSE-102",
            "Telegram",
            "Upcoming",
            "SWASTHYA SENSE demo reminder: Upcoming Antenatal High-Risk Check-up.",
            (now - timedelta(days=5)).isoformat(),
            (now - timedelta(days=5)).isoformat(),
            "Sent",
            "tg_msg_881021",
            None,
            (now - timedelta(days=5)).isoformat(),
        ),
        (
            "REM-HIST-002",
            "PT-SENSE-103",
            "Telegram",
            "Upcoming",
            "SWASTHYA SENSE demo reminder: Upcoming Chronic Care Review.",
            (now - timedelta(days=7)).isoformat(),
            (now - timedelta(days=7)).isoformat(),
            "Sent",
            "tg_msg_881022",
            None,
            (now - timedelta(days=7)).isoformat(),
        ),
    ]

    cursor.executemany(
        """
        INSERT INTO reminders (
            reminder_id, patient_id, channel, reminder_type, message_summary,
            scheduled_at, sent_at, delivery_status, telegram_message_id, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        sample_reminders,
    )
