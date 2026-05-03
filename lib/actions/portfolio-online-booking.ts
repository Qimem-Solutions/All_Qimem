"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { portfolioPaymentSnapshotJson } from "@/lib/constants/portfolio-payments";
import { findAvailableRoomForStay } from "@/lib/queries/hrrm-availability";
import { localDateIso } from "@/lib/format";
import { nightsBetween } from "@/lib/hrrm-pricing";
import { toUserFacingError } from "@/lib/errors/user-facing";

const BUCKET = "guest-id-documents";

function randomReferenceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "PO-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function validateNationalIdFile(f: File): string | null {
  if (f.size > 5 * 1024 * 1024) return "National ID image must be 5MB or smaller.";
  if (!/^(image\/jpeg|image\/png|image\/webp)$/i.test(f.type)) {
    return "National ID must be a JPEG, PNG, or WebP image.";
  }
  return null;
}

function validateReceiptFile(f: File): string | null {
  if (f.size > 8 * 1024 * 1024) return "Payment receipt must be 8MB or smaller.";
  if (!/^(image\/jpeg|image\/png|image\/webp|application\/pdf)$/i.test(f.type)) {
    return "Payment receipt must be an image (JPEG, PNG, WebP) or PDF.";
  }
  return null;
}

export type SubmitPortfolioBookingResult =
  | { ok: true; referenceCode: string }
  | { ok: false; error: string };

/**
 * Public (unauthenticated) submission from /p/{slug} booking flow.
 * Uses service role for tenant-scoped insert + private storage uploads.
 */
export async function submitPortfolioOnlineBookingAction(formData: FormData): Promise<SubmitPortfolioBookingResult> {
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false, error: "Booking is temporarily unavailable (server configuration)." };
  }

  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const slug = String(formData.get("portfolioSlug") ?? "").trim();
  const roomTypeId = String(formData.get("room_type_id") ?? "").trim();
  const checkIn = String(formData.get("check_in") ?? "").trim();
  const checkOut = String(formData.get("check_out") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("guest_phone") ?? "").trim();

  if (!tenantId || !slug || !roomTypeId || !checkIn || !checkOut) {
    return { ok: false, error: "Missing booking details." };
  }
  if (!fullName || !phone) {
    return { ok: false, error: "Enter your full name and phone number." };
  }
  if (checkIn >= checkOut) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  if (checkIn < localDateIso()) {
    return { ok: false, error: "Check-in cannot be in the past." };
  }

  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr || !tenantRow) {
    return { ok: false, error: "Property not found." };
  }
  const dbSlug = String((tenantRow as { slug?: string }).slug ?? "").trim().toLowerCase();
  if (dbSlug !== slug.toLowerCase()) {
    return { ok: false, error: "Invalid property reference." };
  }

  const { data: typeRow, error: typeErr } = await admin
    .from("room_types")
    .select("id, name, price, tenant_id")
    .eq("id", roomTypeId)
    .maybeSingle();
  if (typeErr || !typeRow) {
    return { ok: false, error: "Room type not found." };
  }
  if ((typeRow as { tenant_id: string }).tenant_id !== tenantId) {
    return { ok: false, error: "Room type does not belong to this property." };
  }

  const avail = await findAvailableRoomForStay(tenantId, roomTypeId, checkIn, checkOut, admin);
  if (avail.error) {
    return { ok: false, error: avail.error };
  }
  if (!avail.roomId) {
    return { ok: false, error: "No room is available for this category on those dates." };
  }

  const nights = nightsBetween(checkIn, checkOut);
  const nightly = (typeRow as { price?: unknown }).price;
  const nightlyNum = nightly == null ? 0 : Number(nightly);
  const nightlyCents = Number.isFinite(nightlyNum) ? Math.round(Math.max(0, nightlyNum) * 100) : 0;
  const stayTotalCents = nightlyCents * nights;

  const idFile = formData.get("national_id_image");
  const receiptFile = formData.get("payment_receipt");
  const idOk = idFile && typeof idFile === "object" && "arrayBuffer" in idFile && (idFile as File).size > 0;
  const recOk =
    receiptFile && typeof receiptFile === "object" && "arrayBuffer" in receiptFile && (receiptFile as File).size > 0;
  if (!idOk) {
    return { ok: false, error: "Upload a photo of your national ID." };
  }
  if (!recOk) {
    return { ok: false, error: "Upload your payment receipt." };
  }

  const idF = idFile as File;
  const recF = receiptFile as File;
  const idVal = validateNationalIdFile(idF);
  if (idVal) return { ok: false, error: idVal };
  const recVal = validateReceiptFile(recF);
  if (recVal) return { ok: false, error: recVal };

  const roomTypeName = String((typeRow as { name?: string }).name ?? "Room");

  let referenceCode = randomReferenceCode();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: exists } = await admin
      .from("portfolio_online_reservation_requests")
      .select("id")
      .eq("reference_code", referenceCode)
      .maybeSingle();
    if (!exists) break;
    referenceCode = randomReferenceCode();
  }

  const snapshot = portfolioPaymentSnapshotJson();

  const { data: inserted, error: insErr } = await admin
    .from("portfolio_online_reservation_requests")
    .insert({
      tenant_id: tenantId,
      room_type_id: roomTypeId,
      room_type_name: roomTypeName,
      check_in: checkIn,
      check_out: checkOut,
      nightly_cents: nightlyCents,
      stay_total_cents: stayTotalCents,
      currency: "ETB",
      guest_full_name: fullName,
      guest_phone: phone,
      payment_instructions_snapshot: snapshot,
      reference_code: referenceCode,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    return { ok: false, error: toUserFacingError(insErr?.message ?? "Could not save request.") };
  }

  const requestId = inserted.id as string;

  const idExt = idF.type.includes("png") ? "png" : idF.type.includes("webp") ? "webp" : "jpg";
  const idPath = `${tenantId}/portfolio-online/${requestId}/national-id.${idExt}`;
  const recExt = recF.type.includes("pdf")
    ? "pdf"
    : recF.type.includes("png")
      ? "png"
      : recF.type.includes("webp")
        ? "webp"
        : "jpg";
  const recPath = `${tenantId}/portfolio-online/${requestId}/payment-receipt.${recExt}`;

  const idBuf = Buffer.from(await idF.arrayBuffer());
  const recBuf = Buffer.from(await recF.arrayBuffer());

  const upId = await admin.storage.from(BUCKET).upload(idPath, idBuf, {
    contentType: idF.type,
    upsert: true,
  });
  if (upId.error) {
    await admin.from("portfolio_online_reservation_requests").delete().eq("id", requestId);
    return { ok: false, error: upId.error.message };
  }

  const upRec = await admin.storage.from(BUCKET).upload(recPath, recBuf, {
    contentType: recF.type || "application/octet-stream",
    upsert: true,
  });
  if (upRec.error) {
    await admin.storage.from(BUCKET).remove([idPath]);
    await admin.from("portfolio_online_reservation_requests").delete().eq("id", requestId);
    return { ok: false, error: upRec.error.message };
  }

  const { error: updErr } = await admin
    .from("portfolio_online_reservation_requests")
    .update({
      national_id_storage_path: idPath,
      payment_receipt_storage_path: recPath,
    })
    .eq("id", requestId);

  if (updErr) {
    await admin.storage.from(BUCKET).remove([idPath, recPath]);
    await admin.from("portfolio_online_reservation_requests").delete().eq("id", requestId);
    return { ok: false, error: updErr.message };
  }

  revalidatePath(`/p/${encodeURIComponent(slug)}`);
  revalidatePath("/hrrm/front-desk");

  return { ok: true, referenceCode };
}
