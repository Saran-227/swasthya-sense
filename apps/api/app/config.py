"""
Application Configuration
SWASTHYA SENSE - Early Warning and Follow-up for High-Risk Patients
Smart Follow-up. Timely Attention. Better Care.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "SWASTHYA SENSE API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # Paths - resolve relative to repository root
    ROOT_DIR: Path = ROOT_DIR
    MODELS_DIR: Path = ROOT_DIR / "models"
    DATA_DIR: Path = ROOT_DIR / "data"
    WEB_DIST_DIR: Path = ROOT_DIR / "apps" / "web" / "dist"
    DATABASE_PATH: Path = ROOT_DIR / "data" / "swasthya_sense.db"

    # Telegram Bot & Integration Settings
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = "SwasthyaSenseBot"
    TELEGRAM_ENABLED: bool = False
    TELEGRAM_DRY_RUN: bool = True
    REMINDER_TIME: str = "09:00"
    REMINDER_TIMEZONE: str = "Asia/Kolkata"
    LINKING_TOKEN_EXPIRE_MINUTES: int = 30

    # Google OAuth & Authentication Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/api/auth/callback/google"
    JWT_SECRET: str = "super_secret_expense_manager_jwt_key_2026_xyz987"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:5173"

    # MongoDB Atlas Settings
    MONGODB_URI: str = ""
    MONGODB_DATABASE: str = "healthCare"

    # CORS configuration for React / Vite development
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    # Clinical Safety Disclaimer (FDA / CE SaMD Decision Support Boundary)
    CLINICAL_DISCLAIMER: str = (
        "DECISION SUPPORT ONLY: SWASTHYA SENSE is an early-warning and follow-up decision support platform. "
        "Alerts and reminders do NOT constitute formal medical diagnoses and must always remain under "
        "qualified clinician supervision."
    )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
