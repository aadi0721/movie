"""
VegaMovies Spider — crawls vegamovies.mq to extract movie download links.

Site structure (WordPress):
  - Listing pages: /, /page/2/, /page/3/, ...
    → Each has poster-card links to detail pages
  - Detail pages: /download-movie-name-year-.../
    → <h1 class="post-title"> = full title
    → <h5> headings describe quality/size
    → <a href="..."><button class="dwd-button">Download Now</button></a>

Usage:
  scrapy crawl vegamovies                    # crawl all pages
  scrapy crawl vegamovies -a max_pages=5     # limit to 5 pages
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


class VegaMoviesSpider(CrawlSpider):
    name = "vegamovies"
    allowed_domains = ["vegamovies.mq"]
    start_urls = ["https://vegamovies.mq/"]
    
    rules = (
        # Detail pages
        Rule(LinkExtractor(allow=r'/download-'), callback='parse_detail', follow=True),
        # Broad crawl: Follow everything else (pagination, categories) except admin/API paths
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
        # VegaMovies often uses TMDB images, or wp-content uploads
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

        Pattern on VegaMovies:
          <h5>...quality info [size]...</h5>
          <p><a href="https://nexdrive.pro/..."><button class="dwd-button">Download Now</button></a></p>

        We pair each <h5> with the download buttons that follow it.
        """
        links = []
        page_body = response.css(".page-body, .entry-content, .post-content")

        if not page_body:
            page_body = response

        all_h5s = page_body.css("h5")

        for h5 in all_h5s:
            heading_text = h5.css("::text").getall()
            heading_text = " ".join(heading_text).strip()

            if not heading_text:
                continue

            # First, check if there's an <a> inside the h5 itself
            download_url = h5.css("a::attr(href)").get("")
            if download_url:
                quality, size = parse_quality_size(heading_text)
                links.append({"provider": "VegaMovies", "quality": quality, "size": size, "url": download_url})
                continue

            # Find all a tags with .dwd-button in following siblings (up to 3 paragraphs)
            button_links = h5.xpath(
                "following-sibling::p[position()<=3]//a[.//button[contains(@class,'dwd-button')]]"
            )
            
            if not button_links:
                # Some posts don't use .dwd-button class, just direct a href
                button_links = h5.xpath(
                    "following-sibling::p[position()<=3]//a"
                )

            for a_tag in button_links:
                url = a_tag.attrib.get('href', '')
                if not url or url.startswith('#'):
                    continue

                # Filter out garbage links if it doesn't have a button class
                if not a_tag.xpath(".//button[contains(@class,'dwd-button')]"):
                    if not any(x in url for x in ("nexdrive", "drive", "mega", "vcloud", "fastserver", "clicknupload")):
                        continue

                # Extract button text to distinguish Zip, Episode 1, etc.
                btn_text = a_tag.xpath(".//text()").getall()
                btn_text = " ".join(btn_text).strip()
                
                # Exclude generic words
                if btn_text.lower() in ("download now", "download", "click here", "link"):
                    btn_text = ""

                quality, size = parse_quality_size(heading_text)
                
                if btn_text:
                    quality = f"{quality} [{btn_text}]" if quality else btn_text

                if quality or size:
                    links.append({
                        "provider": "VegaMovies",
                        "quality": quality,
                        "size": size,
                        "url": url,
                    })

        # Strategy 2: If Strategy 1 found nothing, try all dwd-button links directly
        if not links:
            for btn_link in page_body.css("a:has(button.dwd-button)"):
                url = btn_link.attrib.get("href", "")
                if not url:
                    continue

                btn_text = btn_link.xpath(".//text()").getall()
                btn_text = " ".join(btn_text).strip()
                if btn_text.lower() in ("download now", "download"):
                    btn_text = ""

                preceding_h5 = btn_link.xpath(
                    "preceding::h5[1]//text()"
                ).getall()
                heading_text = " ".join(preceding_h5).strip()
                quality, size = parse_quality_size(heading_text) if heading_text else ("", "")

                if btn_text:
                    quality = f"{quality} [{btn_text}]" if quality else btn_text

                links.append({
                    "provider": "VegaMovies",
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
