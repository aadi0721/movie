import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download as DownloadIcon, HardDrive, AlertCircle } from "lucide-react";
import { tmdbApi } from "@/services/tmdb";
import { getDownloads } from "@/services/downloads";
import type { DownloadLink } from "@/types/streaming";

export const Route = createFileRoute("/download/$id")({
  head: () => ({ meta: [{ title: "Download — MoviesAlert" }] }),
  component: DownloadPage,
});

function DownloadPage() {
  const { id } = Route.useParams();
  const tmdbId = Number(id);
  const details = useQuery({
    queryKey: ["details", tmdbId, "movie"],
    queryFn: () => tmdbApi.details({ data: { id: tmdbId, mediaType: "movie" } }),
  });

  // Extract title + year from TMDB details (already loaded)
  const movieTitle = details.data?.title || details.data?.name || "";
  const releaseYear = (
    details.data?.release_date || details.data?.first_air_date || ""
  ).slice(0, 4);

  const downloads = useQuery({
    queryKey: ["downloads", tmdbId, movieTitle, releaseYear],
    queryFn: () => getDownloads(tmdbId, "movie", movieTitle, releaseYear),
    // Only fetch when we have the title (avoids hitting TMDB on the backend)
    enabled: !!movieTitle,
  });

  const grouped = (downloads.data ?? []).reduce<Record<string, DownloadLink[]>>((acc, d) => {
    (acc[d.quality] ??= []).push(d);
    return acc;
  }, {});

  const hasLinks = Object.keys(grouped).length > 0;

  return (
    <div className="pt-24 pb-20 mx-auto max-w-[1100px] px-6 lg:px-10">
      <Link to="/movie/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6">
        <ArrowLeft className="size-4" /> Back to details
      </Link>
      <h1 className="text-3xl md:text-4xl font-bold text-gradient">
        Download {movieTitle}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
        {hasLinks
          ? "Select a quality tier and provider below. File sizes are approximate."
          : downloads.isLoading
            ? "Searching for download sources…"
            : ""}
      </p>

      <div className="mt-8 space-y-6">
        {downloads.isLoading && (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Resolving download sources…
            </div>
          </div>
        )}

        {!downloads.isLoading && !hasLinks && (
          <div className="glass rounded-2xl p-8 text-center space-y-3">
            <AlertCircle className="size-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              No download links found for <strong>{movieTitle}</strong>.
            </p>
            <p className="text-xs text-muted-foreground/70">
              This movie may not have been scraped yet. Links are updated automatically every 24 hours.
            </p>
          </div>
        )}

        {Object.entries(grouped).map(([quality, items]) => (
          <section key={quality} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{quality}</h2>
              <span className="text-xs text-muted-foreground">{items.length} mirror{items.length > 1 ? "s" : ""}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((d) => (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-secondary/40 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
                      <HardDrive className="size-4 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.provider}</div>
                      <div className="text-xs text-muted-foreground">{d.size} · {d.hdr ? "HDR" : "SDR"}</div>
                    </div>
                  </div>
                  <DownloadIcon className="size-4 text-muted-foreground group-hover:text-primary-glow transition" />
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
