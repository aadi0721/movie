"""
MoviesAlert — Scraper API Backend (Scrapy + SQLite)

Pre-crawls VegaMovies and stores movies + download links in SQLite.
The FastAPI server matches TMDB IDs to scraped movies via fuzzy title search
and returns download links.

Endpoints:
    GET  /                          Health check + stats
    GET  /api/downloads/{tmdb_id}   Download links for a TMDB ID
    GET  /api/movies                List all scraped movies
    POST /api/scrape                Trigger a manual crawl
"""

import asyncio
import hashlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from database import get_all_movies, get_download_links, get_stats, search_movie
from scheduler import run_spider, start_scheduler, stop_scheduler
from tmdb_client import get_title_by_id

# ── Logging ──────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger("moviesalert-api")


# ── Response models ──────────────────────────────────────────────────


class DownloadLink(BaseModel):
    """Matches the frontend TypeScript DownloadLink interface."""

    id: str
    quality: str
    size: str
    provider: str
    url: str
    hdr: bool = False


# ── Lifespan ─────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the background scheduler on startup, stop on shutdown."""
    log.info("Starting background scheduler...")
    start_scheduler(
        interval_hours=settings.SCRAPE_INTERVAL_HOURS,
        max_pages=settings.MAX_CRAWL_PAGES,
    )
    yield
    log.info("Shutting down scheduler...")
    stop_scheduler()


# ── App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="MoviesAlert Downloads API",
    description="Scrapy-powered backend that serves VegaMovies download links matched by TMDB ID.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ───────────────────────────────────────────────────────────


@app.get("/")
async def root():
    """Health check with database stats."""
    stats = get_stats()
    return {
        "status": "ok",
        "service": "MoviesAlert Downloads API v2 (Scrapy + SQLite)",
        "database": stats,
    }


@app.get("/api/downloads/search", response_model=list[DownloadLink])
async def search_downloads_endpoint(
    title: str = Query(..., description="Movie title to search for"),
    year: str = Query("", description="Release year (optional)"),
):
    """
    Search download links by title directly (no TMDB involved).
    Useful when you already know the movie name.
    """
    movie = search_movie(title, year)

    if not movie and year:
        movie = search_movie(title, "")

    if not movie:
        return []

    return _format_links(get_download_links(movie.id), title)


@app.get("/api/downloads/{tmdb_id}", response_model=list[DownloadLink])
async def get_downloads_endpoint(
    tmdb_id: int,
    media: str = Query("movie", pattern="^(movie|tv)$"),
    title: str = Query("", description="Movie title (skips TMDB lookup if provided)"),
    year: str = Query("", description="Release year"),
):
    """
    Resolve download links for a given TMDB ID.

    Flow:
    1. If title is passed as query param, use it directly (fast path)
    2. Otherwise, call TMDB API to get the movie title + year
    3. Fuzzy-search the SQLite database for a matching movie
    4. Return download links from the matched entry
    """

    # 1 — Get title: prefer query param, fallback to TMDB
    if not title:
        try:
            title, year = await get_title_by_id(tmdb_id, media)
        except Exception as exc:
            log.error("TMDB lookup failed for %s: %s", tmdb_id, exc)
            raise HTTPException(
                status_code=502,
                detail=f"Could not resolve TMDB ID {tmdb_id}: {exc}",
            )

    if not title:
        raise HTTPException(status_code=404, detail="Title not found on TMDB")

    log.info("Resolving downloads for '%s' (%s) [tmdb=%d]", title, year, tmdb_id)

    # 2 — Search SQLite database
    movie = search_movie(title, year)

    if not movie:
        # Try without year as fallback
        movie = search_movie(title, "")

    if not movie:
        log.info("No match found in database for '%s' (%s)", title, year)
        return []

    log.info("Matched to: '%s' (%s) [id=%d]", movie.title, movie.year, movie.id)

    # 3 — Get download links
    return _format_links(get_download_links(movie.id), title)


def _format_links(db_links, title: str) -> list[DownloadLink]:
    """Convert database link rows to frontend DownloadLink format."""
    if not db_links:
        return []

    result = []
    for link in db_links:
        link_id = hashlib.md5(link.url.encode()).hexdigest()[:12]
        result.append(
            DownloadLink(
                id=link_id,
                quality=link.quality or "Unknown",
                size=link.size or "—",
                provider="VegaMovies",
                url=link.url,
                hdr="hdr" in (link.quality or "").lower()
                or "2160" in (link.quality or ""),
            )
        )

    log.info("Returning %d download links for '%s'", len(result), title)
    return result


@app.get("/api/movies")
async def list_movies(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """List all scraped movies (for debugging / admin)."""
    movies = get_all_movies(limit=limit, offset=offset)
    return {"count": len(movies), "movies": movies}


@app.post("/api/scrape")
async def trigger_scrape(
    background_tasks: BackgroundTasks,
    max_pages: int = Query(0, ge=0),
):
    """Trigger a manual crawl in the background."""
    background_tasks.add_task(run_spider, max_pages=max_pages)
    return {
        "status": "started",
        "message": f"Crawl started in background (max_pages={max_pages})",
    }


# ── Run with: uvicorn main:app --port 3001 --reload ──────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
    )
