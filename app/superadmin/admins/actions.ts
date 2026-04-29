"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_HOTEL_ADMIN_PASSWORD } from "@/lib/constants/admin";
import { isMissingDbColumnError } from "@/lib/supabase/schema-errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateHotelAdminResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Creates an Auth user with email/password and sets profiles to hotel_admin for the selected tenant.
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 */
export async function createHotelAdminAction(input: {
  tenantId: string;
  fullName: string;
  email: string;
  password?: string;
}): Promise<CreateHotelAdminResult> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can create hotel admins." };
  }

  const tenantId = input.tenantId.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = (input.password?.trim() || DEFAULT_HOTEL_ADMIN_PASSWORD).trim();

  if (!tenantId) {
    return { ok: false, error: "Select a hotel." };
  }
  if (!fullName) {
    return { ok: false, error: "Enter the admin’s full name." };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid login email." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is missing in web/.env.local. Add it from Supabase → Settings → API.",
    };
  }

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tErr || !tenant) {
    return { ok: false, error: "Hotel not found." };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr) {
    const msg = createErr.message ?? "";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      return { ok: false, error: "That email is already registered. Use a different email or link the user in Supabase." };
    }
    return { ok: false, error: createErr.message };
  }

  const userId = created.user?.id;
  if (!userId) {
    return { ok: false, error: "Auth user was not returned." };
  }

  const profileRow = {
    id: userId,
    full_name: fullName,
    global_role: "hotel_admin" as const,
    tenant_id: tenantId,
    must_change_password: password === DEFAULT_HOTEL_ADMIN_PASSWORD,
  };

  let { error: profErr } = await admin.from("profiles").upsert(profileRow, { onConflict: "id" });

  if (profErr && isMissingDbColumnError(profErr)) {
    const { must_change_password: _m, ...withoutFlag } = profileRow;
    ({ error: profErr } = await admin.from("profiles").upsert(withoutFlag, { onConflict: "id" }));
  }

  if (profErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Profile failed: ${profErr.message}` };
  }

  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/tenants");

  return { ok: true };
}
