"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { localDateIso } from "@/lib/format";
import { findAvailableRoomForStay } from "@/lib/queries/hrrm-availability";

const BUCKET = "guest-id-documents";

export type PortfolioOnlineReservationRequestRow = {
  id: string;
  reference_code: string;
  guest_full_name: string;
  guest_phone: string;
  room_type_name: string;
  check_in: string;
  check_out: string;
  stay_total_cents: number;
  currency: string;
  status: string;
  created_at: string;
  national_id_storage_path: string | null;
  payment_receipt_storage_path: string | null;
};

function randomConfirmationCode(): string {
  const n = () => Math.floor(Math.random() * 36).toString(36);
  return `QIM-${Array.from({ length: 6 }, n).join("").toUpperCase()}`;
}

function reservationStatusForStay(checkIn: string, checkOut: string, today: string): string {
  if (checkIn <= today && today < checkOut) return "checked_in";
  if (checkIn > today) return "pending";
  return "checked_out";
}

async function requireHrrmManage() {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false as const, error: "Not signed in on a property." };
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access !== "manage") {
    return { ok: false as const, error: "HRRM manage access is required." };
  }
  return { ok: true as const, ctx };
}

async function requireHrrmStaff() {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false as const, error: "Not signed in on a property." };
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access === "none") {
    return { ok: false as const, error: "HRRM access is required." };
  }
  return { ok: true as const, ctx };
}

async function syncRoomOperational(
  admin: ReturnType<typeof createServiceRoleClient>,
  tenantId: string,
  roomId: string,
  reservationStatus: string,
) {
  const status = reservationStatus.toLowerCase();
  let operationalStatus: string | null = null;
  if (["pending", "confirmed", "checked_in"].includes(status)) operationalStatus = "occupied";
  else if (["checked_out", "completed", "departed", "canceled", "cancelled"].includes(status))
    operationalStatus = "available";
  if (!operationalStatus) return;
  await admin.from("rooms").update({ operational_status: operationalStatus }).eq("id", roomId).eq("tenant_id", tenantId);
}

export async function approvePortfolioOnlineRequestAction(
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const tenantId = g.ctx.tenantId!;
  const id = requestId?.trim();
  if (!id) return { ok: false, error: "Missing request." };

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: reqRow, error: loadErr } = await admin
    .from("portfolio_online_reservation_requests")
    .select(
      "id, tenant_id, room_type_id, check_in, check_out, guest_full_name, guest_phone, stay_total_cents, status",
    )
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !reqRow) return { ok: false, error: loadErr?.message ?? "Request not found." };
  if ((reqRow as { tenant_id: string }).tenant_id !== tenantId) {
    return { ok: false, error: "Request not found." };
  }
  if ((reqRow as { status: string }).status !== "pending") {
    return { ok: false, error: "This request is no longer pending." };
  }

  const roomTypeId = (reqRow as { room_type_id: string }).room_type_id;
  const checkIn = (reqRow as { check_in: string }).check_in;
  const checkOut = (reqRow as { check_out: string }).check_out;

  const avail = await findAvailableRoomForStay(tenantId, roomTypeId, checkIn, checkOut, admin);
  if (avail.error) return { ok: false, error: avail.error };
  if (!avail.roomId) return { ok: false, error: "No room is available for those dates anymore." };

  const todayYmd = localDateIso();
  const resStatus = reservationStatusForStay(checkIn, checkOut, todayYmd);
  const stayTotal = Number((reqRow as { stay_total_cents: unknown }).stay_total_cents);
  const balanceCents = Number.isFinite(stayTotal) ? Math.max(0, Math.round(stayTotal)) : 0;

  const fullName = (reqRow as { guest_full_name: string }).guest_full_name;
  const phone = (reqRow as { guest_phone: string }).guest_phone;

  const { data: guestIns, error: guestErr } = await admin
    .from("guests")
    .insert({ tenant_id: tenantId, full_name: fullName, phone: phone || null })
    .select("id")
    .single();

  if (guestErr || !guestIns?.id) {
    return { ok: false, error: guestErr?.message ?? "Could not create guest." };
  }
  const guestId = guestIns.id as string;

  const { data: resIns, error: resErr } = await admin
    .from("reservations")
    .insert({
      tenant_id: tenantId,
      guest_id: guestId,
      room_id: avail.roomId,
      check_in: checkIn,
      check_out: checkOut,
      status: resStatus,
      balance_cents: balanceCents,
      payment_status: "paid",
      confirmation_code: randomConfirmationCode(),
    })
    .select("id")
    .single();

  if (resErr || !resIns?.id) {
    await admin.from("guests").delete().eq("id", guestId).eq("tenant_id", tenantId);
    return { ok: false, error: resErr?.message ?? "Could not create reservation." };
  }
  const reservationId = resIns.id as string;

  await syncRoomOperational(admin, tenantId, avail.roomId, resStatus);

  const { error: updErr } = await admin
    .from("portfolio_online_reservation_requests")
    .update({
      status: "approved",
      reservation_id: reservationId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("status", "pending");

  if (updErr) {
    await admin.from("reservations").delete().eq("id", reservationId).eq("tenant_id", tenantId);
    await admin.from("guests").delete().eq("id", guestId).eq("tenant_id", tenantId);
    await syncRoomOperational(admin, tenantId, avail.roomId, "checked_out");
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/hrrm/front-desk");
  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm/guests");
  revalidatePath("/hrrm/dashboard");
  return { ok: true };
}

export async function rejectPortfolioOnlineRequestAction(
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const tenantId = g.ctx.tenantId!;
  const id = requestId?.trim();
  if (!id) return { ok: false, error: "Missing request." };

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: affected, error } = await admin
    .from("portfolio_online_reservation_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!affected) return { ok: false, error: "Request not found or already processed." };

  revalidatePath("/hrrm/front-desk");
  return { ok: true };
}

export async function getPortfolioOnlineRequestDocUrlAction(
  requestId: string,
  doc: "national_id" | "payment_receipt",
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const g = await requireHrrmStaff();
  if (!g.ok) return g;
  const tenantId = g.ctx.tenantId!;
  const id = requestId?.trim();
  if (!id) return { ok: false, error: "Missing request." };

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const pathField = doc === "national_id" ? "national_id_storage_path" : "payment_receipt_storage_path";

  const { data: row, error: loadErr } = await admin
    .from("portfolio_online_reservation_requests")
    .select(`tenant_id, ${pathField}`)
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !row) return { ok: false, error: loadErr?.message ?? "Request not found." };
  if ((row as { tenant_id: string }).tenant_id !== tenantId) {
    return { ok: false, error: "Request not found." };
  }

  const path = (row as Record<string, unknown>)[pathField];
  if (typeof path !== "string" || !path.trim()) {
    return { ok: false, error: "No file uploaded for this document." };
  }

  if (!path.startsWith(`${tenantId}/`)) {
    return { ok: false, error: "Invalid storage path." };
  }

  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: signErr?.message ?? "Could not create download link." };
  }

  return { ok: true, url: signed.signedUrl };
}
