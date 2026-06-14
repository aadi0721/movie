# MoviesAlert Downloads API

Auto-scraper backend that fetches real download links for any movie/show by TMDB ID.

## How It Works

1. Frontend calls `GET /api/downloads/:tmdbId`
2. API looks up the movie title/year from TMDB
3. Searches multiple scraper sites in parallel
4. Parses download links (GDrive, Mega, MediaFire, etc.)
5. Returns sorted, deduplicated links — cached for 24h

## Setup

```bash
cd api
npm install
cp .env.example .env
# Edit .env — add your TMDB_API_KEY
npm run dev
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/downloads/:tmdbId` | Get download links for a movie/show |
| GET | `/api/downloads/:tmdbId?media=tv` | For TV shows |
| GET | `/health` | Health check |
| DELETE | `/api/cache/:tmdbId` | Clear cached links |

## Adding More Providers

Open `index.js` and add a new object to the `PROVIDERS` array:

```js
{
  name: "YourSite",
  search: (title, year) => `https://yoursite.com/?s=${encodeURIComponent(title)}+${year}`,
  parseSearch: ($) => {
    // return array of { href, text } from search results page
    const links = [];
    $(".post-title a").each((_, el) => {
      links.push({ href: $(el).attr("href"), text: $(el).text() });
    });
    return links;
  },
  parseLinks: ($) => {
    // return array of download URLs from movie page
    const links = [];
    $("a[href*='drive.google']").each((_, el) => links.push($(el).attr("href")));
    return links;
  },
}
```

## Deploy to Render (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Select your repo, set **Root Directory** to `api`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add env var: `TMDB_API_KEY=your_key`
7. Copy the deployed URL (e.g. `https://moviesalert-api.onrender.com`)
8. Set `VITE_DOWNLOADS_API_URL` in your frontend env
