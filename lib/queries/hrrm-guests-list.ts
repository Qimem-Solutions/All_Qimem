import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { localDateIso } from "@/lib/format";
import { nightsBetween } from "@/lib/hrrm-pricing";
import { isCanceledReservation } from "@/lib/queries/hrrm-availability";
import type { GuestDirectoryRow, GuestStaySummary } from "@/lib/hrrm-guest-directory";

export type { GuestDirectoryRow, GuestStaySummary } from "@/lib/hrrm-guest-directory";
export { formatGuestRowPayment } from "@/lib/hrrm-guest-directory";

const FULL_SELECT =
  "id, full_name, phone, created_at, age, party_size, registration_payment_cents, payment_method";
const MIN_SELECT = "id, full_name, phone, loyalty_tier, created_at";

function pickStayForGuest(
  reservations: {
    id: string;
    room_id: string | null;
    check_in: string;
    check_out: string;
    status: string | null;
  }[],
  roomMap: Map<string, string>,
  today: string,
): GuestStaySummary | null {
  const list = reservations.filter((r) => !isCanceledReservation(r.status));
  if (list.length === 0) return null;

  const inHouse = list.find((r) => r.check_in <= today && today < r.check_out);
  const chosen = inHouse
    ? inHouse
    : (() => {
        const upcoming = list
          .filter((r) => r.check_in > today)
          .sort((a, b) => a.check_in.localeCompare(b.check_in));
        if (upcoming[0]) return upcoming[0];
        return [...list].sort((a, b) => b.check_out.localeCompare(a.check_out))[0] ?? null;
      })();
  if (!chosen) return null;

  const nights = Math.max(0, nightsBetween(chosen.check_in, chosen.check_out));
  let label = "—";
  if (inHouse) label = "In house";
  else if (chosen.check_in > today) label = "Upcoming";
  else if (chosen.check_out <= today) label = "Checked out";

  return {
    reservationId: chosen.id,
    roomId: chosen.room_id,
    roomNumber: chosen.room_id ? (roomMap.get(chosen.room_id) ?? null) : null,
    checkIn: chosen.check_in,
    checkOut: chosen.check_out,
    nights: nights > 0 ? nights : null,
    label,
    rawStatus: chosen.status,
  };
}

const RES_SELECT = "id, guest_id, room_id, check_in, check_out, status";

/**
 * All guests for the property (newest first). Service role is used so front-desk staff
 * can see the full list (RLS may hide other users' guest rows from a plain JWT).
 */
export async function fetchTenantGuestsList(tenantId: string): Promise<{
  rows: GuestDirectoryRow[];
  error: string | null;
  columns: "full" | "basic";
}> {
  let useAdmin: ReturnType<typeof createServiceRoleClient> | null = null;
  try {
    useAdmin = createServiceRoleClient();
  } catch {
    /* .env */
  }
  const db = useAdmin ?? (await createClient());

  const run = (sel: string) =>
    db
      .from("guests")
      .select(sel)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500);

  const full = await run(FULL_SELECT);
  if (full.error) {
    const msg = full.error.message.toLowerCase();
    if (msg.includes("column") || msg.includes("schema")) {
      const basic = await run(MIN_SELECT);
      if (basic.error) {
        return { rows: [], error: basic.error.message, columns: "basic" };
      }
      const gRows = ((basic.data as unknown as BasicGuestRow[] | null) ?? []).map((g) => mapBasic(g));
      await attachStays(db, tenantId, gRows);
      return {
        rows: gRows,
        error: null,
        columns: "basic",
      };
    }
    return { rows: [], error: full.error.message, columns: "full" };
  }

  const mapped = ((full.data as unknown as Record<string, unknown>[] | null) ?? []).map((g) => mapFull(g));
  await attachStays(db, tenantId, mapped);
  return {
    rows: mapped,
    error: null,
    columns: "full",
  };
}

async function attachStays(
  db: ReturnType<typeof createServiceRoleClient> | (Awaited<ReturnType<typeof createClient>>),
  tenantId: string,
  rows: GuestDirectoryRow[],
) {
  if (rows.length === 0) return;
  const guestIds = rows.map((r) => r.id);
  const today = localDateIso();

  const { data: allRes, error: resErr } = await db
    .from("reservations")
    .select(RES_SELECT)
    .eq("tenant_id", tenantId)
    .in("guest_id", guestIds);

  if (resErr) {
    for (const r of rows) r.stay = null;
    return;
  }

  const resList = (allRes ?? []) as {
    id: string;
    guest_id: string;
    room_id: string | null;
    check_in: string;
    check_out: string;
    status: string | null;
  }[];

  const roomIds = [...new Set(resList.map((x) => x.room_id).filter(Boolean))] as string[];
  let roomMap = new Map<string, string>();
  if (roomIds.length > 0) {
    const { data: rooms } = await db.from("rooms").select("id, room_number").in("id", roomIds);
    roomMap = new Map((rooms ?? []).map((x) => [x.id, x.room_number]));
  }

  const byGuest = new Map<string, typeof resList>();
  for (const r of resList) {
    const arr = byGuest.get(r.guest_id) ?? [];
    arr.push(r);
    byGuest.set(r.guest_id, arr);
  }

  for (const row of rows) {
    const resForG = byGuest.get(row.id) ?? [];
    row.stay = pickStayForGuest(resForG, roomMap, today);
  }
}

function mapFull(g: Record<string, unknown>): GuestDirectoryRow {
  const c = g.registration_payment_cents;
  const pay =
    typeof c === "bigint" ? Number(c) : typeof c === "number" ? c : c != null ? Number(c) : null;
  return {
    id: String(g.id),
    full_name: String(g.full_name ?? "—"),
    phone: (g.phone as string) ?? null,
    created_at: (g.created_at as string) ?? null,
    age: g.age != null ? Number(g.age) : null,
    party_size: g.party_size != null ? Number(g.party_size) : null,
    registration_payment_cents: pay,
    payment_method: (g.payment_method as string) ?? null,
    stay: null,
  };
}

type BasicGuestRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string | null;
  loyalty_tier?: string | null;
};

function mapBasic(g: BasicGuestRow): GuestDirectoryRow {
  return {
    id: g.id,
    full_name: g.full_name,
    phone: g.phone,
    created_at: g.created_at,
    age: null,
    party_size: null,
    registration_payment_cents: null,
    payment_method: null,
    stay: null,
  };
}

/**
 * One guest row (directory + best stay) for modals and front desk “details”.
 */
export async function fetchGuestDirectoryRow(
  tenantId: string,
  guestId: string,
): Promise<GuestDirectoryRow | null> {
  let useAdmin: ReturnType<typeof createServiceRoleClient> | null = null;
  try {
    useAdmin = createServiceRoleClient();
  } catch {
    /* .env */
  }
  const db = useAdmin ?? (await createClient());

  const full = await db
    .from("guests")
    .select(FULL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", guestId)
    .maybeSingle();

  if (full.error) {
    if (full.error.message.toLowerCase().includes("column") || full.error.message.toLowerCase().includes("schema")) {
      const basic = await db
        .from("guests")
        .select(MIN_SELECT)
        .eq("tenant_id", tenantId)
        .eq("id", guestId)
        .maybeSingle();
      if (basic.error || !basic.data) return null;
      const gRow = mapBasic(basic.data as unknown as BasicGuestRow);
      await attachStays(db, tenantId, [gRow]);
      return gRow;
    }
    return null;
  }

  if (!full.data) return null;
  const gRow = mapFull(full.data as unknown as Record<string, unknown>);
  await attachStays(db, tenantId, [gRow]);
  return gRow;
}
