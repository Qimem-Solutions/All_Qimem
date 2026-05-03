"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const AUTO_ADVANCE_MS = 2 * 60 * 1000; // 2 minutes per slide

type Props = {
  urls: string[];
  /** Screen reader label for the carousel region */
  label?: string;
  /** Span full viewport width (no side rounding/border on public portfolio). */
  edgeToEdge?: boolean;
};

/**
 * Simple slider for property photos (below “About this property” on the hotel portfolio).
 */
export function HotelPropertyGalleryCarousel({
  urls,
  label = "Property photos",
  edgeToEdge = false,
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const n = urls.length;
  const safeIndex = n <= 0 ? 0 : ((index % n) + n) % n;

  useEffect(() => {
    setIndex((i) => {
      if (n <= 0) return 0;
      return Math.min(i, n - 1);
    });
  }, [n]);

  const go = useCallback(
    (delta: number) => {
      if (n <= 0) return;
      setIndex((i) => {
        const next = i + delta;
        return ((next % n) + n) % n;
      });
    },
    [n],
  );

  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    if (n <= 1 || paused) return;
    const id = window.setInterval(() => goRef.current(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [n, paused, safeIndex]);

  useEffect(() => {
    if (n <= 1) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, go]);

  if (n === 0) return null;

  const current = urls[safeIndex];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        edgeToEdge
          ? "rounded-2xl border border-white/10 bg-white/[0.03]"
          : "rounded-xl border border-border bg-surface-elevated/40",
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Full width of the column; height tracks width via aspect ratio */}
      <div className="relative aspect-[16/9] w-full min-h-[160px] bg-black/20 sm:aspect-[2/1] sm:min-h-[200px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt=""
          className="h-full w-full object-cover object-center"
          draggable={false}
        />
        {n > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 sm:left-3 sm:h-10 sm:w-10"
              aria-label="Previous image"
              onClick={() => go(-1)}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 sm:right-3 sm:h-10 sm:w-10"
              aria-label="Next image"
              onClick={() => go(1)}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </>
        ) : null}
      </div>
      {n > 1 ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-1.5 border-t px-2 py-2.5",
            edgeToEdge ? "border-white/10" : "border-border",
          )}
        >
          {urls.map((u, i) => (
            <button
              key={u}
              type="button"
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition sm:h-2.5 sm:w-2.5",
                i === safeIndex ? "bg-gold" : edgeToEdge ? "bg-zinc-600 hover:bg-zinc-500" : "bg-muted hover:bg-muted/80",
              )}
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === safeIndex ? "true" : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
