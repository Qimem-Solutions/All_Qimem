"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { deleteEmployeeRecordAction, updateEmployeeRecordAction } from "@/lib/actions/hrms-modules";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";

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
    return { ok: false as const, error: "Add SUPABASE_SERVICE_ROLE_KEY in web/.env.local." };
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
    return { ok: false, error: error.message };
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
          "Database is missing column departments.is_active. In Supabase → SQL Editor, run: " +
          "alter table public.departments add column if not exists is_active boolean not null default true;",
      };
    }
    return { ok: false, error: error.message };
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
    return { ok: false, error: e1.message };
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
    return { ok: false, error: e2.message };
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
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

const ACCESS: ServiceAccessLevel[] = ["none", "view", "manage"];

function parseAccess(s: string): ServiceAccessLevel | null {
  return (ACCESS as readonly string[]).includes(s) ? (s as ServiceAccessLevel) : null;
}

export async function updateHotelStaffUserAction(input: {
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
    /** Omit to keep the current salary in the database. */
    monthlySalaryCents?: number | null;
  };
}): Promise<Ok> {
  const g = await requireHotelAdminService();
  if (!g.ok) return g;

  const fullName = input.fullName.trim();
  if (!fullName) {
    return { ok: false, error: "Name is required." };
  }
  const hr = parseAccess(input.hrmsAccess);
  const rr = parseAccess(input.hrrmAccess);
  if (!hr || !rr) {
    return { ok: false, error: "Invalid HRMS or HRRM access level." };
  }

  const { error: pErr } = await g.admin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", input.userId)
    .eq("tenant_id", g.tenantId);
  if (pErr) {
    return { ok: false, error: pErr.message };
  }

  const { error: mErr } = await g.admin.auth.admin.updateUserById(input.userId, {
    user_metadata: { full_name: fullName },
  });
  if (mErr) {
    return { ok: false, error: mErr.message };
  }

  const { error: rErr } = await g.admin.from("user_roles").upsert(
    [
      {
        user_id: input.userId,
        tenant_id: g.tenantId,
        service: "hrms" as const,
        access_level: hr,
      },
      {
        user_id: input.userId,
        tenant_id: g.tenantId,
        service: "hrrm" as const,
        access_level: rr,
      },
    ],
    { onConflict: "user_id,tenant_id,service" },
  );
  if (rErr) {
    return { ok: false, error: rErr.message };
  }

  if (input.employee) {
    const e = input.employee;
    const { data: cur } = await g.admin
      .from("employees")
      .select("email, monthly_salary_cents")
      .eq("id", e.id)
      .eq("tenant_id", g.tenantId)
      .maybeSingle();

    if (e.departmentId) {
      const { data: d } = await g.admin
        .from("departments")
        .select("id")
        .eq("id", e.departmentId)
        .eq("tenant_id", g.tenantId)
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
      tenantId: g.tenantId,
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
    .select("id")
    .eq("id", input.userId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (!prof) {
    return { ok: false, error: "User not found for this property." };
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
      return { ok: false, error: iErr.message };
    }
  }

  const { error: bErr } = await g.admin.auth.admin.updateUserById(input.userId, {
    ban_duration: "876000h",
  });
  if (bErr) {
    return { ok: false, error: bErr.message };
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
    .select("id")
    .eq("id", input.userId)
    .eq("tenant_id", g.tenantId)
    .maybeSingle();
  if (!prof) {
    return { ok: false, error: "User not found for this property." };
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
      return { ok: false, error: iErr.message };
    }
  }

  const { error: bErr } = await g.admin.auth.admin.updateUserById(input.userId, {
    ban_duration: "none",
  });
  if (bErr) {
    return { ok: false, error: bErr.message };
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
    const { data: others, error: aErr } = await g.admin
      .from("profiles")
      .select("id")
      .eq("tenant_id", g.tenantId)
      .eq("global_role", "hotel_admin");
    if (aErr) {
      return { ok: false, error: aErr.message };
    }
    if ((others ?? []).length <= 1) {
      return { ok: false, error: "Keep at least one hotel administrator for this property." };
    }
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
    return { ok: false, error: delAuth.message };
  }
  revalidate();
  return { ok: true };
}
