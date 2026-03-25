"""Profile-related API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.auth import verify_credentials
from app.models import Profile
from app.schemas.profile import (
    ProfileResponse,
    ProfileListResponse,
    EnrichProfilesRequest,
    EnrichProfilesResponse,
    EnrichedProfileResponse,
)
from app.services.ingestion.factory import get_provider
from app.services.filters.profile_filter import ProfileFilter
from app.models import TrackingMetadata, Education, WorkHistory, FounderEvent
from datetime import datetime


router = APIRouter()

ALLOWED_ENRICH_FIELDS = {
    "name",
    "title",
    "headline",
    "email",
    "linkedin_url",
    "twitter_url",
    "github_url",
    "facebook_url",
    "photo_url",
    "location",
    "organization",
    "employment_history",
}


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
    
    Fetches profiles from external API (Apollo) based on configured companies, optional state list, and search filters.
    
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
    
    if not target_companies:
        raise HTTPException(
            status_code=400,
            detail="Target companies not configured. Add at least one company in Settings."
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


@router.post("/profiles/enrich", response_model=EnrichProfilesResponse)
async def enrich_profiles(
    request: EnrichProfilesRequest,
    db: Session = Depends(get_db),
    username: str = Depends(verify_credentials),
):
    """
    Enrich selected profiles from Apollo.
    Uses People Enrichment for single profile and Bulk Enrichment for multiple profiles.
    """
    # Validate requested fields
    invalid = [f for f in request.fields if f not in ALLOWED_ENRICH_FIELDS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fields: {invalid}. Allowed: {sorted(ALLOWED_ENRICH_FIELDS)}",
        )

    profiles = (
        db.query(Profile)
        .filter(Profile.id.in_(request.profile_ids))
        .all()
    )
    if not profiles:
        raise HTTPException(status_code=404, detail="No profiles found for given IDs.")

    profile_by_external = {p.external_id: p for p in profiles if p.external_id}
    if not profile_by_external:
        raise HTTPException(status_code=400, detail="Selected profiles are missing external IDs.")

    # Use API provider (must be Apollo)
    try:
        provider = get_provider()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not hasattr(provider, "enrich_person_by_id") or not hasattr(provider, "bulk_enrich"):
        raise HTTPException(
            status_code=400,
            detail="Selected provider does not support enrichment. Set PEOPLE_DATA_PROVIDER=apollo.",
        )

    external_ids = list(profile_by_external.keys())
    reveal_email = "email" in request.fields

    # Strategy selection
    strategy = request.strategy
    if strategy == "auto":
        strategy = "single" if len(external_ids) == 1 else "bulk"
    if strategy == "single" and len(external_ids) != 1:
        raise HTTPException(status_code=400, detail="Single strategy supports exactly one profile.")

    try:
        if strategy == "single":
            raw = await provider.enrich_person_by_id(
                external_ids[0],
                reveal_personal_emails=reveal_email,
            )
            person = raw.get("person") or {}
            profile = profile_by_external.get(external_ids[0])
            normalized = [_normalize_enriched_person(profile, person, request.fields, "people_enrichment")]
            credits_consumed = raw.get("credits_consumed")
            method = "people_enrichment"
        else:
            raw = await provider.bulk_enrich(
                external_ids,
                reveal_personal_emails=reveal_email,
            )
            matches = raw.get("matches") or []
            normalized = []
            for match in matches:
                ext_id = str(match.get("id") or "").strip()
                profile = profile_by_external.get(ext_id)
                if profile:
                    normalized.append(_normalize_enriched_person(profile, match, request.fields, "bulk_enrichment"))
            credits_consumed = raw.get("credits_consumed")
            method = "bulk_enrichment"
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")

    return EnrichProfilesResponse(
        requested=len(external_ids),
        enriched=len(normalized),
        method=method,
        credits_consumed=credits_consumed,
        results=normalized,
    )


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


def _normalize_enriched_person(
    profile: Profile,
    person: Dict[str, Any],
    fields: List[str],
    method: str,
) -> EnrichedProfileResponse:
    data: Dict[str, Any] = {}

    if "name" in fields:
        data["name"] = person.get("name")
    if "title" in fields:
        data["title"] = person.get("title")
    if "headline" in fields:
        data["headline"] = person.get("headline")
    if "email" in fields:
        data["email"] = person.get("email")
    if "linkedin_url" in fields:
        data["linkedin_url"] = person.get("linkedin_url")
    if "twitter_url" in fields:
        data["twitter_url"] = person.get("twitter_url")
    if "github_url" in fields:
        data["github_url"] = person.get("github_url")
    if "facebook_url" in fields:
        data["facebook_url"] = person.get("facebook_url")
    if "photo_url" in fields:
        data["photo_url"] = person.get("photo_url")
    if "location" in fields:
        data["location"] = {
            "city": person.get("city"),
            "state": person.get("state"),
            "country": person.get("country"),
        }
    if "organization" in fields:
        data["organization"] = person.get("organization")
    if "employment_history" in fields:
        data["employment_history"] = person.get("employment_history")

    return EnrichedProfileResponse(
        profile_id=profile.id,
        external_id=profile.external_id,
        method=method,
        data=data,
    )

