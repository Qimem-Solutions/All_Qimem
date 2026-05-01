"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_HOTEL_ADMIN_PASSWORD } from "@/lib/constants/admin";
import { isMissingDbColumnError } from "@/lib/supabase/schema-errors";
import { toUserFacingError } from "@/lib/errors/user-facing";

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
        "This action isn’t available because the server isn’t fully configured. Please contact your platform administrator.",
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
      return { ok: false, error: "That email is already registered. Try another email address." };
    }
    return { ok: false, error: toUserFacingError(createErr.message) };
  }

  const userId = created.user?.id;
  if (!userId) {
    return {
      ok: false,
      error: "Something went wrong while creating the account. Please try again or contact support.",
    };
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
    return {
      ok: false,
      error: toUserFacingError(profErr.message, {
        fallback: "We couldn’t finish saving this administrator’s profile.",
      }),
    };
  }

  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/tenants");

  return { ok: true };
}

export type AdminMutationResult = { ok: true } | { ok: false; error: string };

async function requireSuperadminAdminClient(): Promise<
  | { ok: true; sr: ReturnType<typeof createServiceRoleClient> }
  | { ok: false; error: string }
> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can manage hotel admins." };
  }
  try {
    return { ok: true, sr: createServiceRoleClient() };
  } catch {
    return {
      ok: false,
      error:
        "This action isn’t available because the server isn’t fully configured. Please contact your platform administrator.",
    };
  }
}

/**
 * Update linked hotel admin profile + Auth metadata/email and optional tenant reassignment.
 */
export async function updateHotelAdminProfileAction(input: {
  userId: string;
  fullName: string;
  email: string;
  tenantId: string;
}): Promise<AdminMutationResult> {
  const gate = await requireSuperadminAdminClient();
  if (!gate.ok) return gate;

  const userId = input.userId.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const tenantId = input.tenantId.trim();

  if (!userId || !fullName || !email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid name, email, and hotel." };
  }
  if (!tenantId) {
    return { ok: false, error: "Select a hotel." };
  }

  const { data: prof, error: pErr } = await gate.sr
    .from("profiles")
    .select("id, global_role, tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (pErr || !prof) {
    return { ok: false, error: "Admin profile not found." };
  }
  if (prof.global_role === "superadmin") {
    return { ok: false, error: "Cannot reassign a platform superadmin from here." };
  }

  const { data: tenant, error: tErr } = await gate.sr.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (tErr || !tenant) {
    return { ok: false, error: "Hotel not found." };
  }

  const { error: upProf } = await gate.sr
    .from("profiles")
    .update({ full_name: fullName, tenant_id: tenantId })
    .eq("id", userId);
  if (upProf) {
    return { ok: false, error: toUserFacingError(upProf.message) };
  }

  const { error: authErr } = await gate.sr.auth.admin.updateUserById(userId, {
    email,
    user_metadata: { full_name: fullName },
  });
  if (authErr) {
    const msg = authErr.message ?? "";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      return { ok: false, error: "That email is already used by another account." };
    }
    return { ok: false, error: toUserFacingError(authErr.message) };
  }

  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/tenants");
  return { ok: true };
}

/** Edit tenant-stored invite before the admin signs up. */
export async function updateProvisionedAdminAction(input: {
  tenantId: string;
  fullName: string;
  email: string;
}): Promise<AdminMutationResult> {
  const gate = await requireSuperadminAdminClient();
  if (!gate.ok) return gate;

  const tenantId = input.tenantId.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();

  if (!tenantId) {
    return { ok: false, error: "Missing hotel." };
  }
  if (!fullName) {
    return { ok: false, error: "Enter the admin’s full name." };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid invite email." };
  }

  const { data: t, error: tErr } = await gate.sr
    .from("tenants")
    .select("id, initial_admin_email")
    .eq("id", tenantId)
    .maybeSingle();

  if (tErr || !t?.initial_admin_email) {
    return { ok: false, error: "No pending invite found for this hotel." };
  }

  const { error: uErr } = await gate.sr
    .from("tenants")
    .update({ initial_admin_name: fullName, initial_admin_email: email })
    .eq("id", tenantId);
  if (uErr) {
    return { ok: false, error: toUserFacingError(uErr.message) };
  }

  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/tenants");
  return { ok: true };
}

/** Ban or lift ban on login (Auth); does not remove the profile row. */
export async function setHotelAdminBannedAction(input: {
  userId: string;
  banned: boolean;
}): Promise<AdminMutationResult> {
  const gate = await requireSuperadminAdminClient();
  if (!gate.ok) return gate;

  const ctx = await getUserContext();
  if (ctx?.userId === input.userId) {
    return { ok: false, error: "You cannot change the ban status of your own account." };
  }

  const { data: prof, error: pErr } = await gate.sr
    .from("profiles")
    .select("id, global_role")
    .eq("id", input.userId)
    .maybeSingle();

  if (pErr || !prof) {
    return { ok: false, error: "User not found." };
  }
  if (prof.global_role === "superadmin") {
    return { ok: false, error: "Cannot change ban status for a platform superadmin." };
  }

  const { error: bErr } = await gate.sr.auth.admin.updateUserById(input.userId, {
    ban_duration: input.banned ? "876000h" : "none",
  });
  if (bErr) {
    return { ok: false, error: toUserFacingError(bErr.message) };
  }

  revalidatePath("/superadmin/admins");
  return { ok: true };
}

/** Remove pending invite fields from the tenant (no Auth user yet). */
export async function clearProvisionedHotelAdminAction(input: { tenantId: string }): Promise<AdminMutationResult> {
  const gate = await requireSuperadminAdminClient();
  if (!gate.ok) return gate;

  const tenantId = input.tenantId.trim();
  if (!tenantId) {
    return { ok: false, error: "Missing hotel." };
  }

  const { error } = await gate.sr
    .from("tenants")
    .update({ initial_admin_email: null, initial_admin_name: null })
    .eq("id", tenantId);

  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }

  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/tenants");
  return { ok: true };
}

/** Deletes Auth user (cascades profile). Enforces at least one hotel_admin per tenant when applicable. */
export async function deleteHotelAdminProfileAction(input: { userId: string }): Promise<AdminMutationResult> {
  const gate = await requireSuperadminAdminClient();
  if (!gate.ok) return gate;

  const ctx = await getUserContext();
  if (ctx?.userId === input.userId) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const { data: prof, error: pErr } = await gate.sr
    .from("profiles")
    .select("id, global_role, tenant_id")
    .eq("id", input.userId)
    .maybeSingle();

  if (pErr || !prof?.tenant_id) {
    return { ok: false, error: "Hotel admin not found." };
  }
  if (prof.global_role === "superadmin") {
    return { ok: false, error: "Cannot delete a platform superadmin." };
  }

  if (prof.global_role === "hotel_admin") {
    const { data: others, error: aErr } = await gate.sr
      .from("profiles")
      .select("id")
      .eq("tenant_id", prof.tenant_id)
      .eq("global_role", "hotel_admin");

    if (aErr) {
      return { ok: false, error: toUserFacingError(aErr.message) };
    }
    if ((others ?? []).length <= 1) {
      return {
        ok: false,
        error: "Each hotel needs at least one hotel administrator. Assign another admin before deleting this one.",
      };
    }
  }

  const { error: delAuth } = await gate.sr.auth.admin.deleteUser(input.userId);
  if (delAuth) {
    return { ok: false, error: toUserFacingError(delAuth.message) };
  }

  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/tenants");
  return { ok: true };
}
