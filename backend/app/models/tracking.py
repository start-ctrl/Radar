"""Tracking metadata model for system configuration."""
from sqlalchemy import Column, Integer, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base


class TrackingMetadata(Base):
    """Tracking configuration and metadata model."""
    
    __tablename__ = "tracking_metadata"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Configuration - stored as JSON arrays
    target_companies = Column(JSON, nullable=False, default=list)  # List of company names
    target_states = Column(JSON, nullable=False, default=list)  # List of US state codes
    
    # Apollo search filters - optional additional search parameters
    search_filters = Column(JSON, nullable=True, default=dict)  # Dict of optional Apollo filters
    
    # Last run timestamps
    last_ingestion = Column(DateTime(timezone=True), nullable=True)
    last_detection = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<TrackingMetadata(id={self.id}, companies={len(self.target_companies or [])}, states={len(self.target_states or [])})>"

