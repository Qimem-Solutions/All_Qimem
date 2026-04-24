import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { addLocalDays } from "@/lib/format";
import { isFinishedReservation } from "@/lib/queries/hrrm-availability";

function getAddisIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function getAddisHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  return Number.parseInt(hour, 10);
}

export async function syncOvernightOccupiedRoomsToDirty(tenantId: string): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  if (getAddisHour() < 6) {
    return { ok: true, updated: 0 };
  }

  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    supabase = await createClient();
  }

  const todayIso = getAddisIsoDate();
  const yesterdayIso = addLocalDays(todayIso, -1);

  const { data: reservations, error: reservationErr } = await supabase
    .from("reservations")
    .select("room_id, check_in, check_out, status")
    .eq("tenant_id", tenantId)
    .not("room_id", "is", null);

  if (reservationErr) return { ok: false, error: reservationErr.message };

  const occupiedOvernightRoomIds = [...new Set(
    (reservations ?? [])
      .filter((reservation) => {
        if (!reservation.room_id) return false;
        if (isFinishedReservation(reservation.status)) return false;
        return reservation.check_in <= yesterdayIso && reservation.check_out >= todayIso;
      })
      .map((reservation) => reservation.room_id as string),
  )];

  if (occupiedOvernightRoomIds.length === 0) {
    return { ok: true, updated: 0 };
  }

  const { data: rooms, error: roomErr } = await supabase
    .from("rooms")
    .select("id, housekeeping_status")
    .eq("tenant_id", tenantId)
    .in("id", occupiedOvernightRoomIds);

  if (roomErr) return { ok: false, error: roomErr.message };

  const toDirty = (rooms ?? [])
    .filter((room) => (room.housekeeping_status ?? "clean").toLowerCase() !== "dirty")
    .map((room) => room.id);

  if (toDirty.length === 0) {
    return { ok: true, updated: 0 };
  }

  const { error: updateErr } = await supabase
    .from("rooms")
    .update({ housekeeping_status: "dirty" })
    .eq("tenant_id", tenantId)
    .in("id", toDirty);

  if (updateErr) return { ok: false, error: updateErr.message };

  return { ok: true, updated: toDirty.length };
}
