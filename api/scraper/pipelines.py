"""
Scrapy pipeline that stores scraped movies + download links into SQLite.
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone

from scraper.title_parser import normalize_title

log = logging.getLogger(__name__)


class SQLitePipeline:
    """
    Receives MovieItem objects from the spider and upserts them into SQLite.

    Database schema:
      - movies: title, year, page_url, poster, categories, timestamps
      - download_links: quality, size, url (FK → movies)
      - movies_fts: FTS5 virtual table for fast fuzzy title search
    """

    def __init__(self):
        self.conn: sqlite3.Connection | None = None
        self.items_count = 0
        self.links_count = 0

    # ── Lifecycle ────────────────────────────────────────────────

    def open_spider(self, spider):
        db_path = getattr(spider, "db_path", None) or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "movies.db",
        )
        log.info("Opening SQLite database: %s", db_path)
        self.conn = sqlite3.connect(db_path)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._create_tables()

    def close_spider(self, spider):
        if self.conn:
            self._rebuild_fts()
            self.conn.commit()
            self.conn.close()
            log.info(
                "Spider closed. Stored %d movies with %d download links.",
                self.items_count,
                self.links_count,
            )

    # ── Table creation ───────────────────────────────────────────

    def _create_tables(self):
        cur = self.conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS movies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                title_normalized TEXT NOT NULL,
                year TEXT DEFAULT '',
                page_url TEXT UNIQUE NOT NULL,
                poster_url TEXT DEFAULT '',
                categories TEXT DEFAULT '[]',
                scraped_at TEXT NOT NULL
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS download_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
                quality TEXT DEFAULT '',
                size TEXT DEFAULT '',
                url TEXT NOT NULL,
                UNIQUE(movie_id, url)
            )
        """)

        # FTS5 virtual table for fuzzy title search
        cur.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS movies_fts
            USING fts5(title_normalized, content=movies, content_rowid=id)
        """)

        # Index for year-based filtering
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year)
        """)

        self.conn.commit()

    def _rebuild_fts(self):
        """Rebuild the FTS index from the movies table."""
        try:
            cur = self.conn.cursor()
            # For content-synced FTS5 tables, use the special 'rebuild' command
            cur.execute("INSERT INTO movies_fts(movies_fts) VALUES('rebuild')")
            self.conn.commit()
            log.info("FTS index rebuilt successfully.")
        except Exception as exc:
            log.warning("FTS rebuild failed: %s", exc)

    # ── Item processing ──────────────────────────────────────────

    def process_item(self, item, spider):
        cur = self.conn.cursor()
        now = datetime.now(timezone.utc).isoformat()

        title = item.get("title", "").strip()
        if not title:
            return item

        title_norm = normalize_title(title)
        year = item.get("year", "")
        page_url = item.get("page_url", "")
        poster_url = item.get("poster_url", "")
        categories = json.dumps(item.get("categories", []))
        download_links = item.get("download_links", [])

        # Upsert movie
        try:
            cur.execute(
                """
                INSERT INTO movies (title, title_normalized, year, page_url, poster_url, categories, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(page_url) DO UPDATE SET
                    title = excluded.title,
                    title_normalized = excluded.title_normalized,
                    year = excluded.year,
                    poster_url = excluded.poster_url,
                    categories = excluded.categories,
                    scraped_at = excluded.scraped_at
                """,
                (title, title_norm, year, page_url, poster_url, categories, now),
            )
            movie_id = cur.lastrowid

            # If it was an update, fetch the existing ID
            if movie_id == 0:
                row = cur.execute(
                    "SELECT id FROM movies WHERE page_url = ?", (page_url,)
                ).fetchone()
                movie_id = row[0] if row else None

            if movie_id and download_links:
                for link in download_links:
                    try:
                        cur.execute(
                            """
                            INSERT OR IGNORE INTO download_links (movie_id, quality, size, url)
                            VALUES (?, ?, ?, ?)
                            """,
                            (
                                movie_id,
                                link.get("quality", ""),
                                link.get("size", ""),
                                link.get("url", ""),
                            ),
                        )
                        self.links_count += 1
                    except sqlite3.Error as e:
                        log.debug("Link insert skipped: %s", e)

            self.conn.commit()
            self.items_count += 1

        except sqlite3.Error as exc:
            log.error("Failed to store movie '%s': %s", title, exc)

        return item
