"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_STAFF_PASSWORD } from "@/lib/constants/staff";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { isMissingDbColumnError } from "@/lib/supabase/schema-errors";
import { toUserFacingError } from "@/lib/errors/user-facing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HR_RELATED_PATHS = [
  "/hotel/users",
  "/hrms/employees",
  "/hrms/dashboard",
  "/hrms/reports",
  "/hrms/time",
  "/hrms/leave",
  "/hrms/recruitment",
  "/hrms/payroll",
] as const;

function revalidateHrSurface() {
  for (const p of HR_RELATED_PATHS) {
    revalidatePath(p);
  }
}

export type CreateStaffResult = { ok: true } | { ok: false; error: string };

export async function createStaffUserAction(formData: FormData): Promise<CreateStaffResult> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!(await canManageHrStaff(ctx))) {
    return {
      ok: false,
      error:
        "You need HRMS manage access (property administrator or delegated HR manager) to create staff.",
    };
  }
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return { ok: false, error: "Your profile is not linked to a property." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = (String(formData.get("password") ?? "").trim() || DEFAULT_STAFF_PASSWORD).trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const rawDept = String(formData.get("departmentId") ?? "").trim();
  const departmentId = rawDept && rawDept.length > 0 ? rawDept : null;
  const hireDateRaw = String(formData.get("hireDate") ?? "").trim();
  const hireDate = hireDateRaw.length > 0 ? hireDateRaw : null;

  const salaryRaw = String(formData.get("monthlySalary") ?? "").trim();
  let monthlySalaryCents: number | null = null;
  if (salaryRaw.length > 0) {
    const n = Number.parseFloat(salaryRaw);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Enter a valid monthly salary (0 or greater), or leave it blank." };
    }
    monthlySalaryCents = Math.round(n * 100);
  }

  const hrmsAccess = String(formData.get("hrmsAccess") ?? "view") as ServiceAccessLevel;
  const hrrmAccess = String(formData.get("hrrmAccess") ?? "view") as ServiceAccessLevel;
  if (!["none", "view", "manage"].includes(hrmsAccess) || !["none", "view", "manage"].includes(hrrmAccess)) {
    return { ok: false, error: "Invalid access level." };
  }

  const photo = formData.get("photo");

  if (!fullName) {
    return { ok: false, error: "Enter the staff member’s name." };
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
    return { ok: false, error: "Property not found." };
  }

  if (departmentId) {
    const { data: dept } = await admin
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!dept) {
      return { ok: false, error: "Invalid department for this property." };
    }
  }

  const { data: dupEmp } = await admin
    .from("employees")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .maybeSingle();
  if (dupEmp) {
    return {
      ok: false,
      error: "An employee with this email already exists for this property.",
    };
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
      return {
        ok: false,
        error: "That email is already registered. Try another email address.",
      };
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
    global_role: "user" as const,
    tenant_id: tenantId,
    must_change_password: password === DEFAULT_STAFF_PASSWORD,
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
        fallback: "We couldn’t save this person’s profile. Please try again.",
      }),
    };
  }

  const employeePayload: Record<string, unknown> = {
    tenant_id: tenantId,
    full_name: fullName,
    email,
    job_title: jobTitle,
    status: "active",
    user_id: userId,
    monthly_salary_cents: monthlySalaryCents,
    hire_date: hireDate,
  };
  if (departmentId) {
    employeePayload.department_id = departmentId;
  }

  const { data: empRow, error: empErr } = await admin
    .from("employees")
    .insert(employeePayload)
    .select("id")
    .single();

  if (empErr || !empRow) {
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: toUserFacingError(empErr?.message, {
        fallback: "We couldn’t save the employee record. Please try again or contact support.",
      }),
    };
  }

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) {
      await admin.from("employees").delete().eq("id", empRow.id);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "Photo must be 5 MB or smaller." };
    }
    const okTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!okTypes.includes(photo.type)) {
      await admin.from("employees").delete().eq("id", empRow.id);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "Photo must be JPEG, PNG, or WebP." };
    }
    const safe = (photo.name || "photo").replace(/[^\w.\-()+ ]/g, "_").slice(0, 120) || "photo.jpg";
    const storagePath = `${tenantId}/${empRow.id}/${Date.now()}-${safe}`;
    const buf = Buffer.from(await photo.arrayBuffer());
    const { error: upErr } = await admin.storage.from("employee-photos").upload(storagePath, buf, {
      contentType: photo.type,
      upsert: false,
    });
    if (upErr) {
      await admin.from("employees").delete().eq("id", empRow.id);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: toUserFacingError(upErr.message) };
    }
    const { error: phErr } = await admin
      .from("employees")
      .update({ photo_url: storagePath })
      .eq("id", empRow.id)
      .eq("tenant_id", tenantId);
    if (phErr) {
      await admin.storage.from("employee-photos").remove([storagePath]);
      await admin.from("employees").delete().eq("id", empRow.id);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: toUserFacingError(phErr.message) };
    }
  }

  const roles = [
    {
      user_id: userId,
      tenant_id: tenantId,
      service: "hrms" as const,
      access_level: hrmsAccess,
    },
    {
      user_id: userId,
      tenant_id: tenantId,
      service: "hrrm" as const,
      access_level: hrrmAccess,
    },
  ];

  const { error: roleErr } = await admin.from("user_roles").insert(roles);

  if (roleErr) {
    await admin.from("employees").delete().eq("id", empRow.id);
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: toUserFacingError(roleErr.message, {
        fallback: "We couldn’t assign module access for this person. Please contact support.",
      }),
    };
  }

  revalidateHrSurface();
  return { ok: true };
}

export type CreateDepartmentResult = { ok: true } | { ok: false; error: string };

export async function createDepartmentAction(input: { name: string }): Promise<CreateDepartmentResult> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!(await canManageHrStaff(ctx))) {
    return {
      ok: false,
      error:
        "You need HRMS manage access (property administrator or delegated HR manager) to add departments.",
    };
  }
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return { ok: false, error: "Your profile is not linked to a property." };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Enter a department name." };
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
    return { ok: false, error: "Property not found." };
  }

  const { error } = await admin.from("departments").insert({
    tenant_id: tenantId,
    name,
  });

  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }

  revalidateHrSurface();
  return { ok: true };
}
