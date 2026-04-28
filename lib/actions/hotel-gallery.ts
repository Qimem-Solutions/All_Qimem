"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { isMissingDbColumnError } from "@/lib/supabase/schema-errors";

/** Shown when migrations haven’t been applied to the linked Supabase project. */
const GALLERY_COLUMN_MISSING_MESSAGE =
  "Property gallery isn’t available on this database yet. Apply migration 20260430130000_tenant_property_gallery.sql " +
  "(Supabase Dashboard → SQL Editor, or run `supabase db push` / link CLI), then try again.";

export type GalleryActionResult = { ok: true; message?: string } | { ok: false; error: string };

const BUCKET = "hotel-gallery";
const MAX_IMAGES = 12;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

async function requireHotelAdminTenant() {
  const ctx = await getUserContext();
  if (!ctx?.tenantId || ctx.globalRole !== "hotel_admin") {
    return { tenantId: null as string | null };
  }
  return { tenantId: ctx.tenantId };
}

function validateGalleryFile(file: File): string | null {
  if (!(file instanceof File) || file.size === 0) {
    return "Each file must be a non-empty image.";
  }
  if (file.size > MAX_BYTES) {
    return "Each image must be 5 MB or smaller.";
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED.has(mime)) {
    return "Use JPEG, PNG, or WebP only.";
  }
  if (!extForMime(mime)) {
    return "Unsupported image type.";
  }
  return null;
}

/** useActionState passes (previousState, formData); `<form action>` may pass FormData as the only argument. */
function resolveFormData(
  prevOrFormData: GalleryActionResult | null | FormData,
  maybeFormData?: FormData,
): FormData | null {
  if (prevOrFormData instanceof FormData) return prevOrFormData;
  if (maybeFormData instanceof FormData) return maybeFormData;
  return null;
}

export async function uploadHotelGalleryImageAction(
  prevOrFormData: GalleryActionResult | null | FormData,
  maybeFormData?: FormData,
): Promise<GalleryActionResult> {
  const fd = resolveFormData(prevOrFormData, maybeFormData);
  if (!fd) {
    return { ok: false, error: "Invalid form submission." };
  }

  const { tenantId } = await requireHotelAdminTenant();
  if (!tenantId) {
    return { ok: false, error: "Only hotel administrators can upload gallery images." };
  }

  const files = fd.getAll("file").filter((x): x is File => x instanceof File && x.size > 0);
  if (files.length === 0) {
    return { ok: false, error: "Choose one or more image files." };
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("tenants")
    .select("gallery_urls")
    .eq("id", tenantId)
    .maybeSingle();

  if (fetchErr) {
    return {
      ok: false,
      error: isMissingDbColumnError(fetchErr) ? GALLERY_COLUMN_MISSING_MESSAGE : fetchErr.message,
    };
  }

  let urls = normalizeGalleryUrls(row?.gallery_urls);
  const uploadedPaths: string[] = [];

  for (const file of files) {
    const err = validateGalleryFile(file);
    if (err) {
      for (const p of uploadedPaths) {
        await supabase.storage.from(BUCKET).remove([p]);
      }
      return { ok: false, error: err };
    }
    if (urls.length >= MAX_IMAGES) {
      for (const p of uploadedPaths) {
        await supabase.storage.from(BUCKET).remove([p]);
      }
      return {
        ok: false,
        error: `Gallery is limited to ${MAX_IMAGES} photos. Remove some before adding more.`,
      };
    }

    const mime = file.type.toLowerCase();
    const ext = extForMime(mime)!;
    const path = `${tenantId}/${randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    });

    if (upErr) {
      for (const p of uploadedPaths) {
        await supabase.storage.from(BUCKET).remove([p]);
      }
      return { ok: false, error: upErr.message };
    }

    uploadedPaths.push(path);
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls = [...urls, publicUrl];
  }

  const { error: updErr } = await supabase.from("tenants").update({ gallery_urls: urls }).eq("id", tenantId);

  if (updErr) {
    for (const p of uploadedPaths) {
      await supabase.storage.from(BUCKET).remove([p]);
    }
    return {
      ok: false,
      error: isMissingDbColumnError(updErr) ? GALLERY_COLUMN_MISSING_MESSAGE : updErr.message,
    };
  }

  revalidatePath("/hotel/settings");
  revalidatePath("/hotel/dashboard");
  const n = files.length;
  return {
    ok: true,
    message: n === 1 ? "Photo added to gallery." : `${n} photos added to gallery.`,
  };
}

function normalizeGalleryUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  return [];
}

/** Extract storage path `tenantId/file.jpg` from public object URL. */
function parseHotelGalleryStoragePath(publicUrl: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  if (i < 0) return null;
  return publicUrl.slice(i + marker.length).split("?")[0] ?? null;
}

export async function removeHotelGalleryImageAction(
  prevOrFormData: GalleryActionResult | null | FormData,
  maybeFormData?: FormData,
): Promise<GalleryActionResult> {
  const fd = resolveFormData(prevOrFormData, maybeFormData);
  if (!fd) {
    return { ok: false, error: "Invalid form submission." };
  }

  const { tenantId } = await requireHotelAdminTenant();
  if (!tenantId) {
    return { ok: false, error: "Not authorized." };
  }

  const url = String(fd.get("url") ?? "").trim();
  if (!url) {
    return { ok: false, error: "Missing image URL." };
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("tenants")
    .select("gallery_urls")
    .eq("id", tenantId)
    .maybeSingle();

  if (fetchErr) {
    return {
      ok: false,
      error: isMissingDbColumnError(fetchErr) ? GALLERY_COLUMN_MISSING_MESSAGE : fetchErr.message,
    };
  }

  const urls = normalizeGalleryUrls(row?.gallery_urls);
  if (!urls.includes(url)) {
    return { ok: false, error: "That image is not in your gallery." };
  }

  const path = parseHotelGalleryStoragePath(url);
  if (path && path.startsWith(`${tenantId}/`)) {
    await supabase.storage.from(BUCKET).remove([path]);
  }

  const next = urls.filter((u) => u !== url);

  const { error: updErr } = await supabase.from("tenants").update({ gallery_urls: next }).eq("id", tenantId);

  if (updErr) {
    return {
      ok: false,
      error: isMissingDbColumnError(updErr) ? GALLERY_COLUMN_MISSING_MESSAGE : updErr.message,
    };
  }

  revalidatePath("/hotel/settings");
  revalidatePath("/hotel/dashboard");
  return { ok: true, message: "Photo removed." };
}
