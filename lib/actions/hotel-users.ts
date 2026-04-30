"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { deleteEmployeeRecordAction, updateEmployeeRecordAction } from "@/lib/actions/hrms-modules";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";
import { toUserFacingError } from "@/lib/errors/user-facing";

const RELEVANT = ["/hotel/users", "/hrms/employees", "/hotel/dashboard", "/hrms/dashboard"] as const;

function revalidate() {
  for (const p of RELEVANT) revalidatePath(p);
}

type Ok = { ok: true } | { ok: false; error: string };

async function requireHotelAdminService() {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false as const, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "hotel_admin" || !ctx.tenantId) {
    return { ok: false as const, error: "Only a property hotel administrator can do this." };
  }
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false as const, error: "This action isn’t available because the server isn’t fully configured. Contact your platform administrator." };
  }
  return { ok: true as const, ctx, admin, tenantId: ctx.tenantId };
}

export async function updateDepartmentAction(input: {
  departmentId: string;
  name: string;
}): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Enter a department name." };
  }
  const { error } = await g.admin
    .from("departments")
    .update({ name })
    .eq("id", input.departmentId)
    .eq("tenant_id", g.tenantId);
  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }
  revalidate();
  return { ok: true };
}

export async function setDepartmentActiveAction(input: {
  departmentId: string;
  isActive: boolean;
}): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;
  const { error } = await g.admin
    .from("departments")
    .update({ is_active: input.isActive })
    .eq("id", input.departmentId)
    .eq("tenant_id", g.tenantId);
  if (error) {
    if (/is_active|does not exist/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Department active/inactive isn’t available yet on your system. Please contact your administrator.",
      };
    }
    return { ok: false, error: toUserFacingError(error.message) };
  }
  revalidate();
  return { ok: true };
}

export async function deleteDepartmentAction(input: { departmentId: string }): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;

  const { count: empN, error: e1 } = await g.admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", g.tenantId)
    .eq("department_id", input.departmentId);
  if (e1) {
    return { ok: false, error: toUserFacingError(e1.message) };
  }
  if ((empN ?? 0) > 0) {
    return {
      ok: false,
      error: "Reassign or remove all employees from this department before deleting it.",
    };
  }

  const { count: reqN, error: e2 } = await g.admin
    .from("job_requisitions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", g.tenantId)
    .eq("department_id", input.departmentId);
  if (e2) {
    return { ok: false, error: toUserFacingError(e2.message) };
  }
  if ((reqN ?? 0) > 0) {
    return {
      ok: false,
      error: "Delete or reassign job postings that reference this department first.",
    };
  }

  const { error } = await g.admin
    .from("departments")
    .delete()
    .eq("id", input.departmentId)
    .eq("tenant_id", g.tenantId);
  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }
  revalidate();
  return { ok: true };
}

const ACCESS: ServiceAccessLevel[] = ["none", "view", "manage"];

function parseAccess(s: string): ServiceAccessLevel | null {
  return (ACCESS as readonly string[]).includes(s) ? (s as ServiceAccessLevel) : null;
}

/** Payload shape for staff profile updates (hotel admin UI and approved change requests). */
export type HotelStaffUserUpdatePayload = {
  userId: string;
  fullName: string;
  hrmsAccess: string;
  hrrmAccess: string;
  employee?: {
    id: string;
    jobTitle: string | null;
    employeeCode: string | null;
    hireDate: string | null;
    departmentId: string | null;
    status: string;
    monthlySalaryCents?: number | null;
  };
};

/**
 * Applies profile name, Auth metadata, user_roles, and optional employee row using the service-role client.
 * Does not enforce caller role — callers must authorize.
 */
export async function applyHotelStaffUserUpdateWithAdminClient(
  admin: ReturnType<typeof createServiceRoleClient>,
  tenantId: string,
  input: HotelStaffUserUpdatePayload,
): Promise<Ok> {
  const fullName = input.fullName.trim();
  if (!fullName) {
    return { ok: false, error: "Name is required." };
  }
  const hr = parseAccess(input.hrmsAccess);
  const rr = parseAccess(input.hrrmAccess);
  if (!hr || !rr) {
    return { ok: false, error: "Invalid HRMS or HRRM access level." };
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", input.userId)
    .eq("tenant_id", tenantId);
  if (pErr) {
    return { ok: false, error: toUserFacingError(pErr.message) };
  }

  const { error: mErr } = await admin.auth.admin.updateUserById(input.userId, {
    user_metadata: { full_name: fullName },
  });
  if (mErr) {
    return { ok: false, error: toUserFacingError(mErr.message) };
  }

  const { error: rErr } = await admin.from("user_roles").upsert(
    [
      {
        user_id: input.userId,
        tenant_id: tenantId,
        service: "hrms" as const,
        access_level: hr,
      },
      {
        user_id: input.userId,
        tenant_id: tenantId,
        service: "hrrm" as const,
        access_level: rr,
      },
    ],
    { onConflict: "user_id,tenant_id,service" },
  );
  if (rErr) {
    return { ok: false, error: toUserFacingError(rErr.message) };
  }

  if (input.employee) {
    const e = input.employee;
    const { data: cur } = await admin
      .from("employees")
      .select("email, monthly_salary_cents")
      .eq("id", e.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (e.departmentId) {
      const { data: d } = await admin
        .from("departments")
        .select("id")
        .eq("id", e.departmentId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!d) {
        return { ok: false, error: "That department is not part of this property." };
      }
    }

    const salaryCents =
      e.monthlySalaryCents !== undefined
        ? e.monthlySalaryCents
        : (cur?.monthly_salary_cents ?? null);

    const u = await updateEmployeeRecordAction({
      tenantId,
      employeeId: e.id,
      fullName,
      email: cur?.email != null ? String(cur.email) : null,
      jobTitle: e.jobTitle,
      employeeCode: e.employeeCode,
      hireDate: e.hireDate,
      departmentId: e.departmentId,
      status: e.status,
      monthlySalaryCents: salaryCents,
    });
    if (!u.ok) {
      return { ok: false, error: u.error };
    }
  }

  return { ok: true };
}

export async function updateHotelStaffUserAction(input: HotelStaffUserUpdatePayload): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;

  const { data: targetProf } = await g.admin
    .from("profiles")
    .select("global_role")
    .eq("id", input.userId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (!targetProf) {
    return { ok: false, error: "User not found for this property." };
  }
  if (targetProf.global_role === "hotel_admin") {
    return {
      ok: false,
      error:
        "Hotel administrator profiles are not edited here. Other admins are read-only; use “Request changes” on your own row to propose updates.",
    };
  }

  const applied = await applyHotelStaffUserUpdateWithAdminClient(g.admin, g.tenantId, input);
  if (!applied.ok) return applied;
  revalidate();
  return { ok: true };
}

export async function submitHotelAdminSelfChangeRequestAction(
  input: HotelStaffUserUpdatePayload,
): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;
  if (input.userId !== g.ctx.userId) {
    return { ok: false, error: "You can only request changes for your own account." };
  }

  const { data: selfProf } = await g.admin
    .from("profiles")
    .select("global_role")
    .eq("id", g.ctx.userId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (!selfProf || selfProf.global_role !== "hotel_admin") {
    return { ok: false, error: "Only hotel administrators submit changes through this flow." };
  }

  const fullName = input.fullName.trim();
  if (!fullName) {
    return { ok: false, error: "Name is required." };
  }
  const hr = parseAccess(input.hrmsAccess);
  const rr = parseAccess(input.hrrmAccess);
  if (!hr || !rr) {
    return { ok: false, error: "Invalid HRMS or HRRM access level." };
  }

  if (input.employee) {
    const { data: emp } = await g.admin
      .from("employees")
      .select("id, user_id")
      .eq("id", input.employee.id)
      .eq("tenant_id", g.tenantId)
      .maybeSingle();
    if (!emp || emp.user_id !== g.ctx.userId) {
      return { ok: false, error: "That employee record is not linked to your login." };
    }
  }

  await g.admin
    .from("hotel_admin_profile_change_requests")
    .delete()
    .eq("requester_user_id", g.ctx.userId)
    .eq("status", "pending");

  const { error: insErr } = await g.admin.from("hotel_admin_profile_change_requests").insert({
    tenant_id: g.tenantId,
    requester_user_id: g.ctx.userId,
    status: "pending",
    payload: input as unknown as Record<string, unknown>,
  });
  if (insErr) {
    return { ok: false, error: toUserFacingError(insErr.message) };
  }

  revalidatePath("/hotel/users");
  revalidatePath("/superadmin/hotel-admin-requests");
  revalidate();
  return { ok: true };
}

export async function deactivateHotelStaffUserAction(input: { userId: string }): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;
  if (input.userId === g.ctx.userId) {
    return { ok: false, error: "You cannot deactivate your own account from here." };
  }

  const { data: prof } = await g.admin
    .from("profiles")
    .select("id, global_role")
    .eq("id", input.userId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (!prof) {
    return { ok: false, error: "User not found for this property." };
  }
  if (prof.global_role === "hotel_admin") {
    return {
      ok: false,
      error: "Another hotel administrator cannot be deactivated from this screen.",
    };
  }

  const { data: emp } = await g.admin
    .from("employees")
    .select("id")
    .eq("tenant_id", g.tenantId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (emp) {
    const { error: iErr } = await g.admin
      .from("employees")
      .update({ status: "inactive" })
      .eq("id", emp.id)
      .eq("tenant_id", g.tenantId);
    if (iErr) {
      return { ok: false, error: toUserFacingError(iErr.message) };
    }
  }

  const { error: bErr } = await g.admin.auth.admin.updateUserById(input.userId, {
    ban_duration: "876000h",
  });
  if (bErr) {
    return { ok: false, error: toUserFacingError(bErr.message) };
  }

  revalidate();
  return { ok: true };
}

export async function activateHotelStaffUserAction(input: { userId: string }): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;
  if (input.userId === g.ctx.userId) {
    return { ok: false, error: "You cannot reactivate your own account from here." };
  }

  const { data: prof } = await g.admin
    .from("profiles")
    .select("id, global_role")
    .eq("id", input.userId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (!prof) {
    return { ok: false, error: "User not found for this property." };
  }
  if (prof.global_role === "hotel_admin") {
    return {
      ok: false,
      error: "Another hotel administrator cannot be reactivated from this screen.",
    };
  }

  const { data: emp } = await g.admin
    .from("employees")
    .select("id")
    .eq("tenant_id", g.tenantId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (emp) {
    const { error: iErr } = await g.admin
      .from("employees")
      .update({ status: "active" })
      .eq("id", emp.id)
      .eq("tenant_id", g.tenantId);
    if (iErr) {
      return { ok: false, error: toUserFacingError(iErr.message) };
    }
  }

  const { error: bErr } = await g.admin.auth.admin.updateUserById(input.userId, {
    ban_duration: "none",
  });
  if (bErr) {
    return { ok: false, error: toUserFacingError(bErr.message) };
  }

  revalidate();
  return { ok: true };
}

export async function deleteHotelStaffUserAction(input: { userId: string }): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;
  if (input.userId === g.ctx.userId) {
    return { ok: false, error: "You cannot delete your own account from here." };
  }

  const { data: prof } = await g.admin
    .from("profiles")
    .select("id, global_role")
    .eq("id", input.userId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (!prof) {
    return { ok: false, error: "User not found for this property." };
  }
  if (prof.global_role === "superadmin") {
    return { ok: false, error: "Cannot remove a platform superadmin from this list." };
  }

  if (prof.global_role === "hotel_admin") {
    return {
      ok: false,
      error: "Removing a hotel administrator must be done by platform staff.",
    };
  }

  const { data: emp } = await g.admin
    .from("employees")
    .select("id, photo_url")
    .eq("tenant_id", g.tenantId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (emp) {
    const del = await deleteEmployeeRecordAction({ tenantId: g.tenantId, employeeId: emp.id });
    if (!del.ok) {
      return { ok: false, error: del.error };
    }
    if (emp.photo_url && !String(emp.photo_url).startsWith("http")) {
      await g.admin.storage.from("employee-photos").remove([String(emp.photo_url)]).catch(() => undefined);
    }
  }

  const { error: delAuth } = await g.admin.auth.admin.deleteUser(input.userId);
  if (delAuth) {
    return { ok: false, error: toUserFacingError(delAuth.message) };
  }
  revalidate();
  return { ok: true };
}
