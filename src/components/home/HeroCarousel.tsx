import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { Play, Plus, Star } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import type { TmdbMovie } from "@/types/tmdb";
import { backdropUrl, posterUrl } from "@/services/tmdb";

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
    <section className="relative h-[85vh] min-h-[680px] w-full overflow-hidden">
      {slides.map((s, i) => (
        <motion.div
          key={`bg-${s.id}`}
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
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 w-full px-8 lg:px-16 flex items-center pb-12 pt-24 max-w-[1800px] mx-auto">
        <div className="flex w-full items-center justify-between gap-12">
          {/* Text Content */}
          <motion.div
            key={`text-${current.id}`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="max-w-3xl flex-1"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-[11px] font-bold uppercase tracking-widest text-primary-glow shadow-[0_0_20px_rgba(255,255,255,0.05)] border-white/10">
              Trending Now
            </span>
            
            <h1 className="mt-6 text-5xl md:text-7xl lg:text-[5rem] font-black tracking-tighter text-gradient leading-[1.05] drop-shadow-2xl">
              {title}
            </h1>
            
            <div className="mt-6 flex items-center gap-4 text-[15px] text-white/70 font-medium">
              {year && <span>{year}</span>}
              <span className="size-1 rounded-full bg-white/30" />
              <span className="flex items-center gap-1.5 text-white/90 font-semibold tracking-wide">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                {current.vote_average.toFixed(1)}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/20 text-white text-[11px] font-bold tracking-widest uppercase shadow-sm">
                4K HDR
              </span>
            </div>
            
            <p className="mt-6 text-lg text-white/60 line-clamp-3 max-w-2xl leading-[1.7] font-medium">
              {current.overview}
            </p>
            
            <div className="mt-10 flex flex-wrap gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                <Link
                  to="/watch/$id"
                  params={{ id: String(current.id) }}
                  className="group flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-bold shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] transition-shadow duration-500"
                >
                  <Play className="size-5 fill-black text-black" /> Play Now
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                <Link
                  to="/movie/$id"
                  params={{ id: String(current.id) }}
                  className="flex items-center gap-3 px-8 py-4 rounded-full glass font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-all duration-500 border border-white/10"
                >
                  <Plus className="size-5" /> More Info
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ${i === idx ? "w-12 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" : "w-6 bg-white/20 hover:bg-white/50"}`}
          />
        ))}
      </div>
    </section>
  );
}