"""Profile-related Pydantic schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date


class EducationData(BaseModel):
    """Education record data."""
    institution: str
    graduation_year: Optional[int] = None
    degree_type: Optional[str] = None


class WorkHistoryData(BaseModel):
    """Work history record data."""
    title: str
    company: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False


class ProfileData(BaseModel):
    """
    Profile data structure from external providers.
    This is the standardized format used across all providers.
    """
    external_id: str = Field(..., description="Stable ID from external provider")
    full_name: str
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    location_state: Optional[str] = Field(None, max_length=2, description="US state code (CA, NY, etc.)")
    education: List[EducationData] = Field(default_factory=list)
    work_history: List[WorkHistoryData] = Field(default_factory=list)


class ProfileResponse(BaseModel):
    """Profile response schema for API."""
    id: str
    external_id: str
    full_name: str
    current_title: Optional[str]
    current_company: Optional[str]
    location_state: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProfileListResponse(BaseModel):
    """Paginated profile list response."""
    profiles: List[ProfileResponse]
    total: int
    page: int
    page_size: int


class EnrichProfilesRequest(BaseModel):
    """Request schema for enriching selected profiles."""
    profile_ids: List[str] = Field(..., min_length=1, max_length=10)
    # UI-selected fields to return in response
    fields: List[str] = Field(default_factory=lambda: ["name", "title", "linkedin_url"])
    # auto: 1 => people enrichment, >1 => bulk enrichment
    strategy: Literal["auto", "single", "bulk"] = "auto"


class EnrichedProfileResponse(BaseModel):
    """Normalized enriched profile payload returned to frontend."""
    profile_id: str
    external_id: str
    method: Literal["people_enrichment", "bulk_enrichment"]
    data: Dict[str, Any]


class EnrichProfilesResponse(BaseModel):
    """Enrichment response for selected profiles."""
    requested: int
    enriched: int
    method: Literal["people_enrichment", "bulk_enrichment"]
    credits_consumed: Optional[int] = None
    results: List[EnrichedProfileResponse]

