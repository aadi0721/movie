import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Captions, Download, Maximize2, Server } from "lucide-react";
import { tmdbApi, backdropUrl } from "@/services/tmdb";
import { getSources } from "@/services/streaming";
import { updateProgress } from "@/services/history";

export const Route = createFileRoute("/watch/$id")({
  head: () => ({ meta: [{ title: "Watch — MoviesAlert" }] }),
  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const tmdbId = Number(id);
  const [theater, setTheater] = useState(false);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState("English");

  const details = useQuery({
    queryKey: ["details", tmdbId, "movie"],
    queryFn: () => tmdbApi.details({ data: { id: tmdbId, mediaType: "movie" } }),
  });

  const sources = useQuery({
    queryKey: ["sources", tmdbId],
    queryFn: () => getSources(tmdbId),
  });

  useEffect(() => {
    if (sources.data && !activeSource) setActiveSource(sources.data[0]?.id ?? null);
  }, [sources.data, activeSource]);

  // Mock auto-save progress every 15s
  useEffect(() => {
    if (!details.data) return;
    const id = setInterval(() => {
      const duration = (details.data?.runtime ?? 120) * 60;
      updateProgress({
        tmdbId,
        title: details.data?.title || details.data?.name || "Untitled",
        posterPath: details.data?.poster_path ?? null,
        backdropPath: details.data?.backdrop_path ?? null,
        watchedSeconds: Math.min(duration * 0.6, duration),
        durationSeconds: duration,
      });
    }, 15000);
    return () => clearInterval(id);
  }, [details.data, tmdbId]);

  const current = sources.data?.find((s) => s.id === activeSource);
  const title = details.data?.title || details.data?.name || "";

  return (
    <div className="pt-20 pb-20 mx-auto max-w-[1600px] px-4 lg:px-10">
      <div className="flex items-center justify-between mb-5">
        <Link
          to="/movie/$id"
          params={{ id }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4" /> Back to details
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheater((t) => !t)}
            className="flex items-center gap-2 px-3 py-2 rounded-full glass hover:bg-secondary transition text-sm"
          >
            <Maximize2 className="size-4" /> {theater ? "Exit theater" : "Theater mode"}
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${theater ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div>
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-border shadow-card">
            {current ? (
              <div className="absolute inset-0 grid place-items-center text-center px-6">
                {details.data?.backdrop_path && (
                  <img
                    src={backdropUrl(details.data.backdrop_path, "original") ?? ""}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                  />
                )}
                <div className="relative">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary-glow">Now Playing</div>
                  <div className="mt-2 text-2xl md:text-4xl font-bold">{title}</div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Streaming from <span className="text-foreground">{current.name}</span> · {current.quality} · {current.language}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/70 break-all max-w-md mx-auto">
                    Source: {current.embedUrl}
                  </div>
                  <div className="mt-5 text-xs text-muted-foreground/80">
                    Connect your backend at <code className="text-primary-glow">GET /api/player/{tmdbId}</code> to render the real embed here.
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                Loading sources…
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Captions className="size-4" />
              Subtitles
            </div>
            {["Off", "English", "Spanish", "Japanese"].map((s) => (
              <button
                key={s}
                onClick={() => setSubtitle(s)}
                className={`px-3 py-1.5 rounded-full text-xs transition ${
                  subtitle === s ? "bg-gradient-primary text-primary-foreground" : "glass hover:bg-secondary"
                }`}
              >
                {s}
              </button>
            ))}
            <Link
              to="/download/$id"
              params={{ id }}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full glass hover:bg-secondary transition text-sm"
            >
              <Download className="size-4" /> Downloads
            </Link>
          </div>

          {details.data && (
            <div className="mt-8">
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{details.data.overview}</p>
            </div>
          )}
        </div>

        {!theater && (
          <aside className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="size-4 text-primary-glow" />
              <div className="font-semibold">Servers</div>
            </div>
            <div className="space-y-2">
              {sources.data?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSource(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition ${
                    s.id === activeSource
                      ? "border-primary bg-primary/10 shadow-glow"
                      : "border-border hover:border-primary/40 hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.quality}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.language}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground/80">
              Sources resolve from your backend. Quality & subtitles switch instantly.
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
