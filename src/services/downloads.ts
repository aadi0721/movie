import type { DownloadLink } from "@/types/streaming";

// API URL — set VITE_DOWNLOADS_API_URL in your .env to point to the backend
// Local dev:  VITE_DOWNLOADS_API_URL=http://localhost:3001
// Production: VITE_DOWNLOADS_API_URL=https://your-api.onrender.com
const API_BASE = (import.meta.env.VITE_DOWNLOADS_API_URL as string) ?? "";

/**
 * Fetch download links for a movie/show by TMDB ID.
 *
 * When `title` and `year` are provided, the backend skips
 * the TMDB lookup and searches the database directly — much faster
 * and avoids TMDB connection issues.
 */
export async function getDownloads(
  tmdbId: number,
  mediaType: "movie" | "tv" = "movie",
  title?: string,
  year?: string
): Promise<DownloadLink[]> {
  if (!API_BASE) {
    console.warn(
      "[downloads] VITE_DOWNLOADS_API_URL is not set. " +
        "Set it in .env to connect to the scraper API."
    );
    return [];
  }

  try {
    const params = new URLSearchParams({ media: mediaType });

    // Pass title directly so backend skips TMDB round-trip
    if (title) params.set("title", title);
    if (year) params.set("year", year);

    const url = `${API_BASE}/api/downloads/${tmdbId}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[downloads] API error ${res.status} for tmdbId=${tmdbId}`);
      return [];
    }

    const data = (await res.json()) as DownloadLink[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[downloads] fetch failed:", err);
    return [];
  }
}
