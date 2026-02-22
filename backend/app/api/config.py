"""Configuration API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_credentials
from app.models import TrackingMetadata
from app.schemas.config import ConfigResponse, CompanyListRequest, StateListRequest, SearchFiltersUpdate


router = APIRouter()


@router.get("", response_model=ConfigResponse)
async def get_config(
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    Get current tracking configuration.
    
    Args:
        db: Database session
        username: Authenticated username
        
    Returns:
        Current configuration
    """
    config = db.query(TrackingMetadata).first()
    
    if not config:
        # Return default empty config
        return ConfigResponse(
            target_companies=[],
            target_states=[],
            search_filters={},
            last_ingestion=None,
            last_detection=None,
        )
    
    return ConfigResponse(
        target_companies=config.target_companies or [],
        target_states=config.target_states or [],
        search_filters=config.search_filters or {},
        last_ingestion=config.last_ingestion,
        last_detection=config.last_detection,
    )


@router.post("/companies")
async def set_companies(
    request: CompanyListRequest,
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    Set target company list.
    
    Args:
        request: Company list request
        db: Database session
        username: Authenticated username
        
    Returns:
        Success message
    """
    config = db.query(TrackingMetadata).first()
    
    if not config:
        config = TrackingMetadata(
            target_companies=request.companies,
            target_states=[],
        )
        db.add(config)
    else:
        config.target_companies = request.companies
    
    db.commit()
    
    return {
        "message": "Companies updated",
        "companies": request.companies,
        "count": len(request.companies),
    }


@router.patch("/states")
async def set_states(
    request: StateListRequest,
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    Set target state list.
    
    Args:
        request: State list request
        db: Database session
        username: Authenticated username
        
    Returns:
        Success message
    """
    # Validate state codes (basic validation - 2 uppercase letters)
    for state in request.states:
        if len(state) != 2 or not state.isalpha():
            raise HTTPException(
                status_code=400,
                detail=f"Invalid state code: {state}. Must be 2-letter US state code (e.g., CA, NY)."
            )
    
    config = db.query(TrackingMetadata).first()
    
    if not config:
        config = TrackingMetadata(
            target_companies=[],
            target_states=[s.upper() for s in request.states],
        )
        db.add(config)
    else:
        config.target_states = [s.upper() for s in request.states]
    
    db.commit()
    
    return {
        "message": "States updated",
        "states": [s.upper() for s in request.states],
        "count": len(request.states),
    }


@router.patch("/search-filters")
async def update_search_filters(
    request: SearchFiltersUpdate,
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    Update Apollo search filters.
    
    Args:
        request: Search filters update request
        db: Database session
        username: Authenticated username
        
    Returns:
        Updated configuration
    """
    config = db.query(TrackingMetadata).first()
    
    if not config:
        config = TrackingMetadata(
            target_companies=[],
            target_states=[],
            search_filters={},
        )
        db.add(config)
        db.flush()
    
    # Build search filters dict from request (only include non-None values)
    filters = {}
    if request.person_titles is not None:
        filters["person_titles"] = request.person_titles
    if request.organization_locations is not None:
        filters["organization_locations"] = request.organization_locations
    if request.organization_num_employees is not None:
        filters["organization_num_employees"] = request.organization_num_employees
    if request.seniority is not None:
        filters["seniority"] = request.seniority
    if request.per_page is not None:
        filters["per_page"] = request.per_page
    
    config.search_filters = filters
    db.commit()
    db.refresh(config)
    
    return {
        "message": "Search filters updated",
        "search_filters": filters,
    }

