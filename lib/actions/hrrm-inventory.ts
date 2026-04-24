"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";

const INV = "/hrrm/inventory" as const;

type Ok = { ok: true } | { ok: false; error: string };

async function requireHrrmManage(): Promise<
  | { ok: true; tenantId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false, error: "You must be signed in on a property." };
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access !== "manage") {
    return { ok: false, error: "Manage access is required to change inventory." };
  }
  return { ok: true, tenantId: ctx.tenantId, supabase: await createClient() };
}

function revalidate() {
  revalidatePath(INV);
  revalidatePath("/hrrm/dashboard");
  revalidatePath("/hrrm/availability");
  revalidatePath("/hrrm/reservations");
}

// ——— Room types ———

function normalizeRoomTypePrice(price: number | null) {
  if (price == null) return null;
  if (!Number.isFinite(price) || price < 0) return Number.NaN;
  return Number(price.toFixed(2));
}

export async function createRoomTypeAction(input: {
  name: string;
  capacity: number | null;
  price: number | null;
}): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Room type name is required." };
  const cap = input.capacity;
  if (cap != null && (cap < 1 || cap > 20)) {
    return { ok: false, error: "Capacity should be between 1 and 20, or left empty for default." };
  }
  const price = normalizeRoomTypePrice(input.price);
  if (Number.isNaN(price)) {
    return { ok: false, error: "Price must be a valid number greater than or equal to 0." };
  }
  const { error } = await g.supabase.from("room_types").insert({
    tenant_id: g.tenantId,
    name,
    capacity: cap ?? 2,
    price,
  });
  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return { ok: false, error: "A room type with this name may already exist." };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function updateRoomTypeAction(input: {
  id: string;
  name: string;
  capacity: number | null;
  price: number | null;
}): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Room type name is required." };
  const cap = input.capacity;
  if (cap != null && (cap < 1 || cap > 20)) {
    return { ok: false, error: "Capacity should be between 1 and 20." };
  }
  const price = normalizeRoomTypePrice(input.price);
  if (Number.isNaN(price)) {
    return { ok: false, error: "Price must be a valid number greater than or equal to 0." };
  }
  const { data: row, error: typeLookupErr } = await g.supabase
    .from("room_types")
    .select("id, tenant_id")
    .eq("id", input.id)
    .maybeSingle();
  if (typeLookupErr || !row || row.tenant_id !== g.tenantId) {
    return { ok: false, error: "Room type not found." };
  }
  const { error } = await g.supabase
    .from("room_types")
    .update({ name, capacity: cap ?? 2, price })
    .eq("id", input.id)
    .eq("tenant_id", g.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteRoomTypeAction(id: string): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const { count, error: cErr } = await g.supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("room_type_id", id)
    .eq("tenant_id", g.tenantId);
  if (cErr) return { ok: false, error: cErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "Reassign or remove rooms that use this type before deleting the type.",
    };
  }
  const { error } = await g.supabase
    .from("room_types")
    .delete()
    .eq("id", id)
    .eq("tenant_id", g.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ——— Rooms ———

const HK = ["clean", "dirty"] as const;
const OP = [
  "available",
  "occupied",
  "out_of_order",
  "maintenance",
  "inactive",
] as const;

function normalizeHk(s: string) {
  const x = s.trim().toLowerCase();
  return (HK as readonly string[]).includes(x) ? x : "clean";
}
function normalizeOp(s: string) {
  const x = s.trim().toLowerCase();
  return (OP as readonly string[]).includes(x) ? x : "available";
}

export async function createRoomAction(input: {
  roomNumber: string;
  roomTypeId: string | null;
  floor: string | null;
  building: string | null;
  housekeepingStatus: string;
  operationalStatus: string;
}): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const num = input.roomNumber.trim();
  if (!num) return { ok: false, error: "Room number is required." };
  if (input.roomTypeId) {
    const { data: t } = await g.supabase
      .from("room_types")
      .select("id")
      .eq("id", input.roomTypeId)
      .eq("tenant_id", g.tenantId)
      .maybeSingle();
    if (!t) return { ok: false, error: "Invalid room type." };
  }
  const { error } = await g.supabase.from("rooms").insert({
    tenant_id: g.tenantId,
    room_number: num,
    room_type_id: input.roomTypeId,
    floor: input.floor?.trim() || null,
    building: input.building?.trim() || null,
    housekeeping_status: normalizeHk(input.housekeepingStatus),
    operational_status: normalizeOp(input.operationalStatus),
  });
  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return { ok: false, error: `Room number "${num}" already exists for this property.` };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function updateRoomAction(input: {
  id: string;
  roomNumber: string;
  roomTypeId: string | null;
  floor: string | null;
  building: string | null;
  housekeepingStatus: string;
  operationalStatus: string;
}): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const num = input.roomNumber.trim();
  if (!num) return { ok: false, error: "Room number is required." };
  if (input.roomTypeId) {
    const { data: t } = await g.supabase
      .from("room_types")
      .select("id")
      .eq("id", input.roomTypeId)
      .eq("tenant_id", g.tenantId)
      .maybeSingle();
    if (!t) return { ok: false, error: "Invalid room type." };
  }
  const { data: room, error: rs } = await g.supabase
    .from("rooms")
    .select("id, tenant_id")
    .eq("id", input.id)
    .maybeSingle();
  if (rs || !room || room.tenant_id !== g.tenantId) {
    return { ok: false, error: "Room not found." };
  }
  const { error } = await g.supabase
    .from("rooms")
    .update({
      room_number: num,
      room_type_id: input.roomTypeId,
      floor: input.floor?.trim() || null,
      building: input.building?.trim() || null,
      housekeeping_status: normalizeHk(input.housekeepingStatus),
      operational_status: normalizeOp(input.operationalStatus),
    })
    .eq("id", input.id)
    .eq("tenant_id", g.tenantId);
  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return { ok: false, error: `Room number "${num}" is already in use.` };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function deleteRoomAction(id: string): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const { data: room, error: rErr } = await g.supabase
    .from("rooms")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (rErr || !room || room.tenant_id !== g.tenantId) {
    return { ok: false, error: "Room not found." };
  }
  const { count, error: cErr } = await g.supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("room_id", id)
    .eq("tenant_id", g.tenantId);
  if (cErr) return { ok: false, error: cErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This room is linked to reservations. Set it to out of order or inactive instead, or reassign future reservations.",
    };
  }
  const { error } = await g.supabase.from("rooms").delete().eq("id", id).eq("tenant_id", g.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function setRoomOperationalStatusAction(input: { id: string; operationalStatus: string }): Promise<Ok> {
  return updateRoomFieldPartial({
    id: input.id,
    patch: { operational_status: normalizeOp(input.operationalStatus) },
  });
}

export async function setRoomHousekeepingStatusAction(input: { id: string; housekeepingStatus: string }): Promise<Ok> {
  return updateRoomFieldPartial({
    id: input.id,
    patch: { housekeeping_status: normalizeHk(input.housekeepingStatus) },
  });
}

async function updateRoomFieldPartial(input: {
  id: string;
  patch: { operational_status?: string; housekeeping_status?: string };
}): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const { data: room, error: rErr } = await g.supabase
    .from("rooms")
    .select("id, tenant_id")
    .eq("id", input.id)
    .maybeSingle();
  if (rErr || !room || room.tenant_id !== g.tenantId) {
    return { ok: false, error: "Room not found." };
  }
  const { error } = await g.supabase
    .from("rooms")
    .update(input.patch)
    .eq("id", input.id)
    .eq("tenant_id", g.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
