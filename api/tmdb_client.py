"""
Minimal TMDB client to resolve a TMDB ID → (title, year).

Uses the same TMDB_API_KEY that the frontend already has in .env.
"""

import httpx

from config import settings

TMDB_BASE = "https://api.tmdb.org/3"


async def get_title_by_id(
    tmdb_id: int,
    media_type: str = "movie",
) -> tuple[str, str]:
    """
    Fetch the title and release year for a given TMDB ID.

    Returns
    -------
    (title, year)  e.g. ("Inception", "2010")
    """

    endpoint = f"{TMDB_BASE}/{media_type}/{tmdb_id}"
    params = {"api_key": settings.TMDB_API_KEY}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(endpoint, params=params)
        resp.raise_for_status()
        data = resp.json()

    if media_type == "tv":
        title = data.get("name", "")
        year = (data.get("first_air_date") or "")[:4]
    else:
        title = data.get("title", "")
        year = (data.get("release_date") or "")[:4]

    return title, year
