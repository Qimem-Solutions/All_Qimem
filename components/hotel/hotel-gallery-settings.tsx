"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Images, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeHotelGalleryImageAction, uploadHotelGalleryImageAction } from "@/lib/actions/hotel-gallery";
import type { GalleryActionResult } from "@/lib/hotel-gallery/shared";

function Message({ state }: { state: GalleryActionResult | null }) {
  if (!state) return null;
  if (state.ok && state.message) {
    return <p className="text-sm text-emerald-400">{state.message}</p>;
  }
  if (!state.ok) {
    return <p className="text-sm text-red-300">{state.error}</p>;
  }
  return null;
}

export function HotelGallerySettings({ initialUrls }: { initialUrls: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [upState, uploadAction, uploadPending] = useActionState(uploadHotelGalleryImageAction, null);
  const [rmState, removeAction, removePending] = useActionState(removeHotelGalleryImageAction, null);

  useEffect(() => {
    if (upState?.ok || rmState?.ok) {
      router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [upState, rmState, router]);

  const busy = uploadPending || removePending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Upload photos of your property. They appear on the Portfolio page below “About this property”
        with a slideshow guests and staff can browse.
      </p>

      <form action={uploadAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="gallery-file">
            Add photos — select multiple for the slideshow (JPEG, PNG, or WebP · max 5 MB each · up to 12
            total)
          </label>
          <input
            ref={fileRef}
            id="gallery-file"
            name="file"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="block w-full cursor-pointer text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gold"
            disabled={busy}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy} className="shrink-0 gap-2">
          <Images className="h-4 w-4" />
          {uploadPending ? "Uploading…" : "Upload photos"}
        </Button>
      </form>
      <Message state={upState} />

      {initialUrls.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {initialUrls.map((url) => (
            <li key={url} className="relative overflow-hidden rounded-lg border border-border bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              <form
                action={removeAction}
                className="absolute right-1 top-1 sm:right-1.5 sm:top-1.5"
              >
                <input type="hidden" name="url" value={url} />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="h-8 border-red-500/40 bg-black/70 px-2 text-red-200 shadow-md backdrop-blur-sm hover:bg-red-950/90 hover:text-red-50"
                  disabled={busy}
                  title="Remove photo"
                  aria-label="Remove photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border/80 bg-surface-elevated/30 px-4 py-6 text-center text-sm text-muted">
          No gallery photos yet. Upload one to showcase your property.
        </p>
      )}
      <Message state={rmState} />
    </div>
  );
}
