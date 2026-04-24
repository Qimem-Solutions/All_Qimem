import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { fetchPayrollRuns, fetchPayrollLinesForRun, fetchEmployeesForPayroll } from "@/lib/queries/hrms-extended";
import { HrmsPayrollClient } from "@/components/hrms/hrms-payroll-client";
import { HrmsLinkButton } from "@/components/hrms/hrms-link-button";

export const dynamic = "force-dynamic";

export default async function HrmsPayrollPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Payroll
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load payroll.
        </p>
      </div>
    );
  }

  const [manage, runsRes, empRes] = await Promise.all([
    canManageHrStaff(ctx),
    fetchPayrollRuns(tenantId),
    fetchEmployeesForPayroll(tenantId),
  ]);

  const linesByRun: Record<string, Awaited<ReturnType<typeof fetchPayrollLinesForRun>>["rows"]> = {};
  for (const r of runsRes.rows) {
    const { rows, error } = await fetchPayrollLinesForRun(tenantId, r.id);
    if (!error) linesByRun[r.id] = rows;
  }

  const d = new Date();
  const defaultYearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Payroll & compensation
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Pay runs and per-employee lines in <code className="text-zinc-400">payroll_runs</code> /{" "}
            <code className="text-zinc-400">payroll_lines</code> (amounts stored in cents).
          </p>
        </div>
        <HrmsLinkButton href="/hrms/reports" variant="secondary">
          HR reports
        </HrmsLinkButton>
      </div>

      {runsRes.error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {runsRes.error} — run the latest Supabase migration if tables are missing.
        </p>
      ) : null}

      {empRes.error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {empRes.error}
        </p>
      ) : null}

      <HrmsPayrollClient
        tenantId={tenantId}
        canManage={manage}
        runs={runsRes.rows}
        linesByRun={linesByRun}
        payrollEmployees={empRes.rows}
        defaultYearMonth={defaultYearMonth}
      />
    </div>
  );
}
