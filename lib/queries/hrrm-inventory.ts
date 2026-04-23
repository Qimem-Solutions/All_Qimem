import { createClient } from "@/lib/supabase/server";

export type RoomTypeRow = {
  id: string;
  name: string;
  capacity: number | null;
  tenant_id: string;
};

export type RoomInventoryRow = {
  id: string;
  tenant_id: string;
  room_number: string;
  floor: string | null;
  building: string | null;
  housekeeping_status: string | null;
  operational_status: string | null;
  room_type_id: string | null;
  room_type_name: string | null;
};

export async function fetchRoomTypes(tenantId: string): Promise<{
  rows: RoomTypeRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_types")
    .select("id, name, capacity, tenant_id")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as RoomTypeRow[], error: null };
}

/** Rooms with type names for inventory UI. */
export async function fetchRoomsInventory(tenantId: string): Promise<{
  rows: RoomInventoryRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: rooms, error: rErr } = await supabase
    .from("rooms")
    .select(
      "id, tenant_id, room_number, floor, building, housekeeping_status, operational_status, room_type_id",
    )
    .eq("tenant_id", tenantId)
    .order("room_number", { ascending: true });
  if (rErr) return { rows: [], error: rErr.message };

  const typeIds = [
    ...new Set((rooms ?? []).map((r) => r.room_type_id).filter(Boolean)),
  ] as string[];
  let typeMap = new Map<string, string>();
  if (typeIds.length > 0) {
    const { data: types } = await supabase
      .from("room_types")
      .select("id, name")
      .in("id", typeIds);
    typeMap = new Map((types ?? []).map((t) => [t.id, t.name]));
  }

  const rows: RoomInventoryRow[] = (rooms ?? []).map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    room_number: r.room_number,
    floor: r.floor,
    building: r.building,
    housekeeping_status: r.housekeeping_status,
    operational_status: r.operational_status,
    room_type_id: r.room_type_id,
    room_type_name: r.room_type_id ? (typeMap.get(r.room_type_id) ?? null) : null,
  }));
  return { rows, error: null };
}
