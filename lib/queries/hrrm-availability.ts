import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nightsBetween } from "@/lib/hrrm-pricing";

export type AvailabilityDay = {
  date: string;
  label: string;
};

export type AvailabilityCell = {
  date: string;
  priceCents: number;
  available: number;
  physical: number;
  rooms: AvailabilityRoomSnapshot[];
};

export type AvailabilityRoomSnapshot = {
  id: string;
  roomNumber: string;
  occupied: boolean;
  reservationStatus: string | null;
};

export type AvailabilityRow = {
  roomTypeId: string;
  roomTypeName: string;
  capacity: number | null;
  nightlyCents: number;
  cells: AvailabilityCell[];
};

export type AvailabilityMatrix = {
  days: AvailabilityDay[];
  rows: AvailabilityRow[];
  totalPhysicalRooms: number;
  /** Per-day: booked rooms / total physical (0–1) for chart */
  occupancyByDate: number[];
  /** Weighted mean nightly rate in cents across types (for ADR card) */
  adrCents: number | null;
  error: string | null;
};

export type AvailableRoomForStay = {
  id: string;
  room_number: string;
  room_type_id: string | null;
  room_type_name: string | null;
  nightlyCents: number;
  totalCents: number;
};

function roomTypePriceToCents(price: number | string | null | undefined): number {
  if (price == null) return 0;
  const amount = typeof price === "number" ? price : Number.parseFloat(String(price));
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

export function isCanceledReservation(status: string | null): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "canceled" || s === "cancelled";
}

export function isBlockingReservationStatus(status: string | null): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "pending" || s === "checked_in";
}

export function isFinishedReservation(status: string | null): boolean {
  const s = (status ?? "").toLowerCase();
  return (
    s === "canceled" ||
    s === "cancelled" ||
    s === "checked_out" ||
    s === "completed" ||
    s === "departed"
  );
}

/** Night D is occupied if check_in <= D < check_out (date strings). */
function reservationCoversDate(checkIn: string, checkOut: string, d: string): boolean {
  return checkIn <= d && checkOut > d;
}

function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && aOut > bIn;
}

async function getAvailabilityDb() {
  try {
    return createServiceRoleClient();
  } catch {
    return await createClient();
  }
}

export function enumerateHorizon(startIso: string, dayCount: number): AvailabilityDay[] {
  const out: AvailabilityDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDaysIso(startIso, i);
    out.push({ date, label: dayLabel(date) });
  }
  return out;
}

/**
 * Loads nightly availability by room type and day, using rooms + reservations + room type pricing.
 */
export async function fetchAvailabilityMatrix(
  tenantId: string,
  startIso: string,
  dayCount: number,
): Promise<AvailabilityMatrix> {
  const supabase = await getAvailabilityDb();
  const days = enumerateHorizon(startIso, dayCount);

  const [typesRes, roomsRes, resRes] = await Promise.all([
    supabase.from("room_types").select("id, name, capacity, price").eq("tenant_id", tenantId).order("name"),
    supabase
      .from("rooms")
      .select("id, room_type_id, room_number")
      .eq("tenant_id", tenantId),
    supabase
      .from("reservations")
      .select("id, room_id, check_in, check_out, status")
      .eq("tenant_id", tenantId)
      .not("room_id", "is", null),
  ]);

  const err =
    typesRes.error?.message ||
    roomsRes.error?.message ||
    resRes.error?.message ||
    null;
  if (err) {
    return {
      days,
      rows: [],
      totalPhysicalRooms: 0,
      occupancyByDate: days.map(() => 0),
      adrCents: null,
      error: err,
    };
  }

  const roomTypes = typesRes.data ?? [];
  const rooms = roomsRes.data ?? [];
  const reservations = (resRes.data ?? []).filter((r) => isBlockingReservationStatus(r.status));

  const roomsByType = new Map<string, { id: string; roomNumber: string }[]>();
  for (const r of rooms) {
    const tid = r.room_type_id;
    if (!tid) continue;
    const list = roomsByType.get(tid) ?? [];
    list.push({ id: r.id, roomNumber: r.room_number });
    roomsByType.set(tid, list);
  }

  let totalPhysical = 0;
  for (const [, list] of roomsByType) {
    totalPhysical += list.length;
  }

  const blockingReservationsByRoomId = new Map<
    string,
    { room_id: string | null; check_in: string; check_out: string; status: string | null }[]
  >();
  for (const reservation of reservations) {
    if (!reservation.room_id) continue;
    const list = blockingReservationsByRoomId.get(reservation.room_id) ?? [];
    list.push(reservation);
    blockingReservationsByRoomId.set(reservation.room_id, list);
  }

  const rows: AvailabilityRow[] = roomTypes.map((t) => {
    const list = roomsByType.get(t.id) ?? [];
    const roomIds = new Set(list.map((x) => x.id));
    const physical = roomIds.size;
    const priceCents = roomTypePriceToCents(t.price);

    const cells: AvailabilityCell[] = days.map(({ date: d }) => {
      const roomSnapshots = list
        .map((room) => {
          const matchingReservation = (blockingReservationsByRoomId.get(room.id) ?? []).find((reservation) =>
            reservationCoversDate(reservation.check_in, reservation.check_out, d),
          );
          return {
            id: room.id,
            roomNumber: room.roomNumber,
            occupied: Boolean(matchingReservation),
            reservationStatus: matchingReservation?.status ?? null,
          };
        })
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: "base" }));
      const booked = roomSnapshots.filter((room) => room.occupied).length;
      const available = Math.max(0, physical - booked);
      return {
        date: d,
        priceCents,
        available,
        physical,
        rooms: roomSnapshots,
      };
    });

    return {
      roomTypeId: t.id,
      roomTypeName: t.name,
      capacity: t.capacity,
      nightlyCents: priceCents,
      cells,
    };
  });

  const occupancyByDate: number[] = days.map(({ date: d }) => {
    if (totalPhysical <= 0) return 0;
    let bookedAll = 0;
    for (const res of reservations) {
      if (!res.room_id) continue;
      if (reservationCoversDate(res.check_in, res.check_out, d)) bookedAll += 1;
    }
    return Math.min(1, bookedAll / totalPhysical);
  });

  let adrSum = 0;
  let adrW = 0;
  for (const row of rows) {
    const p = row.cells[0]?.priceCents ?? 0;
    const phys = row.cells[0]?.physical ?? 0;
    if (phys > 0 && p > 0) {
      adrSum += p * phys;
      adrW += phys;
    }
  }
  const adrCents = adrW > 0 ? Math.round(adrSum / adrW) : null;

  return {
    days,
    rows,
    totalPhysicalRooms: totalPhysical,
    occupancyByDate,
    adrCents,
    error: null,
  };
}

export type GuestSearchRow = {
  id: string;
  full_name: string;
  phone: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function searchGuestsForTenant(
  tenantId: string,
  q: string,
  limit = 12,
): Promise<{ rows: GuestSearchRow[]; error: string | null }> {
  const term = q.trim();
  if (term.length < 2) return { rows: [], error: null };

  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    supabase = await createClient();
  }

  const like = `%${term}%`;

  const [byName, byPhone, byId] = await Promise.all([
    supabase
      .from("guests")
      .select("id, full_name, phone")
      .eq("tenant_id", tenantId)
      .ilike("full_name", like)
      .limit(limit),
    supabase
      .from("guests")
      .select("id, full_name, phone")
      .eq("tenant_id", tenantId)
      .ilike("phone", like)
      .limit(limit),
    UUID_RE.test(term)
      ? supabase
          .from("guests")
          .select("id, full_name, phone")
          .eq("tenant_id", tenantId)
          .eq("id", term)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null as null }),
  ]);

  const err = byName.error?.message || byPhone.error?.message || byId.error?.message;
  if (err) return { rows: [], error: err };

  const map = new Map<string, GuestSearchRow>();
  for (const r of byName.data ?? []) map.set(r.id, r);
  for (const r of byPhone.data ?? []) map.set(r.id, r);
  if (byId.data) map.set(byId.data.id, byId.data as GuestSearchRow);

  return { rows: [...map.values()].slice(0, limit), error: null };
}

export { rangesOverlap, reservationCoversDate };

export async function findAvailableRoomForStay(
  tenantId: string,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  supabaseClient?: SupabaseClient,
): Promise<{ roomId: string | null; roomNumber: string | null; error: string | null }> {
  const supabase = supabaseClient ?? (await getAvailabilityDb());
  const { data: typeRooms, error: trErr } = await supabase
    .from("rooms")
    .select("id, room_number")
    .eq("tenant_id", tenantId)
    .eq("room_type_id", roomTypeId)
    .order("room_number");

  if (trErr) return { roomId: null, roomNumber: null, error: trErr.message };

  const rooms = typeRooms ?? [];
  if (rooms.length === 0) {
    return { roomId: null, roomNumber: null, error: "No rooms found for this type." };
  }

  const { data: resList, error: rErr } = await supabase
    .from("reservations")
    .select("room_id, check_in, check_out, status")
    .eq("tenant_id", tenantId)
    .not("room_id", "is", null);

  if (rErr) return { roomId: null, roomNumber: null, error: rErr.message };

  const blocking = (resList ?? []).filter((r) => isBlockingReservationStatus(r.status));

  for (const room of rooms) {
    let free = true;
    for (const r of blocking) {
      if (r.room_id !== room.id) continue;
      if (rangesOverlap(checkIn, checkOut, r.check_in, r.check_out)) {
        free = false;
        break;
      }
    }
    if (free) {
      return { roomId: room.id, roomNumber: room.room_number, error: null };
    }
  }

  return { roomId: null, roomNumber: null, error: "No room is free for those dates." };
}

export async function listAvailableRoomsForStay(
  tenantId: string,
  checkIn: string,
  checkOut: string,
): Promise<{ rows: AvailableRoomForStay[]; error: string | null }> {
  const nights = nightsBetween(checkIn, checkOut);
  if (!checkIn || !checkOut || checkIn >= checkOut || nights < 1) {
    return { rows: [], error: "Check-out must be after check-in." };
  }

  const supabase = await getAvailabilityDb();
  const [typesRes, roomsRes, resRes] = await Promise.all([
    supabase.from("room_types").select("id, name, price").eq("tenant_id", tenantId),
    supabase
      .from("rooms")
      .select("id, room_number, room_type_id")
      .eq("tenant_id", tenantId)
      .order("room_number"),
    supabase
      .from("reservations")
      .select("room_id, check_in, check_out, status")
      .eq("tenant_id", tenantId)
      .not("room_id", "is", null)
      .lt("check_in", checkOut)
      .gt("check_out", checkIn),
  ]);

  const error =
    typesRes.error?.message ||
    roomsRes.error?.message ||
    resRes.error?.message ||
    null;
  if (error) return { rows: [], error };

  const typeMetaById = new Map<string, { name: string; priceCents: number }>();
  for (const t of typesRes.data ?? []) {
    typeMetaById.set(t.id, { name: t.name, priceCents: roomTypePriceToCents(t.price) });
  }

  const blockingRoomIds = new Set(
    (resRes.data ?? []).filter((r) => isBlockingReservationStatus(r.status)).map((r) => r.room_id as string),
  );

  const rows: AvailableRoomForStay[] = (roomsRes.data ?? [])
    .filter((room) => !blockingRoomIds.has(room.id))
    .map((room) => {
      const typeMeta = room.room_type_id ? typeMetaById.get(room.room_type_id) ?? null : null;
      const nightlyCents = typeMeta?.priceCents ?? 0;
      const totalCents = nightlyCents * nights;
      return {
        id: room.id,
        room_number: room.room_number,
        room_type_id: room.room_type_id,
        room_type_name: typeMeta?.name ?? null,
        nightlyCents,
        totalCents,
      };
    });

  return { rows, error: null };
}

type RoomPick = { id: string; tenant_id: string };

/**
 * True when this room exists for the tenant and has no active stay overlapping [checkIn, checkOut).
 * Use `excludeReservationId` when updating an existing reservation’s dates.
 */
export async function isRoomAvailableForStay(
  supabase: SupabaseClient,
  tenantId: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
  opts?: { excludeReservationId?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: room, error: rErr } = await supabase
    .from("rooms")
    .select("id, tenant_id")
    .eq("id", roomId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (rErr) return { ok: false, error: rErr.message };
  const r = room as RoomPick | null;
  if (!r) return { ok: false, error: "Room not found for this property." };

  const { data: resList, error: resErr } = await supabase
    .from("reservations")
    .select("id, room_id, check_in, check_out, status")
    .eq("tenant_id", tenantId)
    .eq("room_id", roomId);

  if (resErr) return { ok: false, error: resErr.message };

  const blocking = (resList ?? [])
    .filter((x) => isBlockingReservationStatus(x.status))
    .filter((x) => (opts?.excludeReservationId ? x.id !== opts.excludeReservationId : true));
  for (const b of blocking) {
    if (rangesOverlap(checkIn, checkOut, b.check_in, b.check_out)) {
      return { ok: false, error: "This room is already booked for part of that stay." };
    }
  }

  return { ok: true };
}
