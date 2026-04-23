"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { localDateIso } from "@/lib/format";
import { fetchAvailabilityMatrix, isRoomAvailableForStay } from "@/lib/queries/hrrm-availability";
import { nightsBetween, quoteFromNightlyCents } from "@/lib/hrrm-pricing";

export type RegisterGuestResult =
  | { ok: true; guestId: string; profileLimited?: boolean; idImageNotSaved?: boolean }
  | { ok: false; error: string };

async function requireHrrmManage() {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false as const, error: "Not signed in on a property." };
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access !== "manage") {
    return { ok: false as const, error: "HRRM manage access is required to register guests." };
  }
  return { ok: true as const, ctx };
}

const BUCKET = "guest-id-documents";

const MIGRATION_HINT =
  "In Supabase Dashboard → SQL Editor, run the file supabase/migrations/20260429120000_ensure_guests_extended_columns.sql (date prefix 20260429, not 202404).";

function randomConfirmationCode(): string {
  const n = () => Math.floor(Math.random() * 36).toString(36);
  return `QIM-${Array.from({ length: 6 }, n).join("").toUpperCase()}`;
}

function reservationStatusForStay(checkIn: string, checkOut: string, today: string): string {
  if (checkIn <= today && today < checkOut) return "checked_in";
  if (checkIn > today) return "confirmed";
  return "checked_out";
}

export async function registerGuestAtFrontDeskAction(formData: FormData): Promise<RegisterGuestResult> {
  const g = await requireHrrmManage();
  if (!g.ok) return g;
  const ctx = g.ctx;

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { ok: false, error: "Guest name is required." };

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw || null;

  const roomIdRaw = String(formData.get("room_id") ?? "").trim();
  const checkIn = String(formData.get("check_in") ?? "").trim();
  const checkOut = String(formData.get("check_out") ?? "").trim();
  const hasAnyStayField = Boolean(roomIdRaw || checkIn || checkOut);
  const hasFullStay = Boolean(roomIdRaw && checkIn && checkOut);
  if (hasAnyStayField && !hasFullStay) {
    return { ok: false, error: "To book a room, select room, check-in, and check-out (all three)." };
  }
  const wantsStay = hasFullStay;
  const todayYmd = localDateIso();
  let roomTypeId: string | null = null;
  let stayTotalCents = 0;
  let resStatus: string = "confirmed";

  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    supabase = await createClient();
  }

  if (wantsStay) {
    if (checkIn >= checkOut) {
      return { ok: false, error: "Check-out must be after check-in." };
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      return { ok: false, error: "Stay must be at least one night." };
    }
    const free = await isRoomAvailableForStay(supabase, ctx.tenantId!, roomIdRaw, checkIn, checkOut);
    if (!free.ok) {
      return { ok: false, error: free.error };
    }
    const { data: roomRow, error: roomErr } = await supabase
      .from("rooms")
      .select("id, room_type_id")
      .eq("id", roomIdRaw)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (roomErr) return { ok: false, error: roomErr.message };
    if (!roomRow) return { ok: false, error: "Room not found for this property." };
    roomTypeId = (roomRow as { room_type_id: string | null }).room_type_id;

    if (roomTypeId) {
      const priceSlice = await fetchAvailabilityMatrix(ctx.tenantId!, checkIn, 1);
      const row = priceSlice.rows.find((r) => r.roomTypeId === roomTypeId);
      const nightly = row?.cells[0]?.priceCents ?? 0;
      stayTotalCents = quoteFromNightlyCents(nightly, nights).total;
    }
    resStatus = reservationStatusForStay(checkIn, checkOut, todayYmd);
  }

  const ageRaw = String(formData.get("age") ?? "").trim();
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : null;
  if (age != null && (Number.isNaN(age) || age < 0 || age > 130)) {
    return { ok: false, error: "Enter a valid age (0–130) or leave blank." };
  }

  const partyRaw = String(formData.get("party_size") ?? "1").trim();
  const partySize = Math.min(20, Math.max(1, parseInt(partyRaw, 10) || 1));

  const nationalIdNumber = String(formData.get("national_id_number") ?? "").trim() || null;
  const paymentMethod = String(formData.get("payment_method") ?? "cash").trim() || "cash";
  const dollarsRaw = String(formData.get("payment_dollars") ?? "0").trim();
  const paymentCents = Math.max(0, Math.round((Number.parseFloat(dollarsRaw) || 0) * 100));

  const file = formData.get("national_id_image");
  const isFile = file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0;

  if (isFile) {
    const f = file as File;
    if (f.size > 5 * 1024 * 1024) {
      return { ok: false, error: "National ID image must be 5MB or smaller." };
    }
    if (!/^(image\/jpeg|image\/png|image\/webp)$/i.test(f.type)) {
      return { ok: false, error: "Upload a JPEG, PNG, or WebP image for the national ID." };
    }
  }

  const fullRow = {
    tenant_id: ctx.tenantId!,
    full_name: fullName,
    phone,
    age: age,
    party_size: partySize,
    national_id_number: nationalIdNumber,
    registration_payment_cents: paymentCents,
    payment_method: paymentMethod,
  };

  const { data: ins, error: insErr } = await supabase.from("guests").insert(fullRow).select("id").single();

  let guestId: string | null = (ins?.id as string | undefined) ?? null;
  let profileLimited = false;

  if (insErr || !ins) {
    const msg = insErr?.message ?? "";
    const schemaProblem = /age|column|schema cache|Could not find|does not exist|PGRST204/i.test(msg);
    if (schemaProblem) {
      const minimal = await supabase
        .from("guests")
        .insert({ tenant_id: ctx.tenantId!, full_name: fullName, phone })
        .select("id")
        .single();
      if (minimal.error || !minimal.data?.id) {
        return {
          ok: false,
          error: `${msg} ${MIGRATION_HINT} If basic insert also failed: ${minimal.error?.message ?? "unknown error"}.`,
        };
      }
      guestId = minimal.data.id as string;
      profileLimited = true;
    } else {
      return { ok: false, error: msg || "Could not create guest." };
    }
  }

  if (!guestId) {
    return { ok: false, error: "Could not create guest." };
  }

  if (wantsStay) {
    const { error: resErr } = await supabase.from("reservations").insert({
      tenant_id: ctx.tenantId!,
      guest_id: guestId,
      room_id: roomIdRaw,
      check_in: checkIn,
      check_out: checkOut,
      status: resStatus,
      balance_cents: stayTotalCents,
      confirmation_code: randomConfirmationCode(),
    });
    if (resErr) {
      await supabase.from("guests").delete().eq("id", guestId);
      return { ok: false, error: resErr.message };
    }
  }

  let idImageNotSaved = false;
  if (isFile && !profileLimited) {
    let admin: ReturnType<typeof createServiceRoleClient>;
    try {
      admin = createServiceRoleClient();
    } catch {
      await supabase.from("reservations").delete().eq("guest_id", guestId);
      await supabase.from("guests").delete().eq("id", guestId);
      return { ok: false, error: "Storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local to upload ID images." };
    }
    const f = file as File;
    const ext = f.type.includes("png") ? "png" : f.type.includes("webp") ? "webp" : "jpg";
    const objectPath = `${ctx.tenantId}/${guestId}/national-id.${ext}`;
    const buffer = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await admin.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: f.type,
      upsert: true,
    });
    if (upErr) {
      await supabase.from("reservations").delete().eq("guest_id", guestId);
      await supabase.from("guests").delete().eq("id", guestId);
      return { ok: false, error: upErr.message };
    }
    const { error: updErr } = await supabase
      .from("guests")
      .update({ national_id_image_path: objectPath })
      .eq("id", guestId)
      .eq("tenant_id", ctx.tenantId!);
    if (updErr) {
      if (/column|schema cache|Could not find|does not exist/i.test(updErr.message)) {
        await admin.storage.from(BUCKET).remove([objectPath]);
        idImageNotSaved = true;
      } else {
        await supabase.from("reservations").delete().eq("guest_id", guestId);
        await supabase.from("guests").delete().eq("id", guestId);
        return { ok: false, error: updErr.message };
      }
    }
  }

  revalidatePath("/hrrm/front-desk");
  revalidatePath("/hrrm/guests");
  revalidatePath("/hrrm/concierge");
  revalidatePath("/hrrm/reservations");
  return {
    ok: true,
    guestId,
    profileLimited: profileLimited || undefined,
    idImageNotSaved: idImageNotSaved || undefined,
  };
}
