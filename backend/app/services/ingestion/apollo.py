"""Apollo.io API implementation."""
import httpx
import asyncio
from typing import List, Optional, Dict, Any
from app.services.ingestion.base import PeopleDataProvider
from app.schemas.profile import ProfileData, EducationData, WorkHistoryData
from app.config import settings


# Apollo person_locations require full state names: "California, US" (not "CA, US")
US_STATE_CODE_TO_NAME = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire",
    "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
    "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee",
    "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}


class ApolloProvider(PeopleDataProvider):
    """
    Apollo.io API provider implementation.
    
    Documentation: https://docs.apollo.io/reference/people-api-search
    """
    
    BASE_URL = "https://api.apollo.io/api/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Apollo provider.
        
        Args:
            api_key: Apollo API key (defaults to settings)
        """
        self.api_key = api_key or settings.APOLLO_API_KEY
        if not self.api_key:
            raise ValueError("APOLLO_API_KEY must be set")
    
    async def search_by_company(
        self, 
        company: str, 
        filters: Optional[Dict] = None
    ) -> List[ProfileData]:
        """
        Search for people by company using Apollo.io API.
        
        Uses the /mixed_people/api_search endpoint with POST request.
        
        Args:
            company: Company name to search
            filters: Additional filters including:
                - states: List of state codes (e.g., ['CA', 'NY'])
                - person_titles: List of job titles (optional)
                - organization_locations: List of org locations (optional)
                - organization_num_employees: Employee count filter (optional)
                - seniority: List of seniority levels (optional)
                - per_page: Results per page (default 100, max 100)
            
        Returns:
            List of ProfileData objects
        """
        filters = filters or {}
        
        # Build request body for Apollo API
        per_page = min(filters.get("per_page", 100), 100)  # Clamp to max 100
        body = {
            "q_organization_name": company,
            "page": 1,
            "per_page": per_page,
        }
        
        # Add person_locations for ALL states (Apollo expects "State Name, US" per docs)
        if "states" in filters and filters["states"]:
            locations = []
            for state in filters["states"]:
                code = (state or "").strip().upper()
                if not code:
                    continue
                # Use full state name if we have it, else pass through (user may have entered "California")
                name = US_STATE_CODE_TO_NAME.get(code, code if len(code) > 2 else None)
                if name:
                    locations.append(f"{name}, US")
            if locations:
                body["person_locations"] = locations
        
        # Add optional search filters
        if "person_titles" in filters and filters["person_titles"]:
            body["person_titles"] = filters["person_titles"]
        
        if "organization_locations" in filters and filters["organization_locations"]:
            body["organization_locations"] = filters["organization_locations"]
        
        if "organization_num_employees" in filters and filters["organization_num_employees"]:
            body["organization_num_employees"] = filters["organization_num_employees"]
        
        if "seniority" in filters and filters["seniority"]:
            body["person_seniorities"] = filters["seniority"]
        
        # Headers with API key (Apollo requires X-Api-Key header)
        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": self.api_key,
            "Cache-Control": "no-cache",
        }
        
        all_profiles = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            max_pages = 500
            retry_delay = 2.0
            max_retries = 3

            while body["page"] <= max_pages:
                for attempt in range(max_retries):
                    try:
                        response = await client.post(
                            f"{self.BASE_URL}/mixed_people/api_search",
                            json=body,
                            headers=headers
                        )
                        if response.status_code == 401:
                            raise ValueError(
                                "Invalid or expired Apollo API key. Check APOLLO_API_KEY in .env and ensure the key has access to People API Search."
                            )
                        if response.status_code == 429:
                            if attempt < max_retries - 1:
                                await asyncio.sleep(retry_delay * (attempt + 1))
                                continue
                            raise ValueError(
                                "Apollo API rate limit exceeded (429). Wait a few minutes and try again, or add more filters to reduce request size."
                            )
                        response.raise_for_status()
                        break
                    except ValueError:
                        raise
                    except httpx.HTTPStatusError as e:
                        if attempt < max_retries - 1 and e.response.status_code in (429, 502, 503):
                            await asyncio.sleep(retry_delay * (attempt + 1))
                            continue
                        print(f"Apollo API error: {e.response.status_code} - {e.response.text[:500]}")
                        raise

                data = response.json()
                people = data.get("people", [])
                if not people:
                    break

                for person in people:
                    profile = self._convert_apollo_person(person)
                    if profile:
                        all_profiles.append(profile)

                pagination = data.get("pagination", {})
                total_pages = pagination.get("total_pages", 1)
                if body["page"] >= total_pages or body["page"] >= max_pages:
                    break
                body["page"] += 1

        return all_profiles
    
    async def get_profile(self, profile_id: str) -> ProfileData:
        """
        Get a single profile by Apollo person ID.
        
        Args:
            profile_id: Apollo person ID
            
        Returns:
            ProfileData object
        """
        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": self.api_key,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/people/{profile_id}",
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            person = data.get("person", {})
            profile = self._convert_apollo_person(person)
            if not profile:
                raise ValueError(f"Invalid profile data for ID: {profile_id}")
            
            return profile

    async def enrich_person_by_id(
        self,
        apollo_id: str,
        reveal_personal_emails: bool = False,
    ) -> Dict[str, Any]:
        """
        Enrich a single person via Apollo People Enrichment API.
        Consumes credits.
        """
        params = {
            "id": apollo_id,
            "reveal_personal_emails": str(reveal_personal_emails).lower(),
        }
        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": self.api_key,
            "Cache-Control": "no-cache",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/people/match",
                params=params,
                headers=headers,
            )
            if response.status_code == 401:
                raise ValueError("Invalid or expired Apollo API key.")
            if response.status_code == 403:
                err = response.json() if "application/json" in response.headers.get("content-type", "") else {}
                raise ValueError(err.get("error", response.text))
            response.raise_for_status()
            return response.json()
    
    async def bulk_enrich(
        self,
        apollo_ids: List[str],
        reveal_personal_emails: bool = False,
    ) -> Dict[str, Any]:
        """
        Bulk enrich up to 10 people via Apollo Bulk People Enrichment API.
        Consumes credits. Use Apollo IDs for best match rate.

        Args:
            apollo_ids: List of Apollo person IDs (max 10)
            reveal_personal_emails: If True, request emails (consumes credits)

        Returns:
            Raw API response with matches, credits_consumed, etc.
        """
        ids = apollo_ids[:10]  # Max 10 per call
        details = [{"id": aid} for aid in ids]

        body = {"details": details}
        params = {"reveal_personal_emails": str(reveal_personal_emails).lower()}

        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": self.api_key,
            "Cache-Control": "no-cache",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/people/bulk_match",
                json=body,
                params=params,
                headers=headers,
            )
            if response.status_code == 401:
                raise ValueError("Invalid or expired Apollo API key.")
            if response.status_code == 403:
                err = response.json() if "application/json" in response.headers.get("content-type", "") else {}
                raise ValueError(err.get("error", response.text))
            response.raise_for_status()
            return response.json()

    async def bulk_refresh(self, profile_ids: List[str]) -> List[ProfileData]:
        """
        Refresh multiple profiles in bulk.
        
        Args:
            profile_ids: List of Apollo person IDs
            
        Returns:
            List of updated ProfileData objects
        """
        profiles = []
        # Apollo doesn't have a true bulk endpoint, so we fetch individually
        # In production, consider batching with asyncio.gather
        for profile_id in profile_ids:
            try:
                profile = await self.get_profile(profile_id)
                profiles.append(profile)
            except Exception as e:
                # Log error but continue with other profiles
                print(f"Error refreshing profile {profile_id}: {e}")
                continue
        
        return profiles
    
    def _convert_apollo_person(self, person: dict) -> Optional[ProfileData]:
        """
        Convert Apollo.io person object to ProfileData.
        
        Handles both full person objects (from /people/{id}) and People API Search
        response format (first_name, last_name_obfuscated, organization nested).
        
        Args:
            person: Apollo person dictionary (from people array or person object)
            
        Returns:
            ProfileData object or None if invalid (missing id or name)
        """
        if not person or not isinstance(person, dict):
            return None

        raw_id = person.get("id")
        external_id = str(raw_id).strip() if raw_id is not None else ""
        # People API Search returns first_name + last_name_obfuscated; full person returns "name"
        full_name = (person.get("name") or "").strip()
        if not full_name:
            first = (person.get("first_name") or "").strip()
            last = (person.get("last_name_obfuscated") or person.get("last_name") or "").strip()
            full_name = f"{first} {last}".strip()
        if not external_id or not full_name:
            return None

        # Current company: Search returns nested organization; full person returns organization_name
        org = person.get("organization") or {}
        current_company = person.get("organization_name") or org.get("name") if isinstance(org, dict) else None

        # Education: Apollo may use "schools" (array) or "school"
        education = []
        schools = person.get("schools") or person.get("school") or []
        if isinstance(schools, dict):
            schools = [schools]
        for school in schools:
            if isinstance(school, dict) and school.get("name"):
                education.append(EducationData(
                    institution=school.get("name", ""),
                    graduation_year=school.get("graduation_year"),
                    degree_type=school.get("degree")
                ))

        # Work history: Apollo may use "experience" or "employment_history"
        work_history = []
        experiences = person.get("experience") or person.get("employment_history") or []
        for exp in experiences:
            if not isinstance(exp, dict):
                continue
            title = (exp.get("title") or "").strip()
            if not title:
                continue
            work_history.append(WorkHistoryData(
                title=title,
                company=exp.get("organization_name"),
                start_date=self._parse_date(exp.get("started_at")),
                end_date=self._parse_date(exp.get("ended_at")),
                is_current=exp.get("is_current", False)
            ))

        # Location: city_state, state, or city
        location_state = None
        location = (
            person.get("city_state")
            or person.get("state")
            or person.get("city")
            or ""
        )
        if location:
            loc_str = str(location).strip()
            parts = loc_str.split(",")
            if len(parts) > 1:
                location_state = parts[-1].strip()[:2].upper()
            elif len(loc_str) == 2:
                location_state = loc_str.upper()

        return ProfileData(
            external_id=external_id,
            full_name=full_name,
            current_title=person.get("title"),
            current_company=current_company,
            location_state=location_state,
            education=education,
            work_history=work_history
        )
    
    @staticmethod
    def _parse_date(date_str: Optional[str]):
        """Parse date string to date object."""
        if not date_str:
            return None
        try:
            from datetime import datetime
            # Apollo typically returns ISO format dates
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.date()
        except:
            return None

