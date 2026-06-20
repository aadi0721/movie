"""
Scrapy Item definitions for VegaMovies data.
"""

import scrapy


class DownloadLinkItem(scrapy.Item):
    """A single download link extracted from a movie detail page."""

    quality = scrapy.Field()  # e.g. "480p WEB-DL x264"
    size = scrapy.Field()     # e.g. "490MB"
    url = scrapy.Field()      # e.g. "https://nexdrive.pro/genxfm..."


class MovieItem(scrapy.Item):
    """A movie/series entry scraped from VegaMovies."""

    title = scrapy.Field()           # Clean movie name, e.g. "Mortal Kombat II"
    year = scrapy.Field()            # e.g. "2026"
    page_url = scrapy.Field()        # Full VegaMovies URL for this movie
    poster_url = scrapy.Field()      # Poster image URL (if found)
    categories = scrapy.Field()      # List of category strings
    download_links = scrapy.Field()  # List of dicts: {quality, size, url}
