"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const HR_PATHS = [
  "/hrms/time",
  "/hrms/leave",
  "/hrms/recruitment",
  "/hrms/payroll",
  "/hrms/dashboard",
  "/hrms/reports",
  "/hrms/employees",
  "/hotel/users",
] as const;

function revalidateHr() {
  for (const p of HR_PATHS) revalidatePath(p);
}

type Ok<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function getAdmin(tenantId: string) {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) {
    return { ok: false as const, error: "Not signed in or wrong property." };
  }
  if (!(await canManageHrStaff(ctx))) {
    return { ok: false as const, error: "HRMS manage access required." };
  }
  try {
    return { ok: true as const, admin: createServiceRoleClient() };
  } catch {
    return { ok: true as const, admin: null };
  }
}

async function dbOrAdmin(tenantId: string) {
  const gate = await getAdmin(tenantId);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (gate.admin) return { ok: true as const, db: gate.admin };
  const supabase = await createClient();
  return { ok: true as const, db: supabase };
}

export async function createShiftAction(input: {
  tenantId: string;
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftType?: string | null;
}): Promise<Ok<{ id: string }>> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { data, error } = await gate.db
    .from("shifts")
    .insert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      shift_date: input.shiftDate,
      start_time: input.startTime,
      end_time: input.endTime,
      shift_type: input.shiftType?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true, data: { id: data!.id } };
}

export async function deleteShiftAction(input: { tenantId: string; shiftId: string }): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db.from("shifts").delete().eq("id", input.shiftId).eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function recordPunchAction(input: {
  tenantId: string;
  employeeId: string;
  punchType: string;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const t = input.punchType.trim().toLowerCase();
  if (!["in", "out", "break_start", "break_end"].includes(t)) {
    return { ok: false, error: "Invalid punch type." };
  }
  const { error } = await gate.db.from("attendance_logs").insert({
    tenant_id: input.tenantId,
    employee_id: input.employeeId,
    punch_type: t,
    source: "hrms",
  });
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function createLeaveRequestAction(input: {
  tenantId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db.from("leave_requests").insert({
    tenant_id: input.tenantId,
    employee_id: input.employeeId,
    leave_type: input.leaveType,
    start_date: input.startDate,
    end_date: input.endDate,
    status: "pending",
    reason: input.reason?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function updateLeaveStatusAction(input: {
  tenantId: string;
  leaveId: string;
  status: "approved" | "rejected" | "cancelled";
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db
    .from("leave_requests")
    .update({ status: input.status })
    .eq("id", input.leaveId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function createJobRequisitionAction(input: {
  tenantId: string;
  title: string;
  departmentId?: string | null;
  description?: string | null;
}): Promise<Ok<{ id: string }>> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { data, error } = await gate.db
    .from("job_requisitions")
    .insert({
      tenant_id: input.tenantId,
      title: input.title.trim(),
      department_id: input.departmentId?.trim() || null,
      description: input.description?.trim() || null,
      status: "open",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true, data: { id: data!.id } };
}

export async function updateJobRequisitionStatusAction(input: {
  tenantId: string;
  id: string;
  status: "open" | "paused" | "closed";
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db
    .from("job_requisitions")
    .update({ status: input.status })
    .eq("id", input.id)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function createJobCandidateAction(input: {
  tenantId: string;
  requisitionId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<Ok<{ id: string }>> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { data, error } = await gate.db
    .from("job_candidates")
    .insert({
      tenant_id: input.tenantId,
      requisition_id: input.requisitionId,
      full_name: input.fullName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      stage: "applied",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true, data: { id: data!.id } };
}

export async function updateJobCandidateStageAction(input: {
  tenantId: string;
  candidateId: string;
  stage: string;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db
    .from("job_candidates")
    .update({ stage: input.stage })
    .eq("id", input.candidateId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function createPayrollRunAction(input: {
  tenantId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  notes?: string | null;
}): Promise<Ok<{ id: string }>> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { data, error } = await gate.db
    .from("payroll_runs")
    .insert({
      tenant_id: input.tenantId,
      period_label: input.periodLabel.trim(),
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: "draft",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true, data: { id: data!.id } };
}

export async function upsertPayrollLineAction(input: {
  tenantId: string;
  payrollRunId: string;
  employeeId: string;
  grossCents: number;
  deductionsCents: number;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const net = input.grossCents - input.deductionsCents;
  const { error } = await gate.db.from("payroll_lines").upsert(
    {
      tenant_id: input.tenantId,
      payroll_run_id: input.payrollRunId,
      employee_id: input.employeeId,
      gross_cents: input.grossCents,
      deductions_cents: input.deductionsCents,
      net_cents: net,
    },
    { onConflict: "payroll_run_id,employee_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function updatePayrollRunStatusAction(input: {
  tenantId: string;
  runId: string;
  status: "draft" | "processed" | "paid";
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db
    .from("payroll_runs")
    .update({ status: input.status })
    .eq("id", input.runId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function updateEmployeeRecordAction(input: {
  tenantId: string;
  employeeId: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  employeeCode: string | null;
  hireDate: string | null;
  departmentId: string | null;
  status: string;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const rawDept = input.departmentId?.trim();
  const { error } = await gate.db
    .from("employees")
    .update({
      full_name: input.fullName.trim(),
      email: input.email?.trim() || null,
      job_title: input.jobTitle?.trim() || null,
      employee_code: input.employeeCode?.trim() || null,
      hire_date: input.hireDate?.trim() || null,
      department_id: rawDept && rawDept.length > 0 ? rawDept : null,
      status: input.status.trim() || "active",
    })
    .eq("id", input.employeeId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function setEmployeeInactiveAction(input: {
  tenantId: string;
  employeeId: string;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db
    .from("employees")
    .update({ status: "inactive" })
    .eq("id", input.employeeId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function deleteEmployeeRecordAction(input: {
  tenantId: string;
  employeeId: string;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.db
    .from("employees")
    .delete()
    .eq("id", input.employeeId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}
