"""
FastAPI Main Application Entrypoint
Multimodal AI Hackathon 2026 - Track A: Cardiovascular Risk Visualization & Prediction
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from apps.api.app.config import settings
from apps.api.app.auth import auth_router
from apps.api.app.db.session import init_db
from apps.api.app.integrations.telegram.bot import bot_service
from apps.api.app.integrations.telegram.router import telegram_router
from apps.api.app.routes import api_router
from apps.api.app.services.model_service import model_service
from apps.api.app.services.reminder_scheduler import reminder_scheduler
from apps.api.app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager: initializes database, models, and background services."""
    logger.info("Initializing SWASTHYA SENSE Platform...")
    try:
        # 1. Initialize SQLite Database & Synthetic Patients
        init_db()
        logger.info("Shared SQLite database initialized.")

        # 2. Load ML Models & TreeSHAP Explainers
        model_service.load_artifacts()
        logger.info("Clinical risk inference engine loaded.")

        # 3. Start Daily Reminder Scheduler
        reminder_scheduler.start()

        # 4. Start Telegram Polling if active
        if settings.TELEGRAM_ENABLED and not settings.TELEGRAM_DRY_RUN:
            bot_service.polling_task = asyncio.create_task(bot_service.start_polling())
            logger.info("Telegram background polling worker activated.")
        else:
            logger.info("Telegram integration operating in DRY-RUN/SIMULATION mode.")

    except Exception as e:
        logger.error(f"FATAL during SWASTHYA SENSE startup: {e}", exc_info=True)
        raise

    yield

    logger.info("Shutting down SWASTHYA SENSE services...")
    reminder_scheduler.stop()
    bot_service.stop_polling()


app = FastAPI(
    title="SWASTHYA SENSE API",
    version=settings.VERSION,
    description="SWASTHYA SENSE: Early Warning and Follow-up for High-Risk Patients. Multi-Target Risk Telemetry, 3D Digital Twin, and Automated Telegram Follow-up Engine.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for local development, production domains, and Vercel deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_clinical_disclaimer_header(request: Request, call_next):
    """Injects mandatory clinical decision-support warning header into every API response."""
    response = await call_next(request)
    response.headers["X-Application-Name"] = "SWASTHYA SENSE"
    response.headers["X-Clinical-Decision-Support"] = "True"
    response.headers["X-SaMD-Category"] = "Class-IIa-Educational-Prototype"
    return response


# Root health probe for load balancers and orchestrators
@app.get("/health", tags=["System"])
def root_health():
    return {
        "service": "SWASTHYA SENSE API",
        "status": "READY" if model_service.is_ready else "INITIALIZING",
        "version": settings.VERSION,
        "disclaimer": settings.CLINICAL_DISCLAIMER,
    }


from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

# Mount Routers (both /api and /api/v1 prefixes supported for seamless integration)
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix="/api")
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(telegram_router, prefix="/api")
app.include_router(telegram_router, prefix=settings.API_V1_STR)

# Mount production Web UI and 3D assets if build distribution exists
if settings.WEB_DIST_DIR.exists():
    logger.info(f"Mounting production Web UI from {settings.WEB_DIST_DIR}")
    assets_dir = settings.WEB_DIST_DIR / "assets"
    models_dir = settings.WEB_DIST_DIR / "models"
    
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    if models_dir.exists():
        app.mount("/models", StaticFiles(directory=str(models_dir)), name="models")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("redoc") or full_path.startswith("health"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        file_path = settings.WEB_DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(settings.WEB_DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.app.main:app", host="0.0.0.0", port=8000, reload=True)
