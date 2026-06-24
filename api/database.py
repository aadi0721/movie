"""
SQLite database helper for the FastAPI server.

Provides search and lookup functions to match TMDB titles to scraped movies
and return download links.
"""

import json
import os
import re
import sqlite3
from dataclasses import dataclass

from cachetools import TTLCache, cached

from scraper.title_parser import normalize_title

_search_cache = TTLCache(maxsize=1024, ttl=600)
_links_cache = TTLCache(maxsize=1024, ttl=600)


@dataclass
class DownloadLinkRow:
    """A download link from the database."""

    id: int
    provider: str
    quality: str
    size: str
    url: str


@dataclass
class MovieRow:
    """A movie from the database."""

    id: int
    title: str
    year: str
    season: str
    page_url: str
    poster_url: str
    categories: list[str]
    tmdb_id: int | None = None


def _get_db_path() -> str:
    return os.environ.get(
        "DATABASE_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "movies.db"),
    )


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@cached(_search_cache)
def search_movies(title: str, year: str = "", media: str = "") -> list[MovieRow]:
    """
    Search for movies by title (and optionally year) using multiple strategies:

    1. FTS5 full-text search (fastest, handles word order variations)
    2. Normalized LIKE search (fallback)
    3. Word-overlap scoring (handles partial title matches)

    Returns a list of matching MovieRows.
    """
    conn = _connect()
    try:
        norm = normalize_title(title)

        # Strategy 1: FTS5 match
        movies = _fts_search(conn, norm, year)
        if movies:
            return _filter_by_media(movies, media)

        # Strategy 2: LIKE search
        movies = _like_search(conn, norm, year)
        if movies:
            return _filter_by_media(movies, media)

        # Strategy 3: Word-overlap search
        movies = _word_overlap_search(conn, norm, year)
        if movies:
            return _filter_by_media(movies, media)

        return []
    finally:
        conn.close()


def _filter_by_media(movies: list[MovieRow], media: str) -> list[MovieRow]:
    if not media or not movies:
        return movies
        
    scored = []
    for m in movies:
        is_tv = bool(m.season) or any(x in m.title.lower() for x in ["season", "episode", "series", "complete", "vol"])
        
        score = 0
        if media == "tv":
            score = 10 if is_tv else -10
        elif media == "movie":
            score = -10 if is_tv else 10
                
        scored.append((score, m))
        
    scored.sort(key=lambda x: x[0], reverse=True)
    
    # If the best match is penalized (meaning we searched for TV but only found movies),
    # drop the false positive so we don't return movies for TV series.
    best_score = scored[0][0]
    if best_score < 0:
        return []
        
    return [m for score, m in scored if score >= 0]


def _fts_search(conn: sqlite3.Connection, norm_title: str, year: str) -> list[MovieRow]:
    """Search using FTS5 full-text index."""
    try:
        # Build FTS query: each word as a prefix match
        words = norm_title.split()
        if not words:
            return []

        fts_query = " ".join(f'"{w}"*' for w in words[:5])  # limit to 5 words

        if year:
            rows = conn.execute(
                """
                SELECT m.id, m.title, m.year, m.season, m.page_url, m.poster_url, m.categories, m.tmdb_id,
                       rank
                FROM movies_fts fts
                JOIN movies m ON m.id = fts.rowid
                WHERE movies_fts MATCH ? AND m.year = ?
                ORDER BY rank
                LIMIT 20
                """,
                (fts_query, year),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT m.id, m.title, m.year, m.season, m.page_url, m.poster_url, m.categories, m.tmdb_id,
                       rank
                FROM movies_fts fts
                JOIN movies m ON m.id = fts.rowid
                WHERE movies_fts MATCH ?
                ORDER BY rank
                LIMIT 20
                """,
                (fts_query,),
            ).fetchall()

        if rows:
            return [
                MovieRow(
                    id=r["id"],
                    title=r["title"],
                    year=r["year"],
                    season=r["season"],
                    page_url=r["page_url"],
                    poster_url=r["poster_url"],
                    categories=json.loads(r["categories"] or "[]"),
                    tmdb_id=r["tmdb_id"],
                )
                for r in rows
            ]
    except Exception:
        pass

    return []


def _like_search(conn: sqlite3.Connection, norm_title: str, year: str) -> list[MovieRow]:
    """Fallback: search using LIKE on normalized title."""
    pattern = f"%{norm_title}%"

    if year:
        rows = conn.execute(
            """
            SELECT id, title, year, season, page_url, poster_url, categories, tmdb_id
            FROM movies
            WHERE title_normalized LIKE ? AND year = ?
            LIMIT 20
            """,
            (pattern, year),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, title, year, season, page_url, poster_url, categories, tmdb_id
            FROM movies
            WHERE title_normalized LIKE ?
            LIMIT 20
            """,
            (pattern,),
        ).fetchall()

    if rows:
        return [
            MovieRow(
                id=r["id"],
                title=r["title"],
                year=r["year"],
                season=r["season"],
                page_url=r["page_url"],
                poster_url=r["poster_url"],
                categories=json.loads(r["categories"] or "[]"),
                tmdb_id=r["tmdb_id"],
            )
            for r in rows
        ]

    return []


def _word_overlap_search(
    conn: sqlite3.Connection, norm_title: str, year: str
) -> list[MovieRow]:
    """
    Last resort: fetch candidates and score by word overlap.
    Useful when TMDB title differs slightly from VegaMovies title.
    """
    target_words = set(norm_title.split())
    if not target_words:
        return []

    # Get a broader set of candidates using the first significant word
    significant_words = [w for w in target_words if len(w) > 2]
    if not significant_words:
        return []

    # Search by the longest word for best selectivity
    search_word = max(significant_words, key=len)
    pattern = f"%{search_word}%"

    if year:
        rows = conn.execute(
            """
            SELECT id, title, title_normalized, year, season, page_url, poster_url, categories, tmdb_id
            FROM movies
            WHERE title_normalized LIKE ? AND year = ?
            LIMIT 50
            """,
            (pattern, year),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, title, title_normalized, year, season, page_url, poster_url, categories, tmdb_id
            FROM movies
            WHERE title_normalized LIKE ?
            LIMIT 50
            """,
            (pattern,),
        ).fetchall()

    if not rows:
        return []

    # Score each candidate by word overlap (Jaccard-ish)
    best_rows = []

    for r in rows:
        candidate_words = set(r["title_normalized"].split())
        if not candidate_words:
            continue

        overlap = len(target_words & candidate_words)
        union = len(target_words | candidate_words)
        score = overlap / union if union > 0 else 0

        # Require at least 40% word overlap
        if score >= 0.4:
            best_rows.append((score, r))
            
    # Sort by score descending
    best_rows.sort(key=lambda x: x[0], reverse=True)

    return [
        MovieRow(
            id=row["id"],
            title=row["title"],
            year=row["year"],
            season=row["season"],
            page_url=row["page_url"],
            poster_url=row["poster_url"],
            categories=json.loads(row["categories"] or "[]"),
            tmdb_id=row.get("tmdb_id"),
        )
        for _, row in best_rows
    ]

def get_movies_by_tmdb_id(tmdb_id: int) -> list[MovieRow]:
    """Fast lookup using linked TMDB ID."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT id, title, year, season, page_url, poster_url, categories, tmdb_id FROM movies WHERE tmdb_id = ?",
            (tmdb_id,),
        ).fetchall()
        
        return [
            MovieRow(
                id=r["id"],
                title=r["title"],
                year=r["year"],
                season=r["season"],
                page_url=r["page_url"],
                poster_url=r["poster_url"],
                categories=json.loads(r["categories"] or "[]"),
                tmdb_id=r["tmdb_id"],
            )
            for r in rows
        ]
    finally:
        conn.close()

def link_tmdb_id_to_movies(tmdb_id: int, movie_ids: list[int]):
    """Link a TMDB ID to one or more scraped movies for future instant lookups."""
    if not movie_ids:
        return
        
    conn = _connect()
    try:
        placeholders = ",".join("?" * len(movie_ids))
        conn.execute(
            f"UPDATE movies SET tmdb_id = ? WHERE id IN ({placeholders})",
            [tmdb_id] + movie_ids,
        )
        conn.commit()
    finally:
        conn.close()


@cached(_links_cache)
def get_download_links(movie_id: int) -> list[DownloadLinkRow]:
    """Get all download links for a given movie ID."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT id, provider, quality, size, url FROM download_links WHERE movie_id = ?",
            (movie_id,),
        ).fetchall()

        return [
            DownloadLinkRow(
                id=r["id"], provider=r["provider"], quality=r["quality"], size=r["size"], url=r["url"]
            )
            for r in rows
        ]
    finally:
        conn.close()


def get_stats() -> dict:
    """Get database stats: total movies, total links, last scrape time."""
    conn = _connect()
    try:
        movie_count = conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
        link_count = conn.execute("SELECT COUNT(*) FROM download_links").fetchone()[0]
        last_scrape = conn.execute(
            "SELECT MAX(scraped_at) FROM movies"
        ).fetchone()[0]

        return {
            "total_movies": movie_count,
            "total_links": link_count,
            "last_scrape": last_scrape,
        }
    except Exception:
        return {"total_movies": 0, "total_links": 0, "last_scrape": None}
    finally:
        conn.close()


def get_all_movies(limit: int = 100, offset: int = 0) -> list[dict]:
    """List all scraped movies (for debugging / admin)."""
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT m.id, m.title, m.year, m.season, m.page_url, m.poster_url, m.categories,
                   COUNT(dl.id) as link_count
            FROM movies m
            LEFT JOIN download_links dl ON dl.movie_id = m.id
            GROUP BY m.id
            ORDER BY m.scraped_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()

        return [
            {
                "id": r["id"],
                "title": r["title"],
                "year": r["year"],
                "season": r["season"],
                "page_url": r["page_url"],
                "poster_url": r["poster_url"],
                "categories": json.loads(r["categories"] or "[]"),
                "link_count": r["link_count"],
            }
            for r in rows
        ]
    finally:
        conn.close()
