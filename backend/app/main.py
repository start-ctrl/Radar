"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api import profiles, config, transitions, jobs
from app.jobs.scheduler import start_scheduler


# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="VC Founder Tracker",
    description="Internal tool for tracking founder transitions",
    version="1.0.0",
)

# CORS middleware for frontend
def _get_cors_origins():
    origins = ["http://localhost:5173", "http://localhost:3000"]
    if settings.CORS_ORIGINS:
        origins.extend(o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip())
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(profiles.router, prefix="/api", tags=["profiles"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(transitions.router, prefix="/api", tags=["transitions"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


@app.on_event("startup")
async def startup_event():
    """Startup event handler - initialize scheduler."""
    if settings.ENABLE_SCHEDULER:
        start_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    pass

