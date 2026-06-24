"""
RogMovies Spider — crawls rogmovies.work to extract movie download links.

Site structure (WordPress):
  - Listing pages: /, /page/2/, /page/3/, ...
    → Each has poster-card links to detail pages
  - Detail pages: /download-movie-name-year-.../
    → <h1 class="post-title"> = full title
    → <h5> headings describe quality/size
    → <a href="..."><button class="dwd-button">Download Now</button></a>

Usage:
  scrapy crawl rogmovies                    # crawl all pages
  scrapy crawl rogmovies -a max_pages=5     # limit to 5 pages
"""

import os
import re
import sys

import scrapy
from scrapy.spiders import CrawlSpider, Rule
from scrapy.linkextractors import LinkExtractor
from scrapy.exceptions import CloseSpider

# Ensure api/ is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scraper.items import MovieItem
from scraper.title_parser import parse_quality_size, parse_title


class RogMoviesSpider(CrawlSpider):
    name = "rogmovies"
    allowed_domains = ["rogmovies.cfd", "rogmovies.cam", "rogmovies.dad", "rogmovies.men"]
    start_urls = ["https://rogmovies.cfd/"]
    
    rules = (
        Rule(LinkExtractor(allow=r'/download-'), callback='parse_detail', follow=True),
        Rule(LinkExtractor(deny=r'/(wp-admin|wp-json|author)/'), follow=True),
    )

    # Custom settings can override scraper/settings.py
    custom_settings = {
        "SCRAPY_PROJECT": "scraper",
    }
    handle_httpstatus_list = [403, 500, 502, 503, 504]

    def __init__(self, max_pages=0, db_path=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_items = int(max_pages)  # Reusing max_pages as max_items for testing
        self.items_scraped = 0
        self.db_path = db_path


    # ── Detail page parser ───────────────────────────────────────

    def parse_detail(self, response):
        """
        Parse a movie detail page to extract title, metadata, and download links.
        """
        if response.status != 200:
            self.logger.warning(
                "Got status %d for detail page %s", response.status, response.url
            )
            return

        # -- Title --
        raw_title = response.css("h1.post-title::text").get("")
        if not raw_title:
            raw_title = response.css("title::text").get("")

        title, year, season = parse_title(raw_title)

        if not title:
            self.logger.debug("Could not parse title from: %s", response.url)
            return

        # -- Poster URL --
        # RogMovies often uses TMDB images, or wp-content uploads
        poster_url = ""
        og_image = response.css('meta[property="og:image"]::attr(content)').get("")
        if og_image:
            poster_url = og_image

        # -- Categories --
        categories = []
        for tag in response.css(".post-categories .category-tag::text").getall():
            tag = tag.strip()
            if tag and tag not in ("Featured",):
                categories.append(tag)

        # -- Download links --
        download_links = self._extract_download_links(response)

        if not download_links:
            self.logger.debug("No download links found on: %s", response.url)
            return

        self.logger.info(
            "Scraped: '%s' (%s) — %d download links",
            title,
            year,
            len(download_links),
        )

        yield MovieItem(
            title=title,
            year=year,
            season=season,
            page_url=response.url,
            poster_url=poster_url,
            categories=categories,
            download_links=download_links,
        )

        self.items_scraped += 1
        if self.max_items > 0 and self.items_scraped >= self.max_items:
            raise CloseSpider(f"Reached max limit of {self.max_items} items")

    # ── Download link extraction ─────────────────────────────────

    def _extract_download_links(self, response) -> list[dict]:
        """
        Extract download links from the page body.

        Pattern on RogMovies:
          <h5>...quality info [size]...</h5>
          <p><a href="https://nexdrive.pro/..."><button class="dwd-button">Download Now</button></a></p>

        We pair each <h5> with the download button that follows it.
        """
        links = []
        page_body = response.css(".page-body, .entry-content, .post-content")

        if not page_body:
            page_body = response

        # Strategy 1: Find all dwd-button links and their preceding h5
        # Walk through all h5 elements and find the next download button
        all_h5s = page_body.css("h5")

        for h5 in all_h5s:
            heading_text = h5.css("::text").getall()
            heading_text = " ".join(heading_text).strip()

            if not heading_text:
                continue

            # Find the download button link — it's typically inside the h5
            # or in the next sibling <p> element
            download_url = h5.css("a::attr(href)").get("")

            if not download_url:
                # Look in the following sibling elements for the dwd-button
                # Use XPath to find the next sibling containing a dwd-button
                next_links = h5.xpath(
                    "following-sibling::p[position()<=2]//a[.//button[contains(@class,'dwd-button')]]/@href"
                ).getall()
                if next_links:
                    download_url = next_links[0]

            if not download_url:
                # Try: next sibling has a direct <a> link
                next_links = h5.xpath(
                    "following-sibling::p[position()<=2]//a/@href"
                ).getall()
                for url in next_links:
                    if "nexdrive" in url or "drive" in url or "gdrive" in url:
                        download_url = url
                        break

            if not download_url:
                continue

            quality, size = parse_quality_size(heading_text)

            if quality or size:
                links.append({
                    "provider": "RogMovies",
                    "quality": quality,
                    "size": size,
                    "url": download_url,
                })

        # Strategy 2: If Strategy 1 found nothing, try all dwd-button links directly
        if not links:
            for btn_link in page_body.css("a:has(button.dwd-button)"):
                url = btn_link.attrib.get("href", "")
                if not url:
                    continue

                # Try to get quality from nearest heading
                preceding_h5 = btn_link.xpath(
                    "preceding::h5[1]//text()"
                ).getall()
                heading_text = " ".join(preceding_h5).strip()
                quality, size = parse_quality_size(heading_text) if heading_text else ("", "")

                links.append({
                    "provider": "RogMovies",
                    "quality": quality or "Unknown",
                    "size": size,
                    "url": url,
                })

        # Deduplicate by URL
        seen_urls = set()
        unique_links = []
        for link in links:
            if link["url"] not in seen_urls:
                seen_urls.add(link["url"])
                unique_links.append(link)

        return unique_links
