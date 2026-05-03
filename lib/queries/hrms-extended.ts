import { getUserContext } from "@/lib/queries/context";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

async function srOrClient(tenantId: string): Promise<
  | { error: string; db: null }
  | { error: null; db: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient> }
> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) return { error: "Not authorized.", db: null };
  try {
    return { error: null, db: createServiceRoleClient() };
  } catch {
    return { error: null, db: await createClient() };
  }
}

export type LeaveRequestRow = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  created_at: string | null;
  employee_name: string | null;
};

export async function fetchLeaveRequests(tenantId: string): Promise<{
  rows: LeaveRequestRow[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data: rows, error: qErr } = await db
    .from("leave_requests")
    .select("id, employee_id, leave_type, start_date, end_date, status, reason, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (qErr) return { rows: [], error: qErr.message };

  const empIds = [...new Set((rows ?? []).map((r) => r.employee_id))];
  let nameMap = new Map<string, string>();
  if (empIds.length) {
    const { data: emps } = await db.from("employees").select("id, full_name").in("id", empIds);
    nameMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
  }

  return {
    rows: (rows ?? []).map((r) => ({
      ...r,
      employee_name: nameMap.get(r.employee_id) ?? null,
    })),
    error: null,
  };
}

export type JobRequisitionRow = {
  id: string;
  department_id: string | null;
  title: string;
  status: string;
  description: string | null;
  created_at: string | null;
  department_name: string | null;
};

export async function fetchJobRequisitions(tenantId: string): Promise<{
  rows: JobRequisitionRow[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data: rows, error: qErr } = await db
    .from("job_requisitions")
    .select("id, department_id, title, status, description, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (qErr) return { rows: [], error: qErr.message };

  const deptIds = [...new Set((rows ?? []).map((r) => r.department_id).filter(Boolean))] as string[];
  let deptMap = new Map<string, string>();
  if (deptIds.length) {
    const { data: depts } = await db.from("departments").select("id, name").in("id", deptIds);
    deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  }

  return {
    rows: (rows ?? []).map((r) => ({
      ...r,
      department_name: r.department_id ? deptMap.get(r.department_id) ?? null : null,
    })),
    error: null,
  };
}

export type JobCandidateRow = {
  id: string;
  requisition_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  notes: string | null;
  created_at: string | null;
  requisition_title: string | null;
  department_name: string | null;
  cv_storage_path: string | null;
  hired_employee_id: string | null;
};

export async function fetchJobCandidates(tenantId: string): Promise<{
  rows: JobCandidateRow[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data: rows, error: qErr } = await db
    .from("job_candidates")
    .select(
      "id, requisition_id, full_name, email, phone, stage, notes, created_at, cv_storage_path, hired_employee_id",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (qErr) return { rows: [], error: qErr.message };

  const reqIds = [...new Set((rows ?? []).map((r) => r.requisition_id))];
  let titleMap = new Map<string, string>();
  let reqDeptMap = new Map<string, string | null>();
  if (reqIds.length) {
    const { data: reqs } = await db.from("job_requisitions").select("id, title, department_id").in("id", reqIds);
    for (const x of reqs ?? []) {
      titleMap.set(x.id, x.title);
      reqDeptMap.set(x.id, x.department_id);
    }
  }

  const deptIds = [...new Set([...reqDeptMap.values()].filter(Boolean))] as string[];
  let deptNameMap = new Map<string, string>();
  if (deptIds.length) {
    const { data: depts } = await db.from("departments").select("id, name").in("id", deptIds);
    deptNameMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  }

  return {
    rows: (rows ?? []).map((r) => {
      const did = reqDeptMap.get(r.requisition_id);
      return {
        ...r,
        requisition_title: titleMap.get(r.requisition_id) ?? null,
        department_name: did ? deptNameMap.get(did) ?? null : null,
      };
    }),
    error: null,
  };
}

export type PayrollRunRow = {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: string;
  notes: string | null;
  created_at: string | null;
};

export type PayrollLineRow = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  gross_cents: number;
  deductions_cents: number;
  net_cents: number;
  employee_name: string | null;
};

export async function fetchPayrollRuns(tenantId: string): Promise<{
  rows: PayrollRunRow[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data, error: qErr } = await db
    .from("payroll_runs")
    .select("id, period_label, period_start, period_end, status, notes, created_at")
    .eq("tenant_id", tenantId)
    .order("period_start", { ascending: false });

  if (qErr) return { rows: [], error: qErr.message };
  return { rows: data ?? [], error: null };
}

export async function fetchPayrollLinesForRun(
  tenantId: string,
  runId: string,
): Promise<{ rows: PayrollLineRow[]; error: string | null }> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data: lines, error: qErr } = await db
    .from("payroll_lines")
    .select("id, payroll_run_id, employee_id, gross_cents, deductions_cents, net_cents")
    .eq("tenant_id", tenantId)
    .eq("payroll_run_id", runId);

  if (qErr) return { rows: [], error: qErr.message };

  const empIds = [...new Set((lines ?? []).map((l) => l.employee_id))];
  let nameMap = new Map<string, string>();
  if (empIds.length) {
    const { data: emps } = await db.from("employees").select("id, full_name").in("id", empIds);
    nameMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
  }

  return {
    rows: (lines ?? []).map((l) => ({
      ...l,
      employee_name: nameMap.get(l.employee_id) ?? null,
    })),
    error: null,
  };
}

export type HrmsShiftRow = {
  id: string;
  employee_id: string;
  shift_date: string;
  /** Inclusive end date; when null in DB, equals shift_date. */
  shift_date_to: string | null;
  start_time: string;
  end_time: string;
  shift_type: string | null;
  employee_label: string;
};

/** Recent shifts (newest first) — service role when available so rows aren’t hidden by RLS. */
export async function fetchHrmsShiftsTable(tenantId: string, limit = 120): Promise<{
  rows: HrmsShiftRow[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data: shifts, error: qErr } = await db
    .from("shifts")
    .select("id, employee_id, shift_date, shift_date_to, start_time, end_time, shift_type")
    .eq("tenant_id", tenantId)
    .order("shift_date", { ascending: false })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (qErr) return { rows: [], error: qErr.message };

  const empIds = [...new Set((shifts ?? []).map((s) => s.employee_id))];
  let empMap = new Map<string, string>();
  if (empIds.length) {
    const { data: emps } = await db.from("employees").select("id, full_name, job_title").in("id", empIds);
    empMap = new Map(
      (emps ?? []).map((e) => [
        e.id,
        e.full_name + (e.job_title ? ` · ${e.job_title}` : ""),
      ]),
    );
  }

  return {
    rows: (shifts ?? []).map((s) => {
      const raw = s as typeof s & { shift_date_to?: string | null };
      return {
        ...s,
        shift_date_to: raw.shift_date_to ?? null,
        employee_label: empMap.get(s.employee_id) ?? "—",
      };
    }),
    error: null,
  };
}

/** Active employees with department label — for attendance dashboard / reports. */
export async function fetchActiveEmployeesWithDept(tenantId: string): Promise<{
  rows: { id: string; full_name: string; department: string }[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data: emps, error: qErr } = await db
    .from("employees")
    .select("id, full_name, department_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (qErr) return { rows: [], error: qErr.message };

  const deptIds = [...new Set((emps ?? []).map((e) => e.department_id).filter(Boolean))] as string[];
  let deptMap = new Map<string, string>();
  if (deptIds.length) {
    const { data: depts } = await db.from("departments").select("id, name").eq("tenant_id", tenantId).in("id", deptIds);
    deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  }

  return {
    rows: (emps ?? []).map((e) => ({
      id: e.id,
      full_name: e.full_name,
      department: e.department_id ? deptMap.get(e.department_id) ?? "—" : "—",
    })),
    error: null,
  };
}

/** Attendance punches in [rangeStart, rangeEnd] (ISO timestamps), capped for safety. */
export async function fetchAttendanceLogsRange(
  tenantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  limit = 8000,
): Promise<{
  rows: { id: string; employee_id: string; punch_type: string; punched_at: string }[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data: logs, error: lErr } = await db
    .from("attendance_logs")
    .select("id, employee_id, punch_type, punched_at")
    .eq("tenant_id", tenantId)
    .gte("punched_at", rangeStartIso)
    .lte("punched_at", rangeEndIso)
    .order("punched_at", { ascending: true })
    .limit(limit);

  if (lErr) return { rows: [], error: lErr.message };
  return { rows: logs ?? [], error: null };
}

export async function fetchEmployeeOptions(tenantId: string): Promise<{
  rows: { id: string; full_name: string }[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data, error: qErr } = await db
    .from("employees")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true });

  if (qErr) return { rows: [], error: qErr.message };
  return { rows: data ?? [], error: null };
}

export type PayrollEmployeeRow = {
  id: string;
  full_name: string;
  monthly_salary_cents: number | null;
};

/** Same as options, plus `monthly_salary_cents` for payroll vs expected-amount status. */
export async function fetchEmployeesForPayroll(tenantId: string): Promise<{
  rows: PayrollEmployeeRow[];
  error: string | null;
}> {
  const { db, error } = await srOrClient(tenantId);
  if (error || !db) return { rows: [], error: error ?? "No database client." };

  const { data, error: qErr } = await db
    .from("employees")
    .select("id, full_name, monthly_salary_cents")
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true });

  if (qErr) return { rows: [], error: qErr.message };
  return { rows: (data ?? []) as PayrollEmployeeRow[], error: null };
}
