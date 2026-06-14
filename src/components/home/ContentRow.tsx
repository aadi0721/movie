import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";


interface Props {
  title: string;
  seeAllTo?: string;
  children: ReactNode;
}

export function ContentRow({ title, seeAllTo, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, scroll: 0 });

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="mt-12 group/row">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10 flex items-end justify-between">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          {seeAllTo && (
            <a href={seeAllTo} className="text-sm text-muted-foreground hover:text-foreground transition story-link">
              See all
            </a>
          )}
          <div className="hidden md:flex gap-1">
            <button onClick={() => scroll(-1)} className="size-9 rounded-full glass hover:bg-secondary transition grid place-items-center">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => scroll(1)} className="size-9 rounded-full glass hover:bg-secondary transition grid place-items-center">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={ref}
        className={`mt-5 flex gap-4 overflow-x-auto scrollbar-none px-6 lg:px-10 mx-auto max-w-[1600px] mask-fade-r ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={(e) => {
          setDragging(true);
          start.current = { x: e.pageX, scroll: ref.current?.scrollLeft ?? 0 };
        }}
        onMouseLeave={() => setDragging(false)}
        onMouseUp={() => setDragging(false)}
        onMouseMove={(e) => {
          if (!dragging || !ref.current) return;
          ref.current.scrollLeft = start.current.scroll - (e.pageX - start.current.x);
        }}
      >
        {children}
      </div>
    </section>
  );
}
