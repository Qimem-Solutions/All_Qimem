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

function isCheckedOutStatus(s: string | null | undefined): boolean {
  const x = (s ?? "").toLowerCase();
  return x === "checked_out" || x === "completed" || x === "departed";
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

export async function checkoutGuestStayAction(reservationId: string): Promise<Ok> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const tenantId = g.ctx.tenantId!;

  const supabase = await getSupabase();

  const { data: res, error: rErr } = await supabase
    .from("reservations")
    .select("id, tenant_id, check_in, check_out, status")
    .eq("id", reservationId)
    .maybeSingle();

  if (rErr) return { ok: false, error: rErr.message };
  if (!res || res.tenant_id !== tenantId) return { ok: false, error: "Reservation not found." };
  const row = res as ResRow;
  if (isCheckedOutStatus(row.status)) {
    return { ok: false, error: "This stay is already checked out." };
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

  revalidatePath("/hrrm/guests");
  revalidatePath("/hrrm/front-desk");
  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm/dashboard");
  revalidatePath("/hrrm/concierge");
  return { ok: true };
}
