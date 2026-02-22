"""Profile-related API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import verify_credentials
from app.models import Profile
from app.schemas.profile import ProfileResponse, ProfileListResponse
from app.services.ingestion.factory import get_provider
from app.services.filters.profile_filter import ProfileFilter
from app.models import TrackingMetadata, Education, WorkHistory, FounderEvent
from datetime import datetime


router = APIRouter()


@router.get("/profiles", response_model=ProfileListResponse)
async def list_profiles(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    List tracked profiles with pagination.
    
    Args:
        page: Page number (1-indexed)
        page_size: Number of items per page
        db: Database session
        username: Authenticated username
        
    Returns:
        Paginated list of profiles
    """
    offset = (page - 1) * page_size
    
    # Get total count
    total = db.query(Profile).count()
    
    # Get paginated profiles
    profiles = (
        db.query(Profile)
        .order_by(Profile.updated_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    
    return ProfileListResponse(
        profiles=[ProfileResponse.model_validate(p) for p in profiles],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/profiles/clear")
async def clear_profiles(
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    Clear all profiles and related data (education, work history, founder events).
    Use this to remove mock/old data before syncing fresh Apollo data.
    """
    # Delete in order: founder_events, education, work_history, profiles
    db.query(FounderEvent).delete()
    db.query(Education).delete()
    db.query(WorkHistory).delete()
    deleted = db.query(Profile).delete()
    db.commit()
    return {"message": "Profiles cleared", "deleted": deleted}


@router.post("/profiles/ingest")
async def trigger_ingestion(
    clear_first: bool = Query(False, description="Clear existing profiles before syncing (removes mock/old data)"),
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    Manually trigger profile ingestion.
    
    Fetches profiles from external API (Apollo) based on configured companies and states.
    
    Args:
        clear_first: If True, clears all existing profiles before syncing (use to replace mock data)
        db: Database session
        username: Authenticated username
        
    Returns:
        Success message with count of ingested profiles
    """
    if clear_first:
        db.query(FounderEvent).delete()
        db.query(Education).delete()
        db.query(WorkHistory).delete()
        db.query(Profile).delete()
        db.commit()

    # Get tracking configuration
    config = db.query(TrackingMetadata).first()
    if not config:
        raise HTTPException(
            status_code=400,
            detail="Tracking configuration not set. Please configure companies and states first."
        )
    
    target_companies = config.target_companies or []
    target_states = config.target_states or []
    search_filters = config.search_filters or {}
    
    if not target_companies or not target_states:
        raise HTTPException(
            status_code=400,
            detail="Target companies or states not configured."
        )
    
    # Initialize provider and filter
    try:
        provider = get_provider()
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e) if "APOLLO_API_KEY" in str(e) or "API key" in str(e) else f"Configuration error: {e}. Set APOLLO_API_KEY in .env for Apollo, or PEOPLE_DATA_PROVIDER=mock to test."
        )
    
    profile_filter = ProfileFilter(
        target_companies=target_companies,
        target_states=target_states
    )
    
    # Fetch profiles (one request per company)
    all_profiles = []
    for company in target_companies:
        try:
            filters = {
                "states": target_states,
                **search_filters
            }
            profiles = await provider.search_by_company(company, filters=filters)
            all_profiles.extend(profiles)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching profiles for {company}: {str(e)}"
            )

    # Dedupe by external_id (same person can appear for multiple companies)
    seen_ids = set()
    unique_profiles = []
    for p in all_profiles:
        if p.external_id and p.external_id not in seen_ids:
            seen_ids.add(p.external_id)
            unique_profiles.append(p)

    filtered_profiles = profile_filter.filter(unique_profiles)

    # Store all profiles in one transaction
    try:
        for profile_data in filtered_profiles:
            _store_profile(db, profile_data)
        config.last_ingestion = datetime.now()
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error saving profiles: {str(e)}"
        )

    return {
        "message": "Ingestion completed",
        "total_fetched": len(all_profiles),
        "filtered": len(filtered_profiles),
        "stored": len(filtered_profiles),
    }


def _store_profile(db: Session, profile_data):
    """Store or update a profile. Does not commit; caller must commit once after all profiles."""
    profile = db.query(Profile).filter(
        Profile.external_id == profile_data.external_id
    ).first()

    if not profile:
        profile = Profile(
            external_id=profile_data.external_id,
            full_name=profile_data.full_name,
            current_title=profile_data.current_title,
            current_company=profile_data.current_company,
            location_state=profile_data.location_state,
        )
        db.add(profile)
        db.flush()
    else:
        profile.full_name = profile_data.full_name
        profile.current_title = profile_data.current_title
        profile.current_company = profile_data.current_company
        profile.location_state = profile_data.location_state

    for edu_data in profile_data.education:
        existing_edu = db.query(Education).filter(
            Education.profile_id == profile.id,
            Education.institution == edu_data.institution,
            Education.graduation_year == edu_data.graduation_year
        ).first()
        if not existing_edu:
            db.add(Education(
                profile_id=profile.id,
                institution=edu_data.institution,
                graduation_year=edu_data.graduation_year,
                degree_type=edu_data.degree_type,
            ))

    snapshot_date = datetime.now()
    for work_data in profile_data.work_history:
        db.add(WorkHistory(
            profile_id=profile.id,
            title=work_data.title,
            company=work_data.company,
            start_date=work_data.start_date,
            end_date=work_data.end_date,
            is_current=work_data.is_current,
            snapshot_date=snapshot_date,
        ))

