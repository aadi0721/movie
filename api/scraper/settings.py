"""
Scrapy settings for the VegaMovies spider.
"""

import os
import sys

# Add the api/ directory to the path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BOT_NAME = "vegamovies_scraper"

SPIDER_MODULES = ["scraper.spiders"]
NEWSPIDER_MODULE = "scraper.spiders"

# ---------- Politeness ----------

# Don't obey robots.txt (site blocks all bots)
ROBOTSTXT_OBEY = False

# Be polite: limit concurrent requests and add delay
CONCURRENT_REQUESTS = 4
DOWNLOAD_DELAY = 1.5  # seconds between requests to same domain

# Auto-throttle: dynamically adjusts delay based on server response time
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 10.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
AUTOTHROTTLE_DEBUG = False

# ---------- Retries ----------

RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

# ---------- Timeouts ----------

DOWNLOAD_TIMEOUT = 30

# ---------- Middleware ----------

DOWNLOADER_MIDDLEWARES = {
    # Disable default UA middleware, use ours
    "scrapy.downloadermiddlewares.useragent.UserAgentMiddleware": None,
    "scraper.middlewares.RandomUserAgentMiddleware": 400,
}

# ---------- Pipeline ----------

ITEM_PIPELINES = {
    "scraper.pipelines.SQLitePipeline": 300,
}

# ---------- Output ----------

LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"

# Disable telnet console
TELNETCONSOLE_ENABLED = False

# ---------- HTTP ----------

# Some default headers to look like a browser
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# Twisted reactor (required for Windows + Scrapy)
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# Feed export encoding
FEED_EXPORT_ENCODING = "utf-8"

# ---------- Database path ----------
# Can be overridden by environment variable
DATABASE_PATH = os.environ.get(
    "DATABASE_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "movies.db"),
)
