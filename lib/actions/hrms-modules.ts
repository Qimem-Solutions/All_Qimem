"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchPayrollLinesForRun,
  fetchPayrollRuns,
  type PayrollLineRow,
  type PayrollRunRow,
} from "@/lib/queries/hrms-extended";

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

/** Any signed-in user linked to the tenant (e.g. public job applications). */
async function dbForTenantMember(tenantId: string) {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) {
    return { ok: false as const, error: "Not signed in or wrong property." };
  }
  try {
    return { ok: true as const, db: createServiceRoleClient() };
  } catch {
    return { ok: true as const, db: await createClient() };
  }
}

type SupabaseDb = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;

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
      stage: "submitted",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true, data: { id: data!.id } };
}

const APPLICATION_STAGES = ["submitted", "on_interview", "passed", "rejected"] as const;

async function createEmployeeFromCandidate(
  db: SupabaseDb,
  tenantId: string,
  candidateId: string,
): Promise<Ok<{ employeeId: string }>> {
  const { data: row, error: fetchErr } = await db
    .from("job_candidates")
    .select("id, full_name, email, phone, requisition_id, hired_employee_id")
    .eq("id", candidateId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "Application not found." };
  if (row.hired_employee_id) {
    return { ok: true, data: { employeeId: row.hired_employee_id } };
  }

  const { data: req, error: reqErr } = await db
    .from("job_requisitions")
    .select("id, title, department_id")
    .eq("id", row.requisition_id)
    .maybeSingle();
  if (reqErr) return { ok: false, error: reqErr.message };
  if (!req) return { ok: false, error: "Linked job posting is missing." };

  const email = row.email?.trim() || null;
  if (email) {
    const { data: dup } = await db
      .from("employees")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .maybeSingle();
    if (dup) {
      return {
        ok: false,
        error:
          "An employee with this email already exists in the directory. Resolve the duplicate before marking as Passed.",
      };
    }
  }

  const { data: emp, error: empErr } = await db
    .from("employees")
    .insert({
      tenant_id: tenantId,
      department_id: req.department_id,
      full_name: row.full_name.trim(),
      email,
      job_title: req.title?.trim() || null,
      status: "active",
      hire_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (empErr) return { ok: false, error: empErr.message };

  const { error: upErr } = await db
    .from("job_candidates")
    .update({ stage: "passed", hired_employee_id: emp!.id })
    .eq("id", candidateId)
    .eq("tenant_id", tenantId);
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, data: { employeeId: emp!.id } };
}

export async function updateJobCandidateStageAction(input: {
  tenantId: string;
  candidateId: string;
  stage: string;
}): Promise<Ok> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const stage = input.stage.trim();
  if (!APPLICATION_STAGES.includes(stage as (typeof APPLICATION_STAGES)[number])) {
    return { ok: false, error: "Invalid status." };
  }

  if (stage === "passed") {
    const hire = await createEmployeeFromCandidate(gate.db, input.tenantId, input.candidateId);
    if (!hire.ok) return hire;
    revalidateHr();
    return { ok: true };
  }

  const { error } = await gate.db
    .from("job_candidates")
    .update({ stage })
    .eq("id", input.candidateId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function submitRecruitmentApplicationAction(
  _prev: unknown,
  formData: FormData,
): Promise<Ok<{ id: string }>> {
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const requisitionId = String(formData.get("requisitionId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("cv");

  if (!tenantId) return { ok: false, error: "Missing property." };
  if (!requisitionId) return { ok: false, error: "Select an open position." };
  if (!fullName) return { ok: false, error: "Enter your full name." };

  const gate = await dbForTenantMember(tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { data: reqRow, error: reqErr } = await gate.db
    .from("job_requisitions")
    .select("id, status")
    .eq("id", requisitionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reqErr) return { ok: false, error: reqErr.message };
  if (!reqRow) return { ok: false, error: "Invalid job posting." };
  if (reqRow.status !== "open") {
    return { ok: false, error: "That posting is not open for applications." };
  }

  const { data: created, error: insErr } = await gate.db
    .from("job_candidates")
    .insert({
      tenant_id: tenantId,
      requisition_id: requisitionId,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      stage: "submitted",
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  const candidateId = created!.id;

  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      await gate.db.from("job_candidates").delete().eq("id", candidateId).eq("tenant_id", tenantId);
      return { ok: false, error: "CV file must be 10 MB or smaller." };
    }
    const safe = file.name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120) || "cv";
    const path = `${tenantId}/${candidateId}/${Date.now()}-${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await gate.db.storage.from("recruitment-cvs").upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      await gate.db.from("job_candidates").delete().eq("id", candidateId).eq("tenant_id", tenantId);
      return { ok: false, error: upErr.message };
    }
    const { error: pathErr } = await gate.db
      .from("job_candidates")
      .update({ cv_storage_path: path })
      .eq("id", candidateId)
      .eq("tenant_id", tenantId);
    if (pathErr) return { ok: false, error: pathErr.message };
  }

  revalidateHr();
  return { ok: true, data: { id: candidateId } };
}

/** Fresh runs + lines for the payroll page client after mutations (Next cache can leave props stale). */
export async function loadPayrollBundleAction(
  tenantId: string,
): Promise<
  { ok: true; runs: PayrollRunRow[]; linesByRun: Record<string, PayrollLineRow[]> } | { ok: false; error: string }
> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) {
    return { ok: false, error: "Not signed in or wrong property." };
  }
  const runsRes = await fetchPayrollRuns(tenantId);
  if (runsRes.error) return { ok: false, error: runsRes.error };
  const linesByRun: Record<string, PayrollLineRow[]> = {};
  for (const r of runsRes.rows) {
    const { rows, error } = await fetchPayrollLinesForRun(tenantId, r.id);
    if (error) return { ok: false, error };
    linesByRun[r.id] = rows;
  }
  return { ok: true, runs: runsRes.rows, linesByRun };
}

export async function createPayrollRunAction(input: {
  tenantId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  notes?: string | null;
  /** At least one employee must be included; lines are created with gross = monthly salary (or 0). */
  employeeIds: string[];
}): Promise<Ok<{ id: string }>> {
  const gate = await dbOrAdmin(input.tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const ids = [...new Set((input.employeeIds ?? []).map((x) => String(x).trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, error: "Select at least one employee for this payroll run." };
  }

  const periodStart = String(input.periodStart).trim();
  const periodEnd = String(input.periodEnd).trim();
  if (!periodStart || !periodEnd) {
    return { ok: false, error: "Period start and end are required." };
  }

  const { data: overlappingRuns, error: overlapErr } = await gate.db
    .from("payroll_runs")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .lte("period_start", periodEnd)
    .gte("period_end", periodStart);
  if (overlapErr) return { ok: false, error: overlapErr.message };
  const overlapIds = (overlappingRuns ?? []).map((r) => r.id);
  if (overlapIds.length > 0) {
    const { data: dupLines, error: dupErr } = await gate.db
      .from("payroll_lines")
      .select("employee_id")
      .eq("tenant_id", input.tenantId)
      .in("employee_id", ids)
      .in("payroll_run_id", overlapIds);
    if (dupErr) return { ok: false, error: dupErr.message };
    if (dupLines && dupLines.length > 0) {
      const dupEmpIds = [...new Set(dupLines.map((l) => l.employee_id))];
      const { data: nameRows, error: nameErr } = await gate.db
        .from("employees")
        .select("id, full_name")
        .in("id", dupEmpIds);
      if (nameErr) return { ok: false, error: nameErr.message };
      const names = (nameRows ?? [])
        .map((e) => e.full_name?.trim() || e.id)
        .filter(Boolean)
        .join(", ");
      return {
        ok: false,
        error: `These people are already on another payroll for this same period (${periodStart} → ${periodEnd}): ${names}. Pick different employees or edit the existing run — you can still add other staff in a second run for the same dates.`,
      };
    }
  }

  const { data, error } = await gate.db
    .from("payroll_runs")
    .insert({
      tenant_id: input.tenantId,
      period_label: input.periodLabel.trim(),
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const runId = data!.id;

  const { data: emps, error: empErr } = await gate.db
    .from("employees")
    .select("id, monthly_salary_cents")
    .eq("tenant_id", input.tenantId)
    .in("id", ids);
  if (empErr) {
    await gate.db.from("payroll_runs").delete().eq("id", runId);
    return { ok: false, error: empErr.message };
  }
  if (!emps || emps.length !== ids.length) {
    await gate.db.from("payroll_runs").delete().eq("id", runId);
    return { ok: false, error: "One or more selected employees are invalid for this property." };
  }

  const lineRows = emps.map((e) => {
    const gross = Math.max(0, Number(e.monthly_salary_cents ?? 0));
    return {
      tenant_id: input.tenantId,
      payroll_run_id: runId,
      employee_id: e.id,
      gross_cents: gross,
      deductions_cents: 0,
      net_cents: gross,
    };
  });
  const { error: lineErr } = await gate.db.from("payroll_lines").insert(lineRows);
  if (lineErr) {
    await gate.db.from("payroll_runs").delete().eq("id", runId);
    return { ok: false, error: lineErr.message };
  }

  revalidateHr();
  return { ok: true, data: { id: runId } };
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
  const employeeId = String(input.employeeId).trim();
  if (!employeeId) return { ok: false, error: "Employee is required." };

  const { data: run, error: runErr } = await gate.db
    .from("payroll_runs")
    .select("id, period_start, period_end, period_label")
    .eq("id", input.payrollRunId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (runErr) return { ok: false, error: runErr.message };
  if (!run) return { ok: false, error: "Payroll run not found." };

  const pStart = run.period_start;
  const pEnd = run.period_end;
  const { data: otherRuns, error: oErr } = await gate.db
    .from("payroll_runs")
    .select("id, period_label, period_start, period_end")
    .eq("tenant_id", input.tenantId)
    .neq("id", run.id)
    .lte("period_start", pEnd)
    .gte("period_end", pStart);
  if (oErr) return { ok: false, error: oErr.message };
  const otherIds = (otherRuns ?? []).map((r) => r.id);
  if (otherIds.length > 0) {
    const { data: existingLine, error: lineQErr } = await gate.db
      .from("payroll_lines")
      .select("payroll_run_id")
      .eq("tenant_id", input.tenantId)
      .eq("employee_id", employeeId)
      .in("payroll_run_id", otherIds)
      .limit(1);
    if (lineQErr) return { ok: false, error: lineQErr.message };
    if (existingLine && existingLine.length > 0) {
      const rid = existingLine[0]!.payroll_run_id;
      const other = (otherRuns ?? []).find((r) => r.id === rid);
      return {
        ok: false,
        error: `This employee is already on another payroll for an overlapping period ("${other?.period_label?.trim() ?? "existing run"}", ${other?.period_start} → ${other?.period_end}). You cannot add them twice to the same pay period — use or edit the other run, or remove them there first.`,
      };
    }
  }

  const net = input.grossCents - input.deductionsCents;
  const { error } = await gate.db.from("payroll_lines").upsert(
    {
      tenant_id: input.tenantId,
      payroll_run_id: input.payrollRunId,
      employee_id: employeeId,
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
  monthlySalaryCents: number | null;
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
      monthly_salary_cents: input.monthlySalaryCents,
    })
    .eq("id", input.employeeId)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidateHr();
  return { ok: true };
}

export async function uploadEmployeePhotoAction(_prev: unknown, formData: FormData): Promise<Ok> {
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const file = formData.get("photo");

  if (!tenantId || !employeeId) return { ok: false, error: "Missing fields." };

  const gate = await dbOrAdmin(tenantId);
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo file." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Photo must be 5 MB or smaller." };
  }
  const okTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!okTypes.includes(file.type)) {
    return { ok: false, error: "Photo must be JPEG, PNG, or WebP." };
  }

  const { data: row } = await gate.db
    .from("employees")
    .select("id, photo_url")
    .eq("id", employeeId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Employee not found." };

  const oldPath = row.photo_url && !row.photo_url.startsWith("http") ? row.photo_url : null;

  const safe = (file.name || "photo").replace(/[^\w.\-()+ ]/g, "_").slice(0, 120) || "photo.jpg";
  const storagePath = `${tenantId}/${employeeId}/${Date.now()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await gate.db.storage.from("employee-photos").upload(storagePath, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: dbErr } = await gate.db
    .from("employees")
    .update({ photo_url: storagePath })
    .eq("id", employeeId)
    .eq("tenant_id", tenantId);
  if (dbErr) {
    await gate.db.storage.from("employee-photos").remove([storagePath]);
    return { ok: false, error: dbErr.message };
  }

  if (oldPath) {
    await gate.db.storage.from("employee-photos").remove([oldPath]).catch(() => undefined);
  }

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
