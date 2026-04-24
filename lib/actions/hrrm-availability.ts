"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { searchGuestsForTenant, findAvailableRoomForStay } from "@/lib/queries/hrrm-availability";
import { nightsBetween } from "@/lib/hrrm-pricing";

type Ok = { ok: true } | { ok: false; error: string };

type HrrmViewGate =
  | { ok: true; tenantId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string };

type HrrmManageGate = HrrmViewGate;

const PATH = "/hrrm/availability" as const;

async function syncRoomStatusForReservation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  roomId: string,
  reservationStatus: string,
) {
  const status = reservationStatus.toLowerCase();
  let operationalStatus: string | null = null;
  if (["pending", "confirmed", "checked_in"].includes(status)) operationalStatus = "occupied";
  else if (["checked_out", "completed", "departed", "canceled", "cancelled"].includes(status)) operationalStatus = "available";
  if (!operationalStatus) return;

  await supabase
    .from("rooms")
    .update({ operational_status: operationalStatus })
    .eq("id", roomId)
    .eq("tenant_id", tenantId);
}

function revalidateHrrm() {
  revalidatePath(PATH);
  revalidatePath("/hrrm/dashboard");
  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm/concierge");
}

async function requireHrrmView(): Promise<HrrmViewGate> {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false, error: "You must be signed in on a property." };
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access === "none") {
    return { ok: false, error: "HRRM access is required." };
  }
  return { ok: true, tenantId: ctx.tenantId, supabase: await createClient() };
}

async function requireHrrmManage(): Promise<HrrmManageGate> {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false, error: "You must be signed in on a property." };
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access !== "manage") {
    return { ok: false, error: "Manage access is required to create or hold reservations." };
  }
  return { ok: true, tenantId: ctx.tenantId, supabase: await createClient() };
}

function randomConfirmationCode(): string {
  const n = () => Math.floor(Math.random() * 36).toString(36);
  const s = Array.from({ length: 6 }, n).join("").toUpperCase();
  return `QIM-${s}`;
}

export async function searchGuestsHrrmAction(
  q: string,
): Promise<{ ok: true; rows: { id: string; full_name: string; phone: string | null }[] } | { ok: false; error: string }> {
  const g = await requireHrrmView();
  if (!g.ok) return g;
  const { rows, error } = await searchGuestsForTenant(g.tenantId, q);
  if (error) return { ok: false, error };
  return { ok: true, rows };
}

type CreateResInput = {
  guestId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  mode: "hold" | "confirm";
};

export async function createQuickReservationAction(input: CreateResInput): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;

  const checkIn = input.checkIn.trim();
  const checkOut = input.checkOut.trim();
  if (!checkIn || !checkOut || checkIn >= checkOut) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    return { ok: false, error: "Stay must be at least one night." };
  }

  const { roomId, error: roomErr } = await findAvailableRoomForStay(
    g.tenantId,
    input.roomTypeId,
    checkIn,
    checkOut,
  );
  if (roomErr || !roomId) {
    return { ok: false, error: roomErr ?? "No room available for those dates." };
  }

  const { data: roomTypeRow, error: typeErr } = await g.supabase
    .from("room_types")
    .select("price")
    .eq("id", input.roomTypeId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (typeErr) return { ok: false, error: typeErr.message };
  const nightly = roomTypeRow?.price == null ? 0 : Math.round(Number(roomTypeRow.price) * 100);
  const total = nightly * nights;

  const status = input.mode === "hold" ? "pending" : "confirmed";
  const { error: insErr } = await g.supabase.from("reservations").insert({
    tenant_id: g.tenantId,
    guest_id: input.guestId,
    room_id: roomId,
    check_in: checkIn,
    check_out: checkOut,
    status,
    balance_cents: total,
    payment_status: "pending",
    confirmation_code: randomConfirmationCode(),
  });
  if (insErr) return { ok: false, error: insErr.message };
  await syncRoomStatusForReservation(g.supabase, g.tenantId, roomId, status);

  revalidateHrrm();
  return { ok: true };
}
