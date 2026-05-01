"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { isRoomAvailableForStay } from "@/lib/queries/hrrm-availability";

type Ok = { ok: true } | { ok: false; error: string };

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

async function getDb() {
  try {
    return createServiceRoleClient();
  } catch {
    return await createClient();
  }
}

function normalizeReservationStatus(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (["pending", "checked_in", "checked_out", "canceled", "cancelled"].includes(value)) {
    return value === "cancelled" ? "canceled" : value;
  }
  return null;
}

function normalizePaymentStatus(raw: string): "pending" | "paid" | null {
  const value = raw.trim().toLowerCase();
  if (value === "pending" || value === "paid") return value;
  return null;
}

export async function updateReservationLedgerAction(input: {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  paymentStatus: string;
}): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;

  const db = await getDb();
  const tenantId = g.ctx.tenantId!;
  const reservationId = input.reservationId.trim();
  const checkIn = input.checkIn.trim();
  const checkOut = input.checkOut.trim();
  if (!reservationId || !checkIn || !checkOut || checkIn >= checkOut) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  const status = normalizeReservationStatus(input.status);
  if (!status) return { ok: false, error: "Invalid reservation status." };
  const paymentStatus = normalizePaymentStatus(input.paymentStatus);
  if (!paymentStatus) return { ok: false, error: "Invalid payment status." };

  const { data: reservation, error: reservationErr } = await db
    .from("reservations")
    .select("id, tenant_id, room_id")
    .eq("id", reservationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reservationErr) return { ok: false, error: reservationErr.message };
  if (!reservation) return { ok: false, error: "Reservation not found." };

  if (reservation.room_id) {
    const free = await isRoomAvailableForStay(db, tenantId, reservation.room_id, checkIn, checkOut, {
      excludeReservationId: reservationId,
    });
    if (!free.ok) return free;
  }

  if (status === "checked_out" && paymentStatus !== "paid") {
    return { ok: false, error: "This reservation must be marked paid before checkout." };
  }

  const { error } = await db
    .from("reservations")
    .update({
      check_in: checkIn,
      check_out: checkOut,
      status,
      payment_status: paymentStatus,
    })
    .eq("id", reservationId)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm/front-desk");
  revalidatePath("/hrrm/guests");
  revalidatePath("/hrrm/dashboard");
  revalidatePath("/hrrm/availability");
  return { ok: true };
}
