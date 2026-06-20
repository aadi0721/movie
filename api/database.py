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

from scraper.title_parser import normalize_title


@dataclass
class DownloadLinkRow:
    """A download link from the database."""

    id: int
    quality: str
    size: str
    url: str


@dataclass
class MovieRow:
    """A movie from the database."""

    id: int
    title: str
    year: str
    page_url: str
    poster_url: str
    categories: list[str]


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


def search_movie(title: str, year: str = "") -> MovieRow | None:
    """
    Search for a movie by title (and optionally year) using multiple strategies:

    1. FTS5 full-text search (fastest, handles word order variations)
    2. Normalized LIKE search (fallback)
    3. Word-overlap scoring (handles partial title matches)

    Returns the best-matching MovieRow, or None.
    """
    conn = _connect()
    try:
        norm = normalize_title(title)

        # Strategy 1: FTS5 match
        movie = _fts_search(conn, norm, year)
        if movie:
            return movie

        # Strategy 2: LIKE search
        movie = _like_search(conn, norm, year)
        if movie:
            return movie

        # Strategy 3: Word-overlap search
        movie = _word_overlap_search(conn, norm, year)
        if movie:
            return movie

        return None
    finally:
        conn.close()


def _fts_search(conn: sqlite3.Connection, norm_title: str, year: str) -> MovieRow | None:
    """Search using FTS5 full-text index."""
    try:
        # Build FTS query: each word as a prefix match
        words = norm_title.split()
        if not words:
            return None

        fts_query = " ".join(f'"{w}"*' for w in words[:5])  # limit to 5 words

        if year:
            rows = conn.execute(
                """
                SELECT m.id, m.title, m.year, m.page_url, m.poster_url, m.categories,
                       rank
                FROM movies_fts fts
                JOIN movies m ON m.id = fts.rowid
                WHERE movies_fts MATCH ? AND m.year = ?
                ORDER BY rank
                LIMIT 5
                """,
                (fts_query, year),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT m.id, m.title, m.year, m.page_url, m.poster_url, m.categories,
                       rank
                FROM movies_fts fts
                JOIN movies m ON m.id = fts.rowid
                WHERE movies_fts MATCH ?
                ORDER BY rank
                LIMIT 5
                """,
                (fts_query,),
            ).fetchall()

        if rows:
            r = rows[0]
            return MovieRow(
                id=r["id"],
                title=r["title"],
                year=r["year"],
                page_url=r["page_url"],
                poster_url=r["poster_url"],
                categories=json.loads(r["categories"] or "[]"),
            )
    except Exception:
        pass

    return None


def _like_search(conn: sqlite3.Connection, norm_title: str, year: str) -> MovieRow | None:
    """Fallback: search using LIKE on normalized title."""
    pattern = f"%{norm_title}%"

    if year:
        rows = conn.execute(
            """
            SELECT id, title, year, page_url, poster_url, categories
            FROM movies
            WHERE title_normalized LIKE ? AND year = ?
            LIMIT 5
            """,
            (pattern, year),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, title, year, page_url, poster_url, categories
            FROM movies
            WHERE title_normalized LIKE ?
            LIMIT 5
            """,
            (pattern,),
        ).fetchall()

    if rows:
        r = rows[0]
        return MovieRow(
            id=r["id"],
            title=r["title"],
            year=r["year"],
            page_url=r["page_url"],
            poster_url=r["poster_url"],
            categories=json.loads(r["categories"] or "[]"),
        )

    return None


def _word_overlap_search(
    conn: sqlite3.Connection, norm_title: str, year: str
) -> MovieRow | None:
    """
    Last resort: fetch candidates and score by word overlap.
    Useful when TMDB title differs slightly from VegaMovies title.
    """
    target_words = set(norm_title.split())
    if not target_words:
        return None

    # Get a broader set of candidates using the first significant word
    significant_words = [w for w in target_words if len(w) > 2]
    if not significant_words:
        return None

    # Search by the longest word for best selectivity
    search_word = max(significant_words, key=len)
    pattern = f"%{search_word}%"

    if year:
        rows = conn.execute(
            """
            SELECT id, title, title_normalized, year, page_url, poster_url, categories
            FROM movies
            WHERE title_normalized LIKE ? AND year = ?
            LIMIT 50
            """,
            (pattern, year),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, title, title_normalized, year, page_url, poster_url, categories
            FROM movies
            WHERE title_normalized LIKE ?
            LIMIT 50
            """,
            (pattern,),
        ).fetchall()

    if not rows:
        return None

    # Score each candidate by word overlap (Jaccard-ish)
    best_row = None
    best_score = 0.0

    for r in rows:
        candidate_words = set(r["title_normalized"].split())
        if not candidate_words:
            continue

        overlap = len(target_words & candidate_words)
        union = len(target_words | candidate_words)
        score = overlap / union if union > 0 else 0

        if score > best_score:
            best_score = score
            best_row = r

    # Require at least 40% word overlap
    if best_row and best_score >= 0.4:
        return MovieRow(
            id=best_row["id"],
            title=best_row["title"],
            year=best_row["year"],
            page_url=best_row["page_url"],
            poster_url=best_row["poster_url"],
            categories=json.loads(best_row["categories"] or "[]"),
        )

    return None


def get_download_links(movie_id: int) -> list[DownloadLinkRow]:
    """Get all download links for a given movie ID."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT id, quality, size, url FROM download_links WHERE movie_id = ?",
            (movie_id,),
        ).fetchall()

        return [
            DownloadLinkRow(
                id=r["id"], quality=r["quality"], size=r["size"], url=r["url"]
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
            SELECT m.id, m.title, m.year, m.page_url, m.poster_url, m.categories,
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
                "page_url": r["page_url"],
                "poster_url": r["poster_url"],
                "categories": json.loads(r["categories"] or "[]"),
                "link_count": r["link_count"],
            }
            for r in rows
        ]
    finally:
        conn.close()
