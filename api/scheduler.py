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
    Run the VegaMovies and RogMovies spiders as subprocesses.

    We use subprocess instead of CrawlerProcess because Twisted's reactor
    cannot be restarted in the same process.
    """
    log.info("Starting Crawl for all spiders (max_pages=%d)...", max_pages)
    start = datetime.now(timezone.utc)

    api_dir = os.path.dirname(os.path.abspath(__file__))
    python = sys.executable
    db_path = os.path.join(api_dir, "movies.db")

    # Run vegamovies
    cmd_vega = [
        python, "-m", "scrapy", "crawl", "vegamovies",
        "-a", f"max_pages={max_pages}",
        "-a", f"db_path={db_path}",
        "-s", "SCRAPY_SETTINGS_MODULE=scraper.settings",
    ]
    
    # Run rogmovies
    cmd_rog = [
        python, "-m", "scrapy", "crawl", "rogmovies",
        "-a", f"max_pages={max_pages}",
        "-a", f"db_path={db_path}",
        "-s", "SCRAPY_SETTINGS_MODULE=scraper.settings",
    ]

    for cmd in (cmd_vega, cmd_rog):
        spider_name = cmd[4]
        try:
            log.info(f"Running spider: {spider_name}")
            result = subprocess.run(
                cmd,
                cwd=api_dir,
                capture_output=True,
                text=True,
                timeout=172800,  # 48 hours max
                env={**os.environ, "SCRAPY_SETTINGS_MODULE": "scraper.settings"},
            )

            if result.returncode == 0:
                log.info(f"Spider {spider_name} completed successfully")
            else:
                log.error(
                    f"Spider {spider_name} failed (exit {result.returncode}):\n{result.stderr[-2000:] if result.stderr else '(no stderr)'}"
                )

        except subprocess.TimeoutExpired:
            log.error(f"Spider {spider_name} timed out after 1 hour")
        except Exception as exc:
            log.error(f"Spider {spider_name} error: {exc}")

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log.info("Total crawl time: %.1fs", elapsed)


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
        id="multi_spider_crawl",
        name=f"Multi-Spider Crawl (every {interval_hours}h)",
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
