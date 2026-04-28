"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";

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

export async function uploadHotelGalleryImageAction(formData: FormData): Promise<GalleryActionResult> {
  const { tenantId } = await requireHotelAdminTenant();
  if (!tenantId) {
    return { ok: false, error: "Only hotel administrators can upload gallery images." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED.has(mime)) {
    return { ok: false, error: "Use JPEG, PNG, or WebP." };
  }
  const ext = extForMime(mime);
  if (!ext) {
    return { ok: false, error: "Unsupported image type." };
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("tenants")
    .select("gallery_urls")
    .eq("id", tenantId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }

  const urls = normalizeGalleryUrls(row?.gallery_urls);
  if (urls.length >= MAX_IMAGES) {
    return { ok: false, error: `You can upload at most ${MAX_IMAGES} photos. Remove one first.` };
  }

  const path = `${tenantId}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const next = [...urls, publicUrl];

  const { error: updErr } = await supabase.from("tenants").update({ gallery_urls: next }).eq("id", tenantId);

  if (updErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/hotel/settings");
  revalidatePath("/hotel/dashboard");
  return { ok: true, message: "Photo added to gallery." };
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

export async function removeHotelGalleryImageAction(formData: FormData): Promise<GalleryActionResult> {
  const { tenantId } = await requireHotelAdminTenant();
  if (!tenantId) {
    return { ok: false, error: "Not authorized." };
  }

  const url = String(formData.get("url") ?? "").trim();
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
    return { ok: false, error: fetchErr.message };
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
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/hotel/settings");
  revalidatePath("/hotel/dashboard");
  return { ok: true, message: "Photo removed." };
}
