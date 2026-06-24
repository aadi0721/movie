import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { Star } from "lucide-react";
import { useRef } from "react";
import type { TmdbMovie } from "@/types/tmdb";
import { posterUrl } from "@/services/tmdb";

interface Props {
  movie: TmdbMovie;
  index?: number;
}

export function MovieCard({ movie, index = 0 }: Props) {
  const title = movie.title || movie.name || "";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
  const poster = posterUrl(movie.poster_path, "w500");
  const mediaType = movie.media_type === "tv" || movie.first_air_date ? "tv" : "movie";

  const ref = useRef<HTMLDivElement>(null);
  
  // Parallax state
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const isHovered = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);
  const smoothHover = useSpring(isHovered, springConfig);

  const rotateX = useTransform(smoothY, [0, 1], [-15, 15]);
  const rotateY = useTransform(smoothX, [0, 1], [15, -15]);
  const scale = useTransform(smoothHover, [0, 1], [1, 1.05]);
  const y = useTransform(smoothHover, [0, 1], [0, -10]);
  const glareOpacity = useTransform(smoothHover, [0, 1], [0, 1]);

  const glareX = useTransform(smoothX, [0, 1], [100, 0]);
  const glareY = useTransform(smoothY, [0, 1], [100, 0]);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 35%, transparent 70%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - left) / width);
    mouseY.set((e.clientY - top) / height);
  };

  const handleMouseEnter = () => isHovered.set(1);
  
  const handleMouseLeave = () => {
    isHovered.set(0);
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.4), ease: [0.2, 0.8, 0.2, 1] }}
      className="group relative shrink-0 w-[180px] md:w-[200px]"
      style={{ perspective: 1000 }}
    >
      <Link
        to="/movie/$id"
        params={{ id: String(movie.id) }}
        search={{ media: mediaType }}
        className="block relative"
      >
        <motion.div 
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ rotateX, rotateY, scale, y, transformStyle: "preserve-3d" }}
          className="relative aspect-[2/3] rounded-[1.5rem] overflow-hidden bg-surface shadow-card shadow-black/80 ring-1 ring-white/10 group-hover:ring-white/30 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
        >
          {poster ? (
            <motion.img
              src={poster}
              alt={title}
              loading="lazy"
              style={{ translateZ: 20 }}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-white/50 text-sm bg-surface-elevated">
              No image
            </div>
          )}
          
          <motion.div 
            style={{ opacity: glareOpacity, background: glareBackground, translateZ: 30 }}
            className="absolute inset-0 pointer-events-none mix-blend-overlay" 
          />
          
          <motion.div 
            style={{ translateZ: 40 }}
            className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider bg-black/40 backdrop-blur-md border border-white/20 shadow-lg"
          >
            {(movie.vote_average ?? 0) >= 7.5 ? "HD+" : "HD"}
          </motion.div>
        </motion.div>
        
        <div className="mt-5 px-1 group-hover:-translate-y-1 transition-transform duration-300">
          <div className="font-bold text-sm truncate text-white group-hover:text-primary-glow transition-colors">{title}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-white/50 font-semibold tracking-wide">
            <span>{year || "â€”"}</span>
            <span className="flex items-center gap-1">
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              {movie.vote_average?.toFixed(1) ?? "â€”"}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}