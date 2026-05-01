/**
 * Pure helpers + constants for property gallery (client, server actions, superadmin).
 * Kept out of "use server" modules so Next.js only exports async functions there.
 */

export type GalleryActionResult = { ok: true; message?: string } | { ok: false; error: string };

export const HOTEL_GALLERY_COLUMN_MISSING_MESSAGE =
  "Property gallery isn’t available on this database yet. Apply migration 20260430130000_tenant_property_gallery.sql " +
  "(Supabase Dashboard → SQL Editor, or run `supabase db push` / link CLI), then try again.";

export const HOTEL_GALLERY_BUCKET = "hotel-gallery";
export const HOTEL_GALLERY_MAX_IMAGES = 12;
export const HOTEL_GALLERY_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function hotelGalleryExtForMime(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

/** Shared rules for hotel property gallery uploads (hotel admin + superadmin tenant create). */
export function validateHotelGalleryFile(file: File): string | null {
  if (!(file instanceof File) || file.size === 0) {
    return "Each file must be a non-empty image.";
  }
  if (file.size > HOTEL_GALLERY_MAX_BYTES) {
    return "Each image must be 5 MB or smaller.";
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED.has(mime)) {
    return "Use JPEG, PNG, or WebP only.";
  }
  if (!hotelGalleryExtForMime(mime)) {
    return "Unsupported image type.";
  }
  return null;
}
