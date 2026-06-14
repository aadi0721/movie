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
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="shrink-0 self-end md:self-auto"
          >
            <div className="relative w-[200px] md:w-[260px] aspect-[2/3] rounded-2xl overflow-hidden shadow-card border border-white/10">
              {data.poster_path && (
                <img src={posterUrl(data.poster_path, "w500") ?? ""} alt={title} className="w-full h-full object-cover" />
              )}
              <Link
                to="/watch/$id"
                params={{ id }}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all group"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
                  <Play className="size-6 fill-white text-white ml-1" />
                </div>
              </Link>
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <span className="text-[10px] tracking-[0.25em] uppercase text-white/70 font-medium">{title}</span>
              </div>
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
              <img src={logoUrl} alt={title} className="h-12 md:h-16 lg:h-20 w-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]" />
            ) : (
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-none text-white">{title}</h1>
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

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/watch/$id" params={{ id }} className="flex items-center gap-2.5 px-7 py-3 rounded-xl bg-gradient-primary text-white font-semibold shadow-glow hover:scale-105 transition-transform text-sm">
                <Play className="size-4 fill-white" /> Play Movie
              </Link>
              <button onClick={() => toggleWatchlist.mutate()} className="flex items-center gap-2.5 px-5 py-3 rounded-xl glass-strong font-medium hover:bg-secondary transition text-sm text-white">
                {watchlist.data ? <Check className="size-4 text-primary-glow" /> : <Plus className="size-4" />} My List
              </button>
              <Link to="/download/$id" params={{ id }} className="flex items-center gap-2.5 px-5 py-3 rounded-xl glass-strong font-medium hover:bg-secondary transition text-sm text-white">
                <Download className="size-4" /> Download
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TABS */}
      <div className="sticky top-16 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="w-full px-6 lg:px-10">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab ? "text-white" : "text-muted-foreground hover:text-white/80"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-primary rounded-full" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
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
                    { label: "IMDb Rating", value: `${voteAvg}/10`, icon: <Star className="size-4 fill-yellow-400 text-yellow-400" /> },
                    { label: "Runtime", value: runtime || "—", icon: <Clock className="size-4 text-blue-400" /> },
                    { label: "Release", value: year || "—", icon: <Calendar className="size-4 text-green-400" /> },
                    { label: "Genre", value: genres[0] || "—", icon: <Trophy className="size-4 text-amber-400" /> },
                  ].map((item) => (
                    <div key={item.label} className="glass rounded-xl p-4 flex items-center gap-4">
                      <div className="shrink-0">{item.icon}</div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</div>
                        <div className="mt-0.5 text-sm font-semibold text-white">{item.value}</div>
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

            {activeTab === "Downloads" && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Download Options</h2>
                <div className="space-y-4 max-w-2xl">
                  {[
                    { quality: "4K UHD (2160p)", size: "~18 GB", badges: ["HDR10+", "Dolby Vision", "DTS-X"] },
                    { quality: "1080p BluRay", size: "~8 GB", badges: ["HDR", "DTS-HD"] },
                    { quality: "720p WEB-DL", size: "~3 GB", badges: ["H.264"] },
                    { quality: "480p HDRip", size: "~1.2 GB", badges: ["H.264"] },
                  ].map((item) => (
                    <div key={item.quality} className="glass rounded-2xl p-5 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white">{item.quality}</div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.badges.map((b) => (
                            <span key={b} className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary-glow border border-primary/20">{b}</span>
                          ))}
                          <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-muted-foreground">{item.size}</span>
                        </div>
                      </div>
                      <Link to="/download/$id" params={{ id }} className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-glow hover:scale-105 transition-transform">
                        <Download className="size-4" /> Download
                      </Link>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-4">Links sourced automatically. Report broken links via the Share button.</p>
                </div>
              </div>
            )}

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

      {/* STATS BAR */}
      <div className="w-full px-6 lg:px-10 mt-16">
        <div className="glass rounded-2xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-border overflow-hidden">
          {[
            { icon: <Eye className="size-5 text-blue-400" />, value: "184K", label: "Watching Now" },
            { icon: <Flame className="size-5 text-orange-400" />, value: `Trending #${Math.ceil(Math.random() * 5)}`, label: "Today" },
            { icon: <Heart className="size-5 text-pink-400" />, value: `${(data.vote_count / 1000).toFixed(1)}M`, label: "Likes" },
            { icon: <Download className="size-5 text-green-400" />, value: "18M", label: "Downloads" },
            { icon: <Calendar className="size-5 text-purple-400" />, value: "Released", label: releaseDate },
            { icon: <Trophy className="size-5 text-amber-400" />, value: "Oscar Winner", label: "Best Visual Effects" },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 py-5 px-3">
              {stat.icon}
              <div className="text-sm font-bold text-white">{stat.value}</div>
              <div className="text-xs text-muted-foreground text-center">{stat.label}</div>
            </div>
          ))}
        </div>
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
