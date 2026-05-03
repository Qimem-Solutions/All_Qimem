"use server";

import { createClient } from "@/lib/supabase/server";

export type PublicBookingQuoteRoomType = {
  room_type_id: string;
  name: string;
  capacity: number | null;
  nightly_cents: number;
  available_count: number;
  stay_total_one_room_cents: number;
};

export type PublicBookingQuoteOk = {
  ok: true;
  tenant_id: string;
  currency: string;
  check_in: string;
  check_out: string;
  nights: number;
  room_types: PublicBookingQuoteRoomType[];
};

export type PublicBookingQuoteErr = { ok: false; error: string };

export type PublicBookingQuoteResult = PublicBookingQuoteOk | PublicBookingQuoteErr;

function parseRoomTypes(raw: unknown): PublicBookingQuoteRoomType[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicBookingQuoteRoomType[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = o.room_type_id;
    const name = o.name;
    if (typeof id !== "string" || typeof name !== "string") continue;
    const nightly = Number(o.nightly_cents);
    const avail = Number(o.available_count);
    const total = Number(o.stay_total_one_room_cents);
    const cap = o.capacity;
    out.push({
      room_type_id: id,
      name,
      capacity: typeof cap === "number" ? cap : cap != null ? Number(cap) : null,
      nightly_cents: Number.isFinite(nightly) ? nightly : 0,
      available_count: Number.isFinite(avail) ? avail : 0,
      stay_total_one_room_cents: Number.isFinite(total) ? total : 0,
    });
  }
  return out;
}

/**
 * Anonymous-safe availability + indicative pricing for the public portfolio booking widget.
 */
export async function fetchPublicBookingQuoteAction(
  slug: string,
  checkIn: string,
  checkOut: string,
): Promise<PublicBookingQuoteResult> {
  const s = slug?.trim();
  if (!s) return { ok: false, error: "invalid_slug" };

  const ci = checkIn?.trim();
  const co = checkOut?.trim();
  if (!ci || !co || ci >= co) return { ok: false, error: "invalid_dates" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tenant_public_booking_quote_by_slug", {
    p_slug: s,
    p_check_in: ci,
    p_check_out: co,
  });

  if (error) return { ok: false, error: error.message };

  if (!data || typeof data !== "object") return { ok: false, error: "empty_response" };

  const o = data as Record<string, unknown>;
  if (o.ok !== true) {
    const err = typeof o.error === "string" ? o.error : "unknown";
    return { ok: false, error: err };
  }

  const tenantId = o.tenant_id;
  const currency = o.currency;
  if (typeof tenantId !== "string" || typeof currency !== "string") {
    return { ok: false, error: "malformed_response" };
  }

  const nights = Number(o.nights);
  const check_in = o.check_in;
  const check_out = o.check_out;
  if (
    typeof check_in !== "string" ||
    typeof check_out !== "string" ||
    !Number.isFinite(nights) ||
    nights < 1
  ) {
    return { ok: false, error: "malformed_response" };
  }

  return {
    ok: true,
    tenant_id: tenantId,
    currency,
    check_in,
    check_out,
    nights,
    room_types: parseRoomTypes(o.room_types),
  };
}
