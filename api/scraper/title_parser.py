"""
Utility to parse messy VegaMovies titles into clean movie names.

VegaMovies titles look like:
  "Download Mortal Kombat – 2 (2026) WEB-DL Dual Audio (Hindi DD5.1 – English) 480p [490MB] | 720p [1.1GB]..."

We extract:
  title = "Mortal Kombat 2"
  year  = "2026"
"""

import re
import html


def parse_title(raw_title: str) -> tuple[str, str]:
    """
    Parse a VegaMovies post title into (clean_title, year).

    Parameters
    ----------
    raw_title : str
        The raw h1.post-title text or post link text.

    Returns
    -------
    (title, year)
        e.g. ("Mortal Kombat II", "2026")
        year may be "" if not found.
    """
    # Decode HTML entities
    text = html.unescape(raw_title).strip()

    # Extract year from (YYYY) pattern
    year = ""
    year_match = re.search(r"\((\d{4})\)", text)
    if year_match:
        year = year_match.group(1)

    # Remove "Download " prefix (case-insensitive)
    text = re.sub(r"^download\s+", "", text, flags=re.IGNORECASE)

    # Remove everything from the first quality/codec keyword onward
    # These patterns mark where the "info junk" starts
    cut_patterns = [
        r"\s+\d{3,4}p\b",           # " 480p", " 720p", " 1080p", " 2160p"
        r"\s+WEB[-\s]?DL\b",        # " WEB-DL"
        r"\s+WEB[-\s]?Rip\b",       # " WEB-Rip"
        r"\s+BluRay\b",             # " BluRay"
        r"\s+Blu[-\s]?Ray\b",       # " Blu-Ray"
        r"\s+HDRip\b",              # " HDRip"
        r"\s+HDTS\b",               # " HDTS"
        r"\s+HQ\b",                 # " HQ"
        r"\s+HDCAM\b",              # " HDCAM"
        r"\s+CAMRip\b",             # " CAMRip"
        r"\s+Dual\s+Audio\b",       # " Dual Audio"
        r"\s+Hindi\b",              # " Hindi"
        r"\s+\(Hindi\b",            # " (Hindi"
        r"\s+English\b",            # " English"
        r"\s+Full\s+Movie\b",       # " Full Movie"
        r"\s+x26[45]\b",           # " x264", " x265"
        r"\s+HEVC\b",              # " HEVC"
        r"\s+\[",                   # " ["  (size brackets)
        r"\s+\|",                   # " |"
        r"\s+S\d{1,2}\s",          # " S01 " (season indicator)
        r"\s+S\d{1,2}$",           # " S01" at end
        r"\s+Season\s+\d",         # " Season 1"
        r"\s+Complete\b",          # " Complete"
        r"\s+AMZN\b",              # " AMZN" (Amazon tag)
        r"\s+NF\b",                # " NF" (Netflix tag)
        r"\s+DSNP\b",              # " DSNP" (Disney+ tag)
        r"\s+ATVP\b",             # " ATVP" (Apple TV+ tag)
        r"\s+NetFlix\b",           # " NetFlix"
        r"\s+Amazon\b",            # " Amazon"
        r"\s+–\s+Vegamovies",      # " – Vegamovies"
        r"\s+-\s+Vegamovies",      # " - Vegamovies"
    ]

    for pattern in cut_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            text = text[: match.start()]

    # Remove the year in parentheses from the title itself
    text = re.sub(r"\s*\(\d{4}\)\s*", " ", text)

    # Replace em-dashes and en-dashes with regular dashes
    text = text.replace("\u2013", "-").replace("\u2014", "-")

    # Clean up extra whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Remove trailing dash or colon
    text = re.sub(r"[\s\-:]+$", "", text)

    return text, year


def normalize_title(title: str) -> str:
    """
    Normalize a title for fuzzy matching / database storage.

    Lowercases, strips punctuation, collapses whitespace.
    """
    text = title.lower()
    # Remove common punctuation
    text = re.sub(r"[''\"`:;!?,.\-–—()[\]{}]", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_quality_size(heading_text: str) -> tuple[str, str]:
    """
    Parse quality and size from an <h5> download heading.

    Input:  "Mortal Kombat II (2026) {Hindi-English} 480p WEB-DL x264 [490MB]"
    Output: ("480p WEB-DL x264", "490MB")
    """
    heading = html.unescape(heading_text).strip()

    # Extract size from [brackets]
    size = ""
    size_match = re.search(r"\[([^\]]+)\]", heading)
    if size_match:
        size = size_match.group(1).strip()

    # Extract quality: look for resolution + optional codec info
    quality = ""
    quality_match = re.search(
        r"(\d{3,4}p\s*(?:WEB[-\s]?DL|BluRay|HDRip|BRRip|DVDRip)?"
        r"(?:\s*(?:10Bit|8Bit))?"
        r"(?:\s*(?:HEVC|H\.?264|H\.?265|x26[45]))?"
        r"(?:\s*(?:Atmos|DTS[-\s]?HD|DTS[-\s]?X|DD5\.1|DDP?5\.1))?)",
        heading,
        re.IGNORECASE,
    )
    if quality_match:
        quality = re.sub(r"\s+", " ", quality_match.group(1)).strip()

    # If we only got resolution, try a broader match
    if not quality:
        res_match = re.search(r"(\d{3,4}p)", heading)
        if res_match:
            quality = res_match.group(1)

    # Special: HQ-1080p or similar
    if not quality:
        hq_match = re.search(r"(HQ[-\s]?\d{3,4}p)", heading, re.IGNORECASE)
        if hq_match:
            quality = hq_match.group(1)

    return quality, size
