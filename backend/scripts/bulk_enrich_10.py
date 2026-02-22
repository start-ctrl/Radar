#!/usr/bin/env python3
"""
One-time Bulk People Enrichment for first 10 profiles.
Uses exactly 1 API call, up to 10 people, with reveal_personal_emails for email.
Minimizes credits: 1 call, no waterfall, no phone.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import Profile
from app.services.ingestion.apollo import ApolloProvider
from app.config import settings


def main():
    if not settings.APOLLO_API_KEY:
        print("ERROR: APOLLO_API_KEY not set in .env")
        sys.exit(1)

    db = SessionLocal()
    try:
        # Get first 10 profiles with Apollo IDs (exclude mock)
        profiles = (
            db.query(Profile)
            .filter(~Profile.external_id.like("mock-%"))
            .order_by(Profile.updated_at.desc())
            .limit(10)
            .all()
        )

        if not profiles:
            print("No Apollo profiles in database. Run Clear & Sync first.")
            sys.exit(1)

        apollo_ids = [p.external_id for p in profiles]
        print(f"Enriching {len(apollo_ids)} profiles (1 API call, minimal credits)...")
        print(f"IDs: {apollo_ids[:3]}...")
        print()

        provider = ApolloProvider()
        result = asyncio.run(
            provider.bulk_enrich(apollo_ids, reveal_personal_emails=True)
        )

        credits = result.get("credits_consumed", "?")
        matches = result.get("matches", [])
        print(f"Credits consumed: {credits}")
        print(f"Enriched: {len(matches)} of {len(apollo_ids)}")
        print("=" * 70)

        for i, m in enumerate(matches, 1):
            print(f"\n--- Person {i} ---")
            print(f"Apollo ID:     {m.get('id')}")
            print(f"Name:          {m.get('first_name')} {m.get('last_name')}")
            print(f"Email:         {m.get('email', 'N/A')}")
            print(f"LinkedIn URL:  {m.get('linkedin_url', 'N/A')}")
            print(f"Title:         {m.get('title', 'N/A')}")
            print(f"Headline:      {m.get('headline', 'N/A')}")
            org = m.get("organization") or {}
            print(f"Company:       {org.get('name', 'N/A')}")
            print(f"Location:      {m.get('city', '')}, {m.get('state', '')} {m.get('country', '')}")
            print(f"Photo URL:     {m.get('photo_url', 'N/A')}")
            print(f"Twitter:       {m.get('twitter_url', 'N/A')}")
            print(f"GitHub:        {m.get('github_url', 'N/A')}")

        print("\n" + "=" * 70)
        print("Full JSON response saved to bulk_enrich_result.json")
        with open(Path(__file__).parent / "bulk_enrich_result.json", "w") as f:
            json.dump(result, f, indent=2)

    finally:
        db.close()


if __name__ == "__main__":
    main()
