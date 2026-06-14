import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Play, Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { TmdbMovie } from "@/types/tmdb";
import { backdropUrl } from "@/services/tmdb";

interface Props { items: TmdbMovie[] }

export function HeroCarousel({ items }: Props) {
  const [idx, setIdx] = useState(0);
  const slides = items.slice(0, 6);

  useEffect(() => {
    if (slides.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const current = slides[idx];
  const title = current.title || current.name || "";
  const year = (current.release_date || current.first_air_date || "").slice(0, 4);

  return (
    <section className="relative h-[88vh] min-h-[620px] w-full overflow-hidden">
      {slides.map((s, i) => (
        <motion.div
          key={s.id}
          initial={false}
          animate={{ opacity: i === idx ? 1 : 0, scale: i === idx ? 1 : 1.05 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {s.backdrop_path && (
            <img
              src={backdropUrl(s.backdrop_path, "original") ?? ""}
              alt={s.title || s.name}
              className="w-full h-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          )}
        </motion.div>
      ))}

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

      <div className="relative h-full mx-auto max-w-[1600px] px-6 lg:px-10 flex items-end pb-24">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-[0.18em] text-primary-glow">
            Trending Now
          </span>
          <h1 className="mt-5 text-5xl md:text-7xl font-bold tracking-tight text-gradient leading-[1.05]">
            {title}
          </h1>
          <div className="mt-5 flex items-center gap-4 text-sm text-muted-foreground">
            {year && <span>{year}</span>}
            <span className="size-1 rounded-full bg-muted-foreground" />
            <span className="flex items-center gap-1.5">
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              {current.vote_average.toFixed(1)}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-gradient-primary text-primary-foreground text-xs font-semibold">
              4K UHD
            </span>
          </div>
          <p className="mt-5 text-base md:text-lg text-muted-foreground line-clamp-3 max-w-xl">
            {current.overview}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/watch/$id"
              params={{ id: String(current.id) }}
              className="group flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-transform"
            >
              <Play className="size-4 fill-current" /> Play Now
            </Link>
            <Link
              to="/movie/$id"
              params={{ id: String(current.id) }}
              className="flex items-center gap-2 px-6 py-3 rounded-full glass-strong font-medium hover:bg-secondary transition"
            >
              <Plus className="size-4" /> More Info
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-10 bg-primary" : "w-5 bg-white/30 hover:bg-white/50"}`}
          />
        ))}
      </div>
    </section>
  );
}
