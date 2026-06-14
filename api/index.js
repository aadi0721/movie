import express from "express";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());
app.use(express.json());

// ─── PROVIDERS ────────────────────────────────────────────────────────────────
// Each provider knows how to scrape its own site.
// Add / remove providers here — the rest of the code is untouched.

const PROVIDERS = [
  {
    name: "Bolly4u",
    search: (title, year) =>
      `https://bolly4u.autos/?s=${encodeURIComponent(title)}+${year}`,
    parseSearch: ($) => {
      const links = [];
      $(".post-title a, h2.title a, article h2 a").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (href) links.push({ href, text });
      });
      return links;
    },
    parseLinks: ($) => {
      const links = [];
      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        const isDownload =
          /\.(mkv|mp4|avi|mov)/i.test(href) ||
          /gdrive|drive\.google|mega\.nz|mediafire|1fichier|pixeldrain|gofile|krakenfiles/i.test(href) ||
          /download|direct/i.test(text);
        if (isDownload && href.startsWith("http")) {
          links.push(href);
        }
      });
      return [...new Set(links)];
    },
  },
  {
    name: "Filmyzilla",
    search: (title, year) =>
      `https://filmyzilla.com.co/?s=${encodeURIComponent(title)}`,
    parseSearch: ($) => {
      const links = [];
      $(".post-title a, h2 a, .entry-title a").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (href) links.push({ href, text });
      });
      return links;
    },
    parseLinks: ($) => {
      const links = [];
      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        const isDownload =
          /\.(mkv|mp4|avi)/i.test(href) ||
          /gdrive|drive\.google|mega|mediafire|1fichier|pixeldrain|gofile/i.test(href) ||
          /download/i.test(text);
        if (isDownload && href.startsWith("http")) {
          links.push(href);
        }
      });
      return [...new Set(links)];
    },
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function detectQuality(text) {
  const t = text.toLowerCase();
  if (/2160|4k/i.test(t)) {
    if (/dolby|dv\b/i.test(t)) return "2160p Dolby Vision";
    if (/hdr/i.test(t)) return "2160p HDR";
    return "2160p";
  }
  if (/1080/i.test(t)) return "1080p";
  if (/720/i.test(t)) return "720p";
  if (/480/i.test(t)) return "480p";
  return "Unknown";
}

function detectSize(text) {
  const m = text.match(/(\d+(\.\d+)?\s*(GB|MB|gb|mb))/i);
  return m ? m[0].toUpperCase() : "—";
}

function isHdr(text) {
  return /hdr|dolby|dv\b/i.test(text);
}

// ─── IN-MEMORY CACHE (24 h TTL) ───────────────────────────────────────────────

const cache = new Map(); // tmdbId -> { data, ts }
const CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── TMDB TITLE LOOKUP ────────────────────────────────────────────────────────

async function getTitleFromTmdb(tmdbId, mediaType = "movie") {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY not set");
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=en-US`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  const data = await res.json();
  const title = data.title || data.name || "";
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  return { title, year };
}

// ─── CORE SCRAPE LOGIC ────────────────────────────────────────────────────────

async function scrapeProvider(provider, title, year) {
  const results = [];
  try {
    const searchHtml = await fetchHtml(provider.search(title, year));
    const $search = cheerio.load(searchHtml);
    const posts = provider.parseSearch($search).slice(0, 3); // top 3 matches

    for (const post of posts) {
      try {
        const postHtml = await fetchHtml(post.href);
        const $post = cheerio.load(postHtml);
        const rawLinks = provider.parseLinks($post);

        for (const href of rawLinks) {
          const pageText = $post.text() + " " + post.text;
          const quality = detectQuality(href + " " + pageText);
          const size = detectSize(pageText);
          const hdr = isHdr(href + " " + pageText);

          results.push({
            id: `${provider.name.toLowerCase()}-${Buffer.from(href).toString("base64").slice(0, 12)}`,
            quality,
            size,
            provider: provider.name,
            url: href,
            hdr,
          });
        }
      } catch (_) {
        // skip broken post pages
      }
    }
  } catch (err) {
    console.warn(`[${provider.name}] scrape failed:`, err.message);
  }
  return results;
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// GET /api/downloads/:tmdbId?media=movie|tv
app.get("/api/downloads/:tmdbId", async (req, res) => {
  const tmdbId = Number(req.params.tmdbId);
  const media = req.query.media === "tv" ? "tv" : "movie";

  if (!tmdbId || isNaN(tmdbId)) {
    return res.status(400).json({ error: "Invalid tmdbId" });
  }

  const cacheKey = `${tmdbId}-${media}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[cache hit] ${cacheKey}`);
    return res.json(cached);
  }

  try {
    const { title, year } = await getTitleFromTmdb(tmdbId, media);
    console.log(`[scraping] "${title}" (${year}) from ${PROVIDERS.length} providers...`);

    // Run all providers in parallel
    const allResults = await Promise.all(
      PROVIDERS.map((p) => scrapeProvider(p, title, year))
    );

    const links = allResults.flat();

    // Deduplicate by URL
    const seen = new Set();
    const unique = links.filter((l) => {
      if (seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    });

    // Sort: 4K first, then 1080p, 720p, 480p
    const ORDER = ["2160p Dolby Vision", "2160p HDR", "2160p", "1080p", "720p", "480p", "Unknown"];
    unique.sort((a, b) => ORDER.indexOf(a.quality) - ORDER.indexOf(b.quality));

    cacheSet(cacheKey, unique);
    console.log(`[done] ${unique.length} links for tmdbId=${tmdbId}`);
    res.json(unique);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Cache clear (for admin/testing)
app.delete("/api/cache/:tmdbId", (req, res) => {
  cache.delete(`${req.params.tmdbId}-movie`);
  cache.delete(`${req.params.tmdbId}-tv`);
  res.json({ cleared: req.params.tmdbId });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Downloads API → http://localhost:${PORT}`));
