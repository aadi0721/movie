"""
Application configuration loaded from environment variables / .env file.
"""

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    All settings are read from environment variables.
    A .env file in the project root (one level up from api/) is also loaded.
    """

    # TMDB
    TMDB_API_KEY: str = ""

    # Server
    PORT: int = 3001

    # CORS — comma-separated origins
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    # Database
    DATABASE_PATH: str = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "movies.db"
    )

    # Scraper schedule
    SCRAPE_INTERVAL_HOURS: int = 24
    MAX_CRAWL_PAGES: int = 0  # 0 = unlimited

    # Target site
    VEGAMOVIES_BASE_URL: str = "https://vegamovies.mq"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {
        # Look for .env in the project root (parent of api/)
        "env_file": str(Path(__file__).resolve().parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
