import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { tmdbApi } from "@/services/tmdb";
import { MovieCard } from "@/components/cards/MovieCard";

export const Route = createFileRoute("/browse/$type")({
  head: ({ params }) => ({
    meta: [{ title: `${params.type === "tv" ? "TV Shows" : "Movies"} — MoviesAlert` }],
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const { type: rawType } = Route.useParams();
  const type: "movie" | "tv" = rawType === "tv" ? "tv" : "movie";
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ["browse", type],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => tmdbApi.discover({ data: { mediaType: type, page: pageParam as number } }),
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    staleTime: 60_000,
  });

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const items = query.data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div className="pt-28 pb-20 mx-auto max-w-[1500px] px-6 lg:px-10">
      <h1 className="text-3xl md:text-5xl font-bold text-gradient">
        {type === "tv" ? "TV Shows" : "Movies"}
      </h1>
      <p className="mt-2 text-muted-foreground">Discover what's popular, top-rated and trending right now.</p>

      <div className="mt-10 grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((m, i) => (
          <MovieCard key={`${m.id}-${i}`} movie={{ ...m, media_type: type }} index={i} />
        ))}
      </div>

      <div ref={sentinel} className="h-20 mt-10 grid place-items-center text-muted-foreground text-sm">
        {query.isFetchingNextPage ? "Loading more…" : query.hasNextPage ? "Scroll for more" : "End of catalog"}
      </div>
    </div>
  );
}
