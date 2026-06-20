"""
Background scheduler that runs the Scrapy spider periodically.

Uses APScheduler to trigger re-crawls every N hours in a background thread,
so it doesn't block the FastAPI event loop.
"""

import logging
import os
import subprocess
import sys
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def run_spider(max_pages: int = 0):
    """
    Run the VegaMovies spider as a subprocess.

    We use subprocess instead of CrawlerProcess because Twisted's reactor
    cannot be restarted in the same process.
    """
    log.info("Starting VegaMovies crawl (max_pages=%d)...", max_pages)
    start = datetime.now(timezone.utc)

    api_dir = os.path.dirname(os.path.abspath(__file__))
    python = sys.executable
    db_path = os.path.join(api_dir, "movies.db")

    cmd = [
        python,
        "-m",
        "scrapy",
        "crawl",
        "vegamovies",
        "-a",
        f"max_pages={max_pages}",
        "-a",
        f"db_path={db_path}",
        "-s",
        f"SCRAPY_SETTINGS_MODULE=scraper.settings",
    ]

    try:
        result = subprocess.run(
            cmd,
            cwd=api_dir,
            capture_output=True,
            text=True,
            timeout=3600,  # 1 hour max
            env={**os.environ, "SCRAPY_SETTINGS_MODULE": "scraper.settings"},
        )

        elapsed = (datetime.now(timezone.utc) - start).total_seconds()

        if result.returncode == 0:
            log.info("Crawl completed in %.1fs", elapsed)
        else:
            log.error(
                "Crawl failed (exit %d) after %.1fs:\n%s",
                result.returncode,
                elapsed,
                result.stderr[-2000:] if result.stderr else "(no stderr)",
            )

    except subprocess.TimeoutExpired:
        log.error("Crawl timed out after 1 hour")
    except Exception as exc:
        log.error("Crawl error: %s", exc)


def start_scheduler(interval_hours: int = 24, max_pages: int = 0):
    """
    Start the background scheduler that runs the spider every `interval_hours`.
    """
    global _scheduler

    if _scheduler is not None:
        log.warning("Scheduler already running.")
        return

    _scheduler = BackgroundScheduler(daemon=True)

    _scheduler.add_job(
        run_spider,
        trigger=IntervalTrigger(hours=interval_hours),
        kwargs={"max_pages": max_pages},
        id="vegamovies_crawl",
        name=f"VegaMovies Crawl (every {interval_hours}h)",
        replace_existing=True,
    )

    _scheduler.start()
    log.info("Scheduler started: spider will run every %d hours.", interval_hours)


def stop_scheduler():
    """Stop the background scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("Scheduler stopped.")
