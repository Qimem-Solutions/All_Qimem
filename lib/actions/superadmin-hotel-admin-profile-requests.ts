"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  applyHotelStaffUserUpdateWithAdminClient,
  type HotelStaffUserUpdatePayload,
} from "@/lib/actions/hotel-users";
import { toUserFacingError } from "@/lib/errors/user-facing";

type Result = { ok: true; message: string } | { ok: false; error: string };

function revalidateAfterProfileRequest() {
  revalidatePath("/superadmin/hotel-admin-requests");
  revalidatePath("/hotel/users");
  revalidatePath("/hrms/employees");
  revalidatePath("/hotel/dashboard");
  revalidatePath("/hrms/dashboard");
}

function coercePayload(raw: unknown): HotelStaffUserUpdatePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.userId !== "string" || typeof o.fullName !== "string") return null;
  if (typeof o.hrmsAccess !== "string" || typeof o.hrrmAccess !== "string") return null;

  let employee: HotelStaffUserUpdatePayload["employee"];
  if (o.employee != null && typeof o.employee === "object") {
    const e = o.employee as Record<string, unknown>;
    if (typeof e.id !== "string") return null;
    employee = {
      id: e.id,
      jobTitle: e.jobTitle === null || typeof e.jobTitle === "string" ? e.jobTitle : null,
      employeeCode:
        e.employeeCode === null || typeof e.employeeCode === "string" ? e.employeeCode : null,
      hireDate: e.hireDate === null || typeof e.hireDate === "string" ? e.hireDate : null,
      departmentId:
        e.departmentId === null || typeof e.departmentId === "string" ? e.departmentId : null,
      status: typeof e.status === "string" ? e.status : "active",
      monthlySalaryCents:
        e.monthlySalaryCents === undefined
          ? undefined
          : e.monthlySalaryCents === null
            ? null
            : typeof e.monthlySalaryCents === "number"
              ? e.monthlySalaryCents
              : undefined,
    };
  }

  return {
    userId: o.userId,
    fullName: o.fullName,
    hrmsAccess: o.hrmsAccess,
    hrrmAccess: o.hrrmAccess,
    employee,
  };
}

async function requireSuperadminService(): Promise<
  | { ok: true; sr: ReturnType<typeof createServiceRoleClient>; userId: string }
  | { ok: false; error: string }
> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Not authorized." };
  }
  try {
    return { ok: true, sr: createServiceRoleClient(), userId: ctx.userId };
  } catch {
    return {
      ok: false,
      error:
        "This action isn’t available because the server isn’t fully configured. Please contact your platform administrator.",
    };
  }
}

export async function approveHotelAdminProfileChangeRequestAction(requestId: string): Promise<Result> {
  const gate = await requireSuperadminService();
  if (!gate.ok) return gate;

  if (!requestId?.trim()) {
    return { ok: false, error: "Missing request." };
  }

  const { data: row, error: fetchErr } = await gate.sr
    .from("hotel_admin_profile_change_requests")
    .select("id, tenant_id, requester_user_id, status, payload")
    .eq("id", requestId.trim())
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: toUserFacingError(fetchErr.message) };
  }
  if (!row || row.status !== "pending") {
    return { ok: false, error: "Request not found or already resolved." };
  }

  const tenantId = row.tenant_id as string;
  const requesterId = row.requester_user_id as string;
  const payload = coercePayload(row.payload);
  if (!payload) {
    return { ok: false, error: "Stored request payload is invalid." };
  }
  if (payload.userId !== requesterId) {
    return { ok: false, error: "Request payload does not match the requester." };
  }

  const { data: prof } = await gate.sr
    .from("profiles")
    .select("global_role")
    .eq("id", requesterId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!prof || prof.global_role !== "hotel_admin") {
    return {
      ok: false,
      error: "That user is no longer a hotel administrator on this property; reject the request instead.",
    };
  }

  const applied = await applyHotelStaffUserUpdateWithAdminClient(gate.sr, tenantId, payload);
  if (!applied.ok) {
    return { ok: false, error: applied.error };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await gate.sr
    .from("hotel_admin_profile_change_requests")
    .update({
      status: "approved",
      resolved_at: now,
      resolved_by: gate.userId,
    })
    .eq("id", requestId.trim())
    .eq("status", "pending");

  if (updErr) {
    return { ok: false, error: toUserFacingError(updErr.message) };
  }

  revalidateAfterProfileRequest();
  return { ok: true, message: "Changes approved and applied to the hotel administrator’s profile." };
}

export async function rejectHotelAdminProfileChangeRequestAction(requestId: string): Promise<Result> {
  const gate = await requireSuperadminService();
  if (!gate.ok) return gate;

  if (!requestId?.trim()) {
    return { ok: false, error: "Missing request." };
  }

  const now = new Date().toISOString();
  const { data, error } = await gate.sr
    .from("hotel_admin_profile_change_requests")
    .update({
      status: "rejected",
      resolved_at: now,
      resolved_by: gate.userId,
      rejection_reason: null,
    })
    .eq("id", requestId.trim())
    .eq("status", "pending")
    .select("id");

  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }
  if (!data?.length) {
    return { ok: false, error: "Request not found or already resolved." };
  }

  revalidateAfterProfileRequest();
  return { ok: true, message: "Request declined. Their profile was not changed." };
}
