"""Configuration-related Pydantic schemas."""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class SearchFilters(BaseModel):
    """Apollo search filters schema."""
    person_titles: Optional[List[str]] = Field(None, description="Job titles to filter by")
    organization_locations: Optional[List[str]] = Field(None, description="Organization HQ locations")
    organization_num_employees: Optional[Any] = Field(None, description="Company size filter")
    seniority: Optional[List[str]] = Field(None, description="Seniority levels")
    min_years_experience: Optional[int] = Field(None, ge=0, le=80, description="Min total years of work experience")
    max_years_experience: Optional[int] = Field(None, ge=0, le=80, description="Max total years of work experience")
    per_page: Optional[int] = Field(100, ge=1, le=100, description="Results per page (1-100)")


class ConfigResponse(BaseModel):
    """Configuration response schema."""
    target_companies: List[str]
    target_states: List[str]
    search_filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    last_ingestion: Optional[datetime] = None
    last_detection: Optional[datetime] = None


class CompanyListRequest(BaseModel):
    """Request schema for setting company list."""
    companies: List[str] = Field(..., min_length=1, description="List of company names to track")


class StateListRequest(BaseModel):
    """Request schema for setting state list."""
    states: List[str] = Field(default_factory=list, description="US state codes (e.g., CA, NY); empty = all US")


class SearchFiltersUpdate(BaseModel):
    """Request schema for updating search filters."""
    person_titles: Optional[List[str]] = Field(None, description="Job titles to filter by")
    organization_locations: Optional[List[str]] = Field(None, description="Organization HQ locations")
    organization_num_employees: Optional[Any] = Field(None, description="Company size filter")
    seniority: Optional[List[str]] = Field(None, description="Seniority levels")
    min_years_experience: Optional[int] = Field(None, ge=0, le=80, description="Min total years of work experience")
    max_years_experience: Optional[int] = Field(None, ge=0, le=80, description="Max total years of work experience")
    per_page: Optional[int] = Field(None, ge=1, le=100, description="Results per page (1-100)")

