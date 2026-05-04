import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { fetchAttendanceLogs } from "@/lib/queries/tenant-data";
import { fetchHrmsDashboardStats } from "@/lib/queries/tenant-data";
import {
  fetchHrmsShiftsTable,
  fetchEmployeeOptions,
  fetchActiveEmployeesWithDept,
  fetchAttendanceLogsRange,
  fetchRecentTimesheetApprovals,
} from "@/lib/queries/hrms-extended";
import { fetchTenantDepartmentsForSelect } from "@/lib/queries/tenant-data";
import { TimeWorkforceClient } from "@/components/hrms/time-workforce-client";
import { createClient } from "@/lib/supabase/server";

export default async function HrmsTimePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Time & attendance
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to your profile to load scheduling and attendance.
        </p>
      </div>
    );
  }

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 120);
  const rangeStartIso = rangeStart.toISOString();
  const rangeEndIso = rangeEnd.toISOString();

  const [manage, shiftsRes, attRes, empRes, dash, activeEmpRes, rangeAttRes, timesheetRes, deptRes] =
    await Promise.all([
      canManageHrStaff(ctx),
      fetchHrmsShiftsTable(tenantId, 120),
      fetchAttendanceLogs(tenantId),
      fetchEmployeeOptions(tenantId),
      fetchHrmsDashboardStats(tenantId),
      fetchActiveEmployeesWithDept(tenantId),
      fetchAttendanceLogsRange(tenantId, rangeStartIso, rangeEndIso),
      fetchRecentTimesheetApprovals(tenantId),
      fetchTenantDepartmentsForSelect(tenantId),
    ]);

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;
  const { count: punchTodayFallback } = await supabase
    .from("attendance_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("punched_at", startOfDay);

  const punchToday = dash.punchesToday ?? punchTodayFallback ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Time & attendance
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Live attendance dashboard, scheduling with date ranges and shift types, punch log, automated
          timesheets, and late / overtime flags (manage access required for edits).
        </p>
      </div>

      <TimeWorkforceClient
        tenantId={tenantId}
        canManage={manage}
        shifts={shiftsRes.rows}
        attendance={attRes.rows}
        attendanceRange={rangeAttRes.rows}
        attendanceRangeError={rangeAttRes.error}
        dashboardEmployees={activeEmpRes.rows}
        dashboardEmployeesError={activeEmpRes.error}
        employees={empRes.rows}
        punchToday={punchToday}
        shiftError={shiftsRes.error}
        attendanceError={attRes.error}
        timesheetApprovals={timesheetRes.rows}
        timesheetApprovalsError={timesheetRes.error}
        departments={deptRes.rows}
        departmentsError={deptRes.error}
      />
    </div>
  );
}
