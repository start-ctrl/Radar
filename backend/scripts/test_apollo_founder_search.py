#!/usr/bin/env python3
"""
One-time Apollo API verification: People API Search for 10 founders.
Uses 0 credits (People API Search does not consume credits per Apollo docs).
"""
import asyncio
import json
import os
import sys
from pathlib import Path

# Add backend to path for app imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_KEY = os.getenv("APOLLO_API_KEY")
BASE_URL = "https://api.apollo.io/api/v1"


async def test_founder_search():
    """Single People API Search call for 10 founders matching ideal profile."""
    if not API_KEY:
        print("ERROR: APOLLO_API_KEY not set in backend/.env")
        sys.exit(1)

    # Ideal founder profile: Founder/Co-Founder/CEO in California
    # People API Search = 0 credits (Bulk Enrichment would consume credits - we avoid it)
    body = {
        "person_titles": ["Founder", "Co-Founder", "CEO"],
        "person_seniorities": ["founder", "owner", "c_suite"],
        "person_locations": ["California, US"],
        "per_page": 10,
        "page": 1,
    }

    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY,
        "Cache-Control": "no-cache",
    }

    print("Calling Apollo People API Search (0 credits)...")
    print(f"Filters: founders in California, per_page=10\n")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/mixed_people/api_search",
            json=body,
            headers=headers,
        )

    if response.status_code == 401:
        print("ERROR: Invalid or expired API key (401)")
        sys.exit(1)
    if response.status_code == 403:
        try:
            err = response.json()
            msg = err.get("error") or err.get("message", str(err))
        except Exception:
            msg = response.text
        print(f"ERROR: API key lacks access (403): {msg}")
        print("\nPeople API Search requires a PAID Apollo plan with a MASTER API key.")
        print("1. Go to https://app.apollo.io/#/settings/api - create/use a Master API key")
        print("2. Ensure your plan includes People API Search (not available on free tier)")
        print("3. Update APOLLO_API_KEY in backend/.env with the new key")
        sys.exit(1)
    if response.status_code == 429:
        print("ERROR: Rate limit exceeded (429)")
        sys.exit(1)
    response.raise_for_status()

    data = response.json()
    people = data.get("people", [])
    total = data.get("total_entries", 0)

    print(f"SUCCESS: API returned {len(people)} founders (total matching: {total})\n")
    print("=" * 60)
    for i, p in enumerate(people, 1):
        name = f"{p.get('first_name', '')} {p.get('last_name_obfuscated', '')}"
        title = p.get("title") or "(no title)"
        org = (p.get("organization") or {}).get("name", "N/A")
        print(f"{i}. {name}")
        print(f"   Title: {title}")
        print(f"   Company: {org}")
        print()
    print("=" * 60)
    print("Apollo People API Search is working. Credits used: 0")


if __name__ == "__main__":
    asyncio.run(test_founder_search())
