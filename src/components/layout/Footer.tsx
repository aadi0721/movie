export function Footer() {
  return (
    <footer className="mt-32 border-t border-border/60">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="text-lg font-bold tracking-tight">
            MOVIES<span className="text-primary">ALERT</span>
          </div>
          <p className="mt-3 text-muted-foreground max-w-xs">
            A cinematic streaming surface for the next generation of viewers.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3">Discover</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>Trending</li><li>Popular</li><li>Top Rated</li><li>Upcoming</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Library</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>Movies</li><li>TV Shows</li><li>Anime</li><li>Documentaries</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Company</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>About</li><li>Press</li><li>Careers</li><li>Contact</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} MoviesAlert. Metadata by TMDB. Streaming powered by your backend.
      </div>
    </footer>
  );
}
