"""Application configuration and settings."""
from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


# Get the directory where this config file is located
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database (postgres:// from some hosts → postgresql:// for SQLAlchemy)
    DATABASE_URL: str = "sqlite:///./founder_tracker.db"

    @property
    def database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            return "postgresql://" + url[10:]
        return url
    
    # API Keys
    APOLLO_API_KEY: Optional[str] = None
    RESEND_API_KEY: Optional[str] = None
    
    # Authentication
    BASIC_AUTH_USERNAME: str = "admin"
    BASIC_AUTH_PASSWORD: str = "changeme"
    
    # Email Configuration
    EMAIL_FROM: str = "notifications@example.com"
    EMAIL_TO: str = "admin@example.com"
    
    # People Data Provider
    PEOPLE_DATA_PROVIDER: str = "apollo"  # Options: apollo, proxycurl, pdl
    
    # Notification Provider
    NOTIFICATION_PROVIDER: str = "resend"  # Options: resend, slack, webhook
    
    # Scheduler
    ENABLE_SCHEDULER: bool = True
    INGESTION_CRON: str = "0 2 * * *"  # Daily at 2 AM
    DETECTION_CRON: str = "0 3 * * *"  # Daily at 3 AM

    # CORS - comma-separated origins for production (e.g. https://your-app.vercel.app)
    CORS_ORIGINS: str = ""
    
    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()

# Debug: Print loaded settings on startup (remove in production)
print(f"[Config] Loaded .env from: {BASE_DIR / '.env'}")
print(f"[Config] APOLLO_API_KEY set: {bool(settings.APOLLO_API_KEY)}")

