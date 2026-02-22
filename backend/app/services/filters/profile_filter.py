"""Profile filtering logic."""
from typing import List, Set
from datetime import datetime
from app.schemas.profile import ProfileData


class ProfileFilter:
    """
    Filters profiles based on company, location, and experience criteria.
    
    Filters:
    - Company: Must be current or former employee of target companies
    - Location: Must be in target US states
    - Experience: Must have >= 7 years experience (inferred from undergrad graduation)
    """
    
    def __init__(
        self,
        target_companies: List[str],
        target_states: List[str],
        min_experience_years: int = 7
    ):
        """
        Initialize filter with criteria.
        
        Args:
            target_companies: List of company names to filter by
            target_states: List of US state codes (e.g., ["CA", "NY"])
            min_experience_years: Minimum years of experience (default: 7)
        """
        self.target_companies = {c.lower().strip() for c in target_companies}
        self.target_states = {s.upper().strip() for s in target_states}
        self.min_experience_years = min_experience_years
    
    def filter(self, profiles: List[ProfileData]) -> List[ProfileData]:
        """
        Filter profiles based on configured criteria.
        
        Args:
            profiles: List of profiles to filter
            
        Returns:
            Filtered list of profiles that meet all criteria
        """
        filtered = []
        for profile in profiles:
            if self._matches_company(profile) and \
               self._matches_location(profile) and \
               self._matches_experience(profile):
                filtered.append(profile)
        
        return filtered
    
    def _matches_company(self, profile: ProfileData) -> bool:
        """
        Check if profile matches company filter.
        
        Matches if:
        - Current company is in target list, OR
        - Any past company in work history is in target list
        
        Args:
            profile: Profile to check
            
        Returns:
            True if matches company filter
        """
        # Check current company
        if profile.current_company:
            if profile.current_company.lower().strip() in self.target_companies:
                return True
        
        # Check work history
        for work in profile.work_history:
            if work.company and work.company.lower().strip() in self.target_companies:
                return True
        
        return False
    
    def _matches_location(self, profile: ProfileData) -> bool:
        """
        Check if profile matches location filter.
        
        When location is missing (People API Search may not return it), allow through
        since we already filter by person_locations in the Apollo query.
        
        Args:
            profile: Profile to check
            
        Returns:
            True if location state is in target states, or location unknown
        """
        if not profile.location_state:
            return True  # Apollo query already filtered by location
        return profile.location_state.upper().strip() in self.target_states
    
    def _matches_experience(self, profile: ProfileData) -> bool:
        """
        Check if profile matches experience filter.
        
        Experience is inferred from undergraduate graduation year:
        experience_years = current_year - graduation_year
        
        Args:
            profile: Profile to check
            
        Returns:
            True if experience >= min_experience_years
        """
        # Find undergraduate graduation year
        graduation_year = None
        
        for edu in profile.education:
            # Look for undergraduate degrees
            degree_type = (edu.degree_type or "").lower()
            if any(term in degree_type for term in ["bachelor", "undergrad", "bs", "ba"]):
                if edu.graduation_year:
                    graduation_year = edu.graduation_year
                    break
        
        # If no specific undergrad found, use earliest graduation year
        if graduation_year is None:
            graduation_years = [e.graduation_year for e in profile.education if e.graduation_year]
            if graduation_years:
                graduation_year = min(graduation_years)
        
        # When education/graduation is missing (e.g. People API Search may not return it),
        # allow profile through so we can still display results
        if graduation_year is None:
            return True

        # Calculate experience
        current_year = datetime.now().year
        experience_years = current_year - graduation_year

        return experience_years >= self.min_experience_years
    
    @staticmethod
    def calculate_experience_years(graduation_year: int) -> int:
        """
        Calculate years of experience from graduation year.
        
        Args:
            graduation_year: Year of graduation
            
        Returns:
            Years of experience
        """
        return datetime.now().year - graduation_year

