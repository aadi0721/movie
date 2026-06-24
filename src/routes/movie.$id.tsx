import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Download, Play, Plus, Star,
  Trophy, Eye, Heart, ChevronRight, ChevronLeft,
  Check, Flame
} from "lucide-react";
import { useState, useRef } from "react";
import type React from "react";
import { z } from "zod";
import { tmdbApi, backdropUrl, posterUrl } from "@/services/tmdb";
import { getDownloads } from "@/services/downloads";
import type { DownloadLink } from "@/types/streaming";
import { ContentRow } from "@/components/home/ContentRow";
import { MovieCard } from "@/components/cards/MovieCard";
import { addToWatchlist, isInWatchlist, removeFromWatchlist } from "@/services/watchlist";
import { toast } from "sonner";

const search = z.object({
  media: z.enum(["movie", "tv"]).default("movie"),
});

export const Route = createFileRoute("/movie/$id")({
  validateSearch: search,
  head: () => ({
    meta: [{ title: "Details — MoviesAlert" }],
  }),
  component: MovieDetails,
});

const TABS = ["Overview", "Gallery", "Cast", "Reviews", "Downloads", "Similar"] as const;
type Tab = (typeof TABS)[number];

function MovieDetails() {
  const { id } = Route.useParams();
  const { media } = Route.useSearch();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const castRef = useRef<HTMLDivElement>(null);

  const tmdbId = Number(id);
  const { data, isLoading } = useQuery({
    queryKey: ["details", tmdbId, media],
    queryFn: () => tmdbApi.details({ data: { id: tmdbId, mediaType: media } }),
    enabled: !!tmdbId,
  });

  const watchlist = useQuery({
    queryKey: ["watchlist", "has", tmdbId],
    queryFn: () => isInWatchlist(tmdbId),
  });

  const toggleWatchlist = useMutation({
    mutationFn: async () => {
      if (!data) return;
      if (watchlist.data) {
        await removeFromWatchlist(`wl_${tmdbId}`);
        toast("Removed from watchlist");
      } else {
        await addToWatchlist({
          tmdbId,
          title: data.title || data.name || "",
          posterPath: data.poster_path,
        });
        toast.success("Added to watchlist");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-10">
        <div className="animate-pulse space-y-6">
          <div className="h-[60vh] bg-surface rounded-2xl" />
          <div className="h-8 bg-surface rounded w-1/3" />
          <div className="h-4 bg-surface rounded w-2/3" />
        </div>
      </div>
    );
  }

  const title = data.title || data.name || "";
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : "";
  const genres = data.genres?.map((g: any) => g.name) ?? [];
  const director = data.credits?.crew.find((c: any) => c.job === "Director");
  const writers = data.credits?.crew.filter((c: any) => c.job === "Screenplay" || c.job === "Writer").slice(0, 2) ?? [];
  const stars = data.credits?.cast.slice(0, 3) ?? [];
  const languages = data.spoken_languages?.map((l: any) => l.english_name) ?? [];
  const voteAvg = data.vote_average?.toFixed(1) ?? "—";
  const voteCount = data.vote_count ? `${(data.vote_count / 1000).toFixed(1)}K` : "—";
  const releaseDate = data.release_date ? new Date(data.release_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const logo = data.images?.logos && data.images.logos[0];
  const logoUrl = logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : null;

  const scrollCast = (dir: "left" | "right") => {
    if (castRef.current) {
      castRef.current.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
    }
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* HERO */}
      <section className="relative min-h-screen overflow-hidden">
        {data.backdrop_path && (
          <img
            src={backdropUrl(data.backdrop_path, "original") ?? ""}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent" />

        <div className="absolute inset-0 w-full px-6 lg:px-10 pt-28 pb-16 flex flex-col md:flex-row gap-10 items-end md:items-center">
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="shrink-0 self-end md:self-auto relative group z-10"
          >
            {/* Ambient glow behind poster */}
            <div className="absolute -inset-4 bg-primary-glow/15 blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-60 transition-opacity duration-700" />
            <div className="relative w-[200px] md:w-[260px] lg:w-[300px] aspect-[2/3] rounded-[1.5rem] overflow-hidden shadow-card shadow-black/80 ring-1 ring-white/20 transition-transform duration-500 hover:scale-[1.02]">
              {data.poster_path && (
                <img src={posterUrl(data.poster_path, "w500") ?? ""} alt={title} className="w-full h-full object-cover" />
              )}
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex-1 min-w-0"
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {["4K UHD", "HDR10+", "Dolby Vision"].map((badge) => (
                <span key={badge} className="px-2.5 py-0.5 text-xs font-semibold rounded border border-white/25 bg-white/10 text-white/90 tracking-wide">
                  {badge}
                </span>
              ))}
            </div>

            {logoUrl ? (
              <img src={logoUrl} alt={title} className="h-14 md:h-20 lg:h-24 w-auto object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.8)]" />
            ) : (
              <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-black tracking-tighter leading-[1.1] text-gradient">{title}</h1>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/60">
              <span className="text-white/80 font-medium">{year}</span>
              {runtime && <><span>•</span><span>{runtime}</span></>}
              {genres.length > 0 && <><span>•</span><span>{genres.join(", ")}</span></>}
              {voteAvg !== "—" && (
                <><span>•</span>
                  <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                    <Star className="size-3.5 fill-yellow-400" /> {voteAvg}/10
                  </span>
                  <span className="text-white/40 text-xs">IMDb</span>
                </>
              )}
            </div>

            <p className="mt-5 max-w-2xl text-sm md:text-base text-white/65 leading-relaxed line-clamp-3">{data.overview}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <RatingCard icon={<Star className="size-4 fill-yellow-400 text-yellow-400" />} score={voteAvg} label="IMDb" sublabel="/10" />
              <RatingCard icon={<span className="text-red-500 text-base">🍅</span>} score={data.vote_average ? `${Math.round(data.vote_average * 10)}%` : "—"} label="Tomatometer" />
              <RatingCard icon={<Eye className="size-4 text-blue-400" />} score={voteCount} label="Votes" />
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/watch/$id" params={{ id }} className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-primary text-white font-bold shadow-glow hover:scale-[1.03] transition-all ring-glow">
                <Play className="size-5 fill-white" /> Play Movie
              </Link>
              <button onClick={() => toggleWatchlist.mutate()} className="flex items-center gap-3 px-6 py-3.5 rounded-2xl glass-strong font-semibold hover:bg-white/10 hover:border-white/30 hover:scale-[1.03] transition-all text-white">
                {watchlist.data ? <Check className="size-5 text-primary-glow" /> : <Plus className="size-5" />} My List
              </button>
              <Link to="/download/$id" params={{ id }} className="flex items-center gap-3 px-6 py-3.5 rounded-2xl glass-strong font-semibold hover:bg-white/10 hover:border-white/30 hover:scale-[1.03] transition-all text-white">
                <Download className="size-5" /> Download
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TABS */}
      <div className="sticky top-16 z-30 bg-surface/40 backdrop-blur-3xl border-b border-white/5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
        <div className="w-full px-6 lg:px-10">
          <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-6 py-4 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab ? "text-white" : "text-muted-foreground hover:text-white/90"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-primary rounded-t-lg shadow-[0_-2px_10px_var(--primary-glow)]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="w-full px-6 lg:px-10 mt-8">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>

            {activeTab === "Overview" && (
              <div className="grid lg:grid-cols-[1fr_340px] gap-8">
                <div className="space-y-8">
                  <p className="text-base text-muted-foreground leading-relaxed">{data.overview}</p>
                  <div className="space-y-3">
                    <DetailRow label="Director" value={director?.name ?? "—"} />
                    {writers.length > 0 && <DetailRow label="Writers" value={writers.map((w: any) => w.name).join(", ")} />}
                    {stars.length > 0 && <DetailRow label="Stars" value={stars.map((s: any) => s.name).join(", ")} />}
                    {languages.length > 0 && <DetailRow label="Languages" value={languages.slice(0, 3).join(", ")} extra={languages.length > 3 ? `+ ${languages.length - 3} more` : undefined} />}
                    <DetailRow label="Release Date" value={releaseDate} />
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "IMDb Rating", value: `${voteAvg}/10`, icon: <Star className="size-5 fill-yellow-400 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" /> },
                    { label: "Runtime", value: runtime || "—", icon: <Clock className="size-5 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" /> },
                    { label: "Release", value: year || "—", icon: <Calendar className="size-5 text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" /> },
                    { label: "Genre", value: genres[0] || "—", icon: <Trophy className="size-5 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" /> },
                  ].map((item) => (
                    <div key={item.label} className="glass-strong rounded-2xl p-4 flex items-center gap-5 hover:border-white/20 transition-colors">
                      <div className="shrink-0 p-3 bg-surface/50 rounded-xl ring-1 ring-white/5">{item.icon}</div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-base font-bold text-white tracking-wide">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "Cast" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Top Cast</h2>
                  <div className="flex gap-2">
                    <button onClick={() => scrollCast("left")} className="p-2 glass rounded-lg hover:bg-surface-elevated transition"><ChevronLeft className="size-5" /></button>
                    <button onClick={() => scrollCast("right")} className="p-2 glass rounded-lg hover:bg-surface-elevated transition"><ChevronRight className="size-5" /></button>
                  </div>
                </div>
                <div ref={castRef} className="flex gap-4 overflow-x-auto scrollbar-none pb-4">
                  {data.credits?.cast.slice(0, 20).map((c: any) => (
                    <div key={c.id} className="shrink-0 w-[140px] glass rounded-2xl p-3 text-center">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-surface mx-auto border-2 border-border">
                        {c.profile_path ? (
                          <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl bg-surface-elevated">👤</div>
                        )}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-white truncate">{c.name}</div>
                      <div className="text-xs text-primary-glow truncate mt-0.5">{c.character}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "Downloads" && <DownloadsTab tmdbId={Number(id)} media={media} title={data?.title || data?.name || ""} year={(data?.release_date || data?.first_air_date || "").slice(0, 4)} id={id} />}

            {activeTab === "Gallery" && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Gallery</h2>
                {data.images?.backdrops?.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {data.images.backdrops.slice(0, 12).map((img: any, i: number) => (
                      <div key={i} className="aspect-video rounded-xl overflow-hidden border border-border">
                        <img src={`https://image.tmdb.org/t/p/w780${img.file_path}`} alt={`${title} still ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-16 text-center text-muted-foreground">No gallery images available.</div>
                )}
              </div>
            )}

            {activeTab === "Reviews" && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Reviews</h2>
                {data.reviews?.results?.length > 0 ? (
                  <div className="space-y-4 max-w-3xl">
                    {data.reviews.results.slice(0, 5).map((review: any) => (
                      <div key={review.id} className="glass rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-white">{review.author[0].toUpperCase()}</div>
                          <div>
                            <div className="text-sm font-semibold text-white">{review.author}</div>
                            {review.author_details?.rating && (
                              <div className="text-xs text-yellow-400 flex items-center gap-1"><Star className="size-3 fill-yellow-400" /> {review.author_details.rating}/10</div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{review.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-16 text-center text-muted-foreground">No reviews yet.</div>
                )}
              </div>
            )}

            {activeTab === "Similar" && (
              <div>
                {data.similar?.results?.length > 0 && (
                  <ContentRow title="More Like This">
                    {data.similar.results.slice(0, 18).map((m: any, i: number) => <MovieCard key={m.id} movie={m} index={i} />)}
                  </ContentRow>
                )}
                {data.recommendations?.results?.length > 0 && (
                  <ContentRow title="Recommended For You">
                    {data.recommendations.results.slice(0, 18).map((m: any, i: number) => <MovieCard key={m.id} movie={m} index={i} />)}
                  </ContentRow>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>


    </div>
  );
}

function RatingCard({ icon, score, label, sublabel }: { icon: React.ReactNode; score: string; label: string; sublabel?: string }) {
  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 min-w-[120px]">
      <div className="text-xl">{icon}</div>
      <div>
        <div className="text-lg font-bold text-white leading-none">
          {score}{sublabel && <span className="text-xs text-muted-foreground ml-0.5">{sublabel}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="shrink-0 w-28 text-muted-foreground">{label}</span>
      <span className="text-white font-medium">{value}</span>
      {extra && <span className="text-primary-glow text-xs">{extra}</span>}
    </div>
  );
}

function DownloadsTab({ tmdbId, media, title, year, id }: { tmdbId: number; media: "movie" | "tv"; title: string; year: string; id: string }) {
  const downloads = useQuery({
    queryKey: ["downloads", tmdbId, title, year],
    queryFn: () => getDownloads(tmdbId, media, title, year),
    enabled: !!title,
  });

  const grouped = (downloads.data ?? []).reduce<Record<string, DownloadLink[]>>((acc, d) => {
    (acc[d.quality] ??= []).push(d);
    return acc;
  }, {});

  const hasLinks = Object.keys(grouped).length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Download Options</h2>
        {hasLinks && (
          <Link
            to="/download/$id"
            params={{ id }}
            className="text-sm text-primary-glow hover:underline"
          >
            View all →
          </Link>
        )}
      </div>

      {downloads.isLoading && (
        <div className="glass rounded-2xl p-8 text-center">
          <div className="inline-flex items-center gap-3 text-muted-foreground">
            <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Searching for download sources…
          </div>
        </div>
      )}

      {!downloads.isLoading && !hasLinks && (
        <div className="glass rounded-2xl p-8 text-center space-y-2">
          <p className="text-muted-foreground">
            No download links available for this title yet.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Links are sourced automatically every 24 hours from VegaMovies.
          </p>
        </div>
      )}

      <div className="space-y-4 max-w-2xl">
        {Object.entries(grouped).map(([quality, items]) => (
          <div key={quality} className="glass-strong rounded-2xl p-5 border border-white/5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-lg text-white tracking-wide">{quality}</div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-surface px-3 py-1 rounded-full ring-1 ring-border">
                {items.length} source{items.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((d) => (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-4 p-4 rounded-xl bg-surface/50 border border-white/5 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 shadow-sm hover:shadow-glow"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate group-hover:text-primary-glow transition-colors">{d.provider}</div>
                    <div className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-2">
                      <span className="bg-black/30 px-2 py-0.5 rounded">{d.size}</span>
                      {d.hdr && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">HDR</span>}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-surface group-hover:bg-primary text-muted-foreground group-hover:text-white transition-colors duration-300">
                    <Download className="size-4 shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
        {hasLinks && (
          <p className="text-xs text-muted-foreground mt-4">
            Links sourced automatically from VegaMovies. Report broken links via the Share button.
          </p>
        )}
      </div>
    </div>
  );
}
