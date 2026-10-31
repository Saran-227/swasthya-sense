"""
Google Authentication & Patient Profile Binding Router
SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
Implements Google OAuth2 / GIS verification, JWT issuance, automatic unique Patient ID generation,
and dual persistence across SQLite and MongoDB Atlas.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
import httpx
import jwt
from pydantic import BaseModel, Field

from apps.api.app.config import settings
from apps.api.app.db.session import db_session
from apps.api.app.schemas.telegram import PatientSummarySchema
from apps.api.app.services.mongodb_service import mongodb_service
from apps.api.app.utils.logger import logger

auth_router = APIRouter(prefix="/auth", tags=["Google Authentication"])


# ==============================================================================
# Request / Response Schemas
# ==============================================================================

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = Field(None, description="Google ID Token from Google GIS One Tap / Button")
    code: Optional[str] = Field(None, description="OAuth Authorization Code from redirect flow")
    redirect_uri: Optional[str] = Field(None, description="Redirect URI if code was used")


class UserProfileSchema(BaseModel):
    user_id: str
    email: str
    full_name: str
    picture: Optional[str] = None
    patient_id: str


class AuthResponse(BaseModel):
    token: str
    user: UserProfileSchema
    patient: PatientSummarySchema
    is_new_registration: bool


class AuthConfigResponse(BaseModel):
    google_client_id: str
    google_redirect_uri: str
    auth_url: str


# ==============================================================================
# Helper Utilities
# ==============================================================================

def generate_unique_patient_id() -> str:
    """Generates an uppercase unique Patient ID for newly registered users."""
    return f"PT-SENSE-{uuid.uuid4().hex[:6].upper()}"


def create_jwt_token(user_id: str, email: str, name: str, picture: Optional[str], patient_id: str) -> str:
    """Creates a signed HS256 JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "patient_id": patient_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict[str, Any]:
    """Decodes and validates a JWT access token."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization token.")


async def verify_google_id_token(id_token: str) -> dict[str, Any]:
    """Verifies a Google ID Token using Google's official tokeninfo endpoint."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
        if resp.status_code != 200:
            logger.error(f"Google ID token verification failed: {resp.text}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credentials.")
        data = resp.json()

        # Check audience matches configured client ID if configured
        aud = data.get("aud")
        if settings.GOOGLE_CLIENT_ID and aud and aud != settings.GOOGLE_CLIENT_ID:
            logger.warning(f"Google token audience mismatch: {aud} vs {settings.GOOGLE_CLIENT_ID}")

        return {
            "sub": data.get("sub"),
            "email": data.get("email"),
            "name": data.get("name") or data.get("email", "").split("@")[0],
            "picture": data.get("picture"),
            "email_verified": data.get("email_verified", True),
        }


async def exchange_google_code(code: str, redirect_uri: Optional[str] = None) -> dict[str, Any]:
    """Exchanges an OAuth authorization code for Google user profile info."""
    effective_redirect_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI
    token_url = "https://oauth2.googleapis.com/token"

    payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": effective_redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(token_url, data=payload)
        if resp.status_code != 200:
            logger.error(f"Google authorization code exchange failed: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to exchange Google authorization code.")

        token_data = resp.json()
        id_token = token_data.get("id_token")
        if id_token:
            return await verify_google_id_token(id_token)

        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No access token received from Google.")

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to fetch Google user profile.")

        info = userinfo_resp.json()
        return {
            "sub": info.get("sub"),
            "email": info.get("email"),
            "name": info.get("name") or info.get("email", "").split("@")[0],
            "picture": info.get("picture"),
            "email_verified": info.get("email_verified", True),
        }


# ==============================================================================
# Endpoints
# ==============================================================================

@auth_router.get("/config", response_model=AuthConfigResponse)
def get_auth_config() -> AuthConfigResponse:
    """Returns Google Client ID and redirect URL for frontend initialization."""
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={settings.GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline&"
        f"prompt=consent"
    )
    return AuthConfigResponse(
        google_client_id=settings.GOOGLE_CLIENT_ID,
        google_redirect_uri=settings.GOOGLE_REDIRECT_URI,
        auth_url=auth_url,
    )


@auth_router.post("/google", response_model=AuthResponse)
async def authenticate_with_google(req: GoogleAuthRequest) -> AuthResponse:
    """
    Authenticates or registers a user via Google OAuth2 / GIS.
    On first login, automatically generates a unique Patient ID, creates patient record,
    and syncs to SQLite and MongoDB Atlas.
    """
    if req.credential:
        profile = await verify_google_id_token(req.credential)
    elif req.code:
        profile = await exchange_google_code(req.code, req.redirect_uri)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'credential' or 'code' is required for Google authentication.",
        )

    google_id = profile["sub"]
    email = profile["email"].lower().strip()
    name = profile["name"]
    picture = profile.get("picture")
    now_iso = datetime.now(timezone.utc).isoformat()

    is_new = False

    with db_session() as conn:
        cursor = conn.cursor()

        # 1. Check if user already exists by google_id or email
        cursor.execute("SELECT * FROM users WHERE google_id = ? OR email = ?;", (google_id, email))
        user_row = cursor.fetchone()

        if user_row:
            user_data = dict(user_row)
            user_id = user_data["user_id"]
            patient_id = user_data.get("patient_id")

            # Update profile info
            cursor.execute(
                """
                UPDATE users
                SET google_id = ?, full_name = ?, picture = ?, updated_at = ?
                WHERE user_id = ?;
                """,
                (google_id, name, picture, now_iso, user_id),
            )

            # Ensure patient record exists
            if patient_id:
                cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
                patient_row = cursor.fetchone()
            else:
                patient_row = None

            if not patient_row:
                # User had no patient record yet -> generate and link
                patient_id = generate_unique_patient_id()
                due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
                cursor.execute(
                    """
                    INSERT INTO patients (
                        patient_id, full_name, email, age, gender, contact_phone,
                        condition_summary, risk_tier, assigned_worker, consent_given,
                        follow_up_due_date, follow_up_type, telegram_opt_in,
                        user_id, profile_picture, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?, ?, ?);
                    """,
                    (
                        patient_id,
                        name,
                        email,
                        45,
                        "Not Specified",
                        None,
                        "Registered via Google Authentication",
                        "Moderate",
                        "Nurse Sunita Sharma",
                        due_date,
                        "Routine Check-in",
                        user_id,
                        picture,
                        now_iso,
                        now_iso,
                    ),
                )
                cursor.execute("UPDATE users SET patient_id = ? WHERE user_id = ?;", (patient_id, user_id))
                cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
                patient_row = cursor.fetchone()
            else:
                # Update existing patient's email and picture
                cursor.execute(
                    "UPDATE patients SET email = ?, profile_picture = ?, updated_at = ? WHERE patient_id = ?;",
                    (email, picture, now_iso, patient_id),
                )
                cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
                patient_row = cursor.fetchone()

        else:
            # 2. Brand new user registration
            is_new = True
            user_id = f"usr_{uuid.uuid4().hex[:12]}"
            patient_id = generate_unique_patient_id()
            due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

            # Insert patient record
            cursor.execute(
                """
                INSERT INTO patients (
                    patient_id, full_name, email, age, gender, contact_phone,
                    condition_summary, risk_tier, assigned_worker, consent_given,
                    follow_up_due_date, follow_up_type, telegram_opt_in,
                    user_id, profile_picture, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?, ?, ?);
                """,
                (
                    patient_id,
                    name,
                    email,
                    45,
                    "Not Specified",
                    None,
                    "Registered via Google Authentication",
                    "Moderate",
                    "Nurse Sunita Sharma",
                    due_date,
                    "Routine Check-in",
                    user_id,
                    picture,
                    now_iso,
                    now_iso,
                ),
            )

            # Insert user record
            cursor.execute(
                """
                INSERT INTO users (
                    user_id, google_id, email, full_name, picture, patient_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (user_id, google_id, email, name, picture, patient_id, now_iso, now_iso),
            )

            cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
            patient_row = cursor.fetchone()

        patient_dict = dict(patient_row)

    # 3. Synchronize to MongoDB Atlas
    mongodb_service.sync_patient(patient_dict)

    # 4. Issue JWT access token
    token = create_jwt_token(
        user_id=user_id,
        email=email,
        name=name,
        picture=picture,
        patient_id=patient_id,
    )

    return AuthResponse(
        token=token,
        user=UserProfileSchema(
            user_id=user_id,
            email=email,
            full_name=name,
            picture=picture,
            patient_id=patient_id,
        ),
        patient=PatientSummarySchema(**patient_dict),
        is_new_registration=is_new,
    )


@auth_router.get("/me", response_model=AuthResponse)
def get_authenticated_session(authorization: Optional[str] = Header(None)) -> AuthResponse:
    """Verifies JWT token from Authorization header and returns fresh user and patient data."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header.")

    token = authorization.split("Bearer ", 1)[1].strip()
    payload = decode_jwt_token(token)
    user_id = payload.get("sub")

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE user_id = ?;", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

        user_data = dict(user_row)
        patient_id = user_data.get("patient_id")
        cursor.execute("SELECT * FROM patients WHERE patient_id = ?;", (patient_id,))
        patient_row = cursor.fetchone()
        if not patient_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found.")

        patient_dict = dict(patient_row)

    return AuthResponse(
        token=token,
        user=UserProfileSchema(
            user_id=user_data["user_id"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            picture=user_data.get("picture"),
            patient_id=patient_dict["patient_id"],
        ),
        patient=PatientSummarySchema(**patient_dict),
        is_new_registration=False,
    )
