"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  urls: string[];
  /** Screen reader label for the carousel region */
  label?: string;
};

/**
 * Simple slider for property photos (below “About this property” on the hotel portfolio).
 */
export function HotelPropertyGalleryCarousel({ urls, label = "Property photos" }: Props) {
  const [index, setIndex] = useState(0);

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
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground">Photo gallery</h3>
      <div
        className="relative overflow-hidden rounded-xl border border-border bg-surface-elevated/40"
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
      >
        <div className="relative aspect-[16/10] w-full bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
          {n > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
                aria-label="Previous image"
                onClick={() => go(-1)}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
                aria-label="Next image"
                onClick={() => go(1)}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}
        </div>
        {n > 1 ? (
          <div className="flex items-center justify-center gap-1.5 border-t border-border py-3">
            {urls.map((u, i) => (
              <button
                key={u}
                type="button"
                className={cn(
                  "h-2 w-2 rounded-full transition",
                  i === safeIndex ? "bg-gold" : "bg-muted hover:bg-muted/80",
                )}
                aria-label={`Go to photo ${i + 1}`}
                aria-current={i === safeIndex ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
