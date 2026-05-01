"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { HOTEL_CURRENCIES } from "@/lib/constants/hotel-settings";
import { normalizePrimaryBrandHex } from "@/lib/theme/tenant-brand-color";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { ETHIOPIA_REGIONS } from "@/lib/tenant-onboarding-options";

const CURRENCY_SET = new Set(HOTEL_CURRENCIES.map((c) => c.value));
const REGISTERED_ETHIOPIA_REGIONS = new Set<string>(ETHIOPIA_REGIONS);

export type HotelSettingsActionState = { ok: boolean; message?: string; error?: string } | null;

function requireHotelAdmin() {
  return getUserContext().then((ctx) => {
    if (!ctx?.tenantId || ctx.globalRole !== "hotel_admin") {
      return { ctx: null as Awaited<ReturnType<typeof getUserContext>>, tenantId: null as string | null };
    }
    return { ctx, tenantId: ctx.tenantId };
  });
}

function looseTime(s: string) {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  return t;
}

function looseEmail(s: string) {
  const t = s.trim();
  if (!t) return null;
  if (!t.includes("@") || t.length < 4) return null;
  return t;
}

export async function updateHotelGeneralSettings(
  _prev: HotelSettingsActionState,
  formData: FormData,
): Promise<HotelSettingsActionState> {
  const { tenantId } = await requireHotelAdmin();
  if (!tenantId) {
    return { ok: false, error: "Not authorized." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const regionSubmitted = String(formData.get("region") ?? "").trim();
  const region = regionSubmitted === "" ? null : regionSubmitted;
  const timezone = String(formData.get("timezone") ?? "UTC").trim() || "UTC";
  const default_currency = String(formData.get("default_currency") ?? "ETB").trim() || "ETB";
  if (!name) {
    return { ok: false, error: "Property name is required." };
  }
  if (!CURRENCY_SET.has(default_currency)) {
    return { ok: false, error: "Invalid currency." };
  }
  const supabase = await createClient();

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("region")
    .eq("id", tenantId)
    .maybeSingle();
  const prevRegionNorm = (tenantRow?.region as string | null | undefined)?.trim() ?? "";

  if (
    region &&
    !REGISTERED_ETHIOPIA_REGIONS.has(region) &&
    region !== prevRegionNorm
  ) {
    return {
      ok: false,
      error:
        "Region must be an Ethiopian federal region or chartered city from the list (or unchanged if your property uses a legacy value).",
    };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ name, region, timezone, default_currency })
    .eq("id", tenantId);
  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }
  revalidatePath("/hotel/settings");
  revalidatePath("/hotel/dashboard");
  revalidatePath("/hotel/modules");
  return { ok: true, message: "General settings saved." };
}

export async function updateHotelBrandingSettings(
  _prev: HotelSettingsActionState,
  formData: FormData,
): Promise<HotelSettingsActionState> {
  const { tenantId } = await requireHotelAdmin();
  if (!tenantId) {
    return { ok: false, error: "Not authorized." };
  }
  const primaryBrandRaw = String(formData.get("primary_brand_color") ?? "").trim();
  const primary_brand_color =
    primaryBrandRaw === ""
      ? null
      : normalizePrimaryBrandHex(primaryBrandRaw);
  if (primaryBrandRaw !== "" && !primary_brand_color) {
    return { ok: false, error: "Accent color must be a valid #RRGGBB hex value." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ primary_brand_color })
    .eq("id", tenantId);
  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }
  revalidatePath("/hotel/settings");
  revalidatePath("/hotel/dashboard");
  revalidatePath("/hotel/modules");
  return { ok: true, message: "Accent color saved." };
}

export async function updateHotelContactSettings(
  _prev: HotelSettingsActionState,
  formData: FormData,
): Promise<HotelSettingsActionState> {
  const { tenantId } = await requireHotelAdmin();
  if (!tenantId) {
    return { ok: false, error: "Not authorized." };
  }
  const contact_phone = String(formData.get("contact_phone") ?? "").trim() || null;
  const reservationsEmailRaw = String(formData.get("reservations_email") ?? "").trim();
  let reservations_email: string | null = null;
  if (reservationsEmailRaw) {
    const e = looseEmail(reservationsEmailRaw);
    if (!e) {
      return { ok: false, error: "Enter a valid reservations email, or leave it blank." };
    }
    reservations_email = e;
  }
  const checkIn = String(formData.get("default_check_in_time") ?? "");
  const checkOut = String(formData.get("default_check_out_time") ?? "");
  let default_check_in_time: string | null = null;
  if (checkIn.trim()) {
    const t = looseTime(checkIn);
    if (!t) {
      return { ok: false, error: "Check-in time must be like 15:00 (24h)." };
    }
    default_check_in_time = t;
  }
  let default_check_out_time: string | null = null;
  if (checkOut.trim()) {
    const t = looseTime(checkOut);
    if (!t) {
      return { ok: false, error: "Check-out time must be like 11:00 (24h)." };
    }
    default_check_out_time = t;
  }
  const policies_notes = String(formData.get("policies_notes") ?? "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      contact_phone,
      reservations_email,
      default_check_in_time,
      default_check_out_time,
      policies_notes,
    })
    .eq("id", tenantId);
  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }
  revalidatePath("/hotel/settings");
  return { ok: true, message: "Contact & policy details saved." };
}
