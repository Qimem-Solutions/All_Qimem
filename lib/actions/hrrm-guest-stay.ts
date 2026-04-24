"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { addLocalDays, localDateIso } from "@/lib/format";
import { isRoomAvailableForStay } from "@/lib/queries/hrrm-availability";
import type { GuestDirectoryRow } from "@/lib/hrrm-guest-directory";
import { fetchGuestDirectoryRow } from "@/lib/queries/hrrm-guests-list";

type Ok = { ok: true } | { ok: false; error: string };

type RowOk = { ok: true; row: GuestDirectoryRow } | { ok: false; error: string };

type UpdateGuestReservationInput = {
  guestId: string;
  fullName: string;
  phone: string;
  age: string;
  partySize: string;
  nationalIdNumber: string;
  paymentDollars: string;
  paymentMethod: string;
  reservationId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  reservationStatus?: string | null;
  paymentStatus?: string | null;
};

function isCheckedOutStatus(s: string | null | undefined): boolean {
  const x = (s ?? "").toLowerCase();
  return x === "checked_out" || x === "completed" || x === "departed";
}

function isCanceledStatus(s: string | null | undefined): boolean {
  const x = (s ?? "").toLowerCase();
  return x === "canceled" || x === "cancelled";
}

async function syncRoomOperationalStatus(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>,
  tenantId: string,
  roomId: string | null | undefined,
  reservationStatus: string | null | undefined,
) {
  if (!roomId) return;
  const status = (reservationStatus ?? "").toLowerCase();
  let operationalStatus: string | null = null;
  if (status === "checked_in" || status === "confirmed" || status === "pending") operationalStatus = "occupied";
  else if (status === "checked_out" || status === "completed" || status === "departed" || status === "canceled" || status === "cancelled") {
    operationalStatus = "available";
  }
  if (!operationalStatus) return;

  await supabase
    .from("rooms")
    .update({ operational_status: operationalStatus })
    .eq("id", roomId)
    .eq("tenant_id", tenantId);
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

async function getSupabase() {
  try {
    return createServiceRoleClient();
  } catch {
    return await createClient();
  }
}

type ResRow = {
  id: string;
  tenant_id: string;
  check_in: string;
  check_out: string;
  status: string | null;
  room_id: string | null;
  guest_id?: string;
  payment_status?: string | null;
};

async function requireHrrmView() {
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

export async function getGuestHrrmDetailAction(guestId: string): Promise<RowOk> {
  const g = await requireHrrmView();
  if (!g.ok) return g;
  const r = await fetchGuestDirectoryRow(g.ctx.tenantId!, guestId);
  if (!r) return { ok: false, error: "Guest not found." };
  return { ok: true, row: r };
}

export async function updateGuestFrontDeskDetailAction(input: UpdateGuestReservationInput): Promise<RowOk> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const tenantId = g.ctx.tenantId!;
  const supabase = await getSupabase();

  const guestId = input.guestId.trim();
  const fullName = input.fullName.trim();
  if (!guestId || !fullName) {
    return { ok: false, error: "Guest and full name are required." };
  }

  const phone = input.phone.trim() || null;
  const age = input.age.trim() ? Number.parseInt(input.age.trim(), 10) : null;
  if (age != null && (Number.isNaN(age) || age < 0 || age > 130)) {
    return { ok: false, error: "Enter a valid age (0–130) or leave blank." };
  }
  const partySize = input.partySize.trim() ? Number.parseInt(input.partySize.trim(), 10) : 1;
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 20) {
    return { ok: false, error: "Party size must be between 1 and 20." };
  }
  const nationalIdNumber = input.nationalIdNumber.trim() || null;
  const paymentMethod = input.paymentMethod.trim() || "cash";
  const paymentCents = Math.max(0, Math.round((Number.parseFloat(input.paymentDollars.trim() || "0") || 0) * 100));

  const guestUpdate = await supabase
    .from("guests")
    .update({
      full_name: fullName,
      phone,
      age,
      party_size: partySize,
      national_id_number: nationalIdNumber,
      registration_payment_cents: paymentCents,
      payment_method: paymentMethod,
    })
    .eq("id", guestId)
    .eq("tenant_id", tenantId);

  if (guestUpdate.error) {
    const msg = guestUpdate.error.message ?? "";
    const schemaProblem = /age|column|schema cache|Could not find|does not exist|PGRST204/i.test(msg);
    if (schemaProblem) {
      const minimalUpdate = await supabase
        .from("guests")
        .update({ full_name: fullName, phone })
        .eq("id", guestId)
        .eq("tenant_id", tenantId);
      if (minimalUpdate.error) return { ok: false, error: minimalUpdate.error.message };
    } else {
      return { ok: false, error: msg || "Could not update guest." };
    }
  }

  if (input.reservationId) {
    const { data: reservation, error: reservationErr } = await supabase
      .from("reservations")
      .select("id, tenant_id, guest_id, room_id, check_in, check_out, status, payment_status")
      .eq("id", input.reservationId)
      .eq("tenant_id", tenantId)
      .eq("guest_id", guestId)
      .maybeSingle();
    if (reservationErr) return { ok: false, error: reservationErr.message };
    const row = reservation as ResRow | null;
    if (!row) return { ok: false, error: "Reservation not found for this guest." };
    if (isCheckedOutStatus(row.status) || isCanceledStatus(row.status)) {
      return { ok: false, error: "Only active or upcoming reservations can be edited here. Rebook this guest instead." };
    }

    const reservationStatus = (input.reservationStatus ?? "").trim().toLowerCase();
    const paymentStatus = (input.paymentStatus ?? "").trim().toLowerCase();
    const checkIn = (input.checkIn ?? "").trim() || row.check_in;
    const checkOut = (input.checkOut ?? "").trim() || row.check_out;
    if (!checkIn || !checkOut || checkIn >= checkOut) {
      return { ok: false, error: "Check-out must be after check-in." };
    }
    if (row.room_id) {
      const free = await isRoomAvailableForStay(supabase, tenantId, row.room_id, checkIn, checkOut, {
        excludeReservationId: row.id,
      });
      if (!free.ok) return { ok: false, error: free.error };
    }

    const patch: Record<string, string> = { check_in: checkIn, check_out: checkOut };
    if (reservationStatus && ["checked_in", "pending", "checked_out", "canceled", "cancelled"].includes(reservationStatus)) {
      patch.status = reservationStatus === "cancelled" ? "canceled" : reservationStatus;
    }
    if (paymentStatus === "paid" || paymentStatus === "pending") patch.payment_status = paymentStatus;
    const effectivePaymentStatus = patch.payment_status ?? row.payment_status ?? null;
    const currentReservationStatus = (row.status ?? "").toLowerCase();
    if (patch.status === "checked_out" && (effectivePaymentStatus ?? "").toLowerCase() !== "paid") {
      return { ok: false, error: "This reservation must be marked paid before checkout." };
    }
    if (patch.status === "canceled") {
      if (currentReservationStatus !== "pending" || (effectivePaymentStatus ?? "").toLowerCase() !== "pending") {
        return { ok: false, error: "Only reservations with pending status and pending payment can be canceled here." };
      }
    }
    if (Object.keys(patch).length > 0) {
      const { error: resErr } = await supabase
        .from("reservations")
        .update(patch)
        .eq("id", row.id)
        .eq("tenant_id", tenantId)
        .eq("guest_id", guestId);
      if (resErr) return { ok: false, error: resErr.message };
      await syncRoomOperationalStatus(supabase, tenantId, row.room_id, patch.status);
    }
  }

  revalidatePath("/hrrm/guests");
  revalidatePath("/hrrm/front-desk");
  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm/dashboard");
  revalidatePath("/hrrm/concierge");

  const refreshed = await fetchGuestDirectoryRow(tenantId, guestId);
  if (!refreshed) return { ok: false, error: "Guest was updated, but reloading details failed." };
  return { ok: true, row: refreshed };
}

export async function checkoutGuestStayAction(reservationId: string): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const tenantId = g.ctx.tenantId!;

  const supabase = await getSupabase();

  const { data: res, error: rErr } = await supabase
    .from("reservations")
    .select("id, tenant_id, room_id, check_in, check_out, status, payment_status")
    .eq("id", reservationId)
    .maybeSingle();

  if (rErr) return { ok: false, error: rErr.message };
  if (!res || res.tenant_id !== tenantId) return { ok: false, error: "Reservation not found." };
  const row = res as ResRow;
  if (isCheckedOutStatus(row.status)) {
    return { ok: false, error: "This stay is already checked out." };
  }
  if ((row.payment_status ?? "").toLowerCase() !== "paid") {
    return { ok: false, error: "This reservation must be marked paid before checkout." };
  }

  const t = localDateIso();
  if (t < row.check_in) {
    return { ok: false, error: "This stay has not started yet." };
  }

  let newCheckOut = t < row.check_out ? t : row.check_out;
  if (newCheckOut <= row.check_in) {
    newCheckOut = addLocalDays(row.check_in, 1);
  }

  const { error: uErr } = await supabase
    .from("reservations")
    .update({ status: "checked_out", check_out: newCheckOut })
    .eq("id", reservationId)
    .eq("tenant_id", tenantId);

  if (uErr) return { ok: false, error: uErr.message };
  await syncRoomOperationalStatus(supabase, tenantId, row.room_id, "checked_out");

  revalidatePath("/hrrm/guests");
  revalidatePath("/hrrm/front-desk");
  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm/dashboard");
  revalidatePath("/hrrm/concierge");
  return { ok: true };
}

export async function recheckGuestStayAction(reservationId: string): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const tenantId = g.ctx.tenantId!;

  const supabase = await getSupabase();

  const { data: res, error: rErr } = await supabase
    .from("reservations")
    .select("id, tenant_id, check_in, check_out, status, room_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (rErr) return { ok: false, error: rErr.message };
  if (!res || res.tenant_id !== tenantId) return { ok: false, error: "Reservation not found." };
  const row = res as ResRow;

  if (!isCheckedOutStatus(row.status)) {
    return { ok: false, error: "Recheck in is only for stays that are already checked out." };
  }
  if (!row.room_id) {
    return { ok: false, error: "This reservation has no room; create a new booking in the ledger." };
  }

  const today = localDateIso();
  const tomorrow = addLocalDays(today, 1);

  const free = await isRoomAvailableForStay(supabase, tenantId, row.room_id, today, tomorrow, {
    excludeReservationId: reservationId,
  });
  if (!free.ok) {
    return { ok: false, error: free.error };
  }

  const { error: uErr } = await supabase
    .from("reservations")
    .update({
      check_in: today,
      check_out: tomorrow,
      status: "checked_in",
    })
    .eq("id", reservationId)
    .eq("tenant_id", tenantId);

  if (uErr) return { ok: false, error: uErr.message };
  await syncRoomOperationalStatus(supabase, tenantId, row.room_id, "checked_in");

  revalidatePath("/hrrm/guests");
  revalidatePath("/hrrm/front-desk");
  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm/dashboard");
  revalidatePath("/hrrm/concierge");
  return { ok: true };
}
