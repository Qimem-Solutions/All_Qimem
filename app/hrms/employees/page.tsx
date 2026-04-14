import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { fetchEmployeeStats, fetchHrmsDirectory } from "@/lib/queries/tenant-data";
import { EmployeesDirectoryClient } from "@/components/hrms/employees-directory-client";

export default async function EmployeesPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Employee directory
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          No tenant on your profile — employees cannot be loaded.
        </p>
      </div>
    );
  }

  const [{ rows, departments, error }, stats, manage] = await Promise.all([
    fetchHrmsDirectory(tenantId),
    fetchEmployeeStats(tenantId),
    canManageHrStaff(ctx),
  ]);
  const employeesOnly = rows.filter((r) => r.kind === "employee");
  const activeApprox = employeesOnly.filter((r) => (r.status ?? "").toLowerCase() === "active").length;
  const distinctDeptIds = new Set(
    employeesOnly.map((r) => r.department_id).filter(Boolean) as string[],
  );

  const statCards = [
    {
      label: "Total workforce",
      value: String(rows.length),
      sub: stats.error ? stats.error : "Employees + tenant accounts (see roster)",
      trend: rows.length > 0,
    },
    {
      label: "Active (listed)",
      value: String(activeApprox),
      sub: "Rows with status active",
    },
    {
      label: "Departments",
      value: String(distinctDeptIds.size),
      sub: "With at least one employee",
    },
    {
      label: "Data health",
      value: error ? "Error" : "OK",
      sub: error ?? "Loaded from Supabase",
      warn: Boolean(error),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">{s.value}</span>
                {s.trend ? (
                  <span className="flex items-center gap-0.5 text-xs text-emerald-400">
                    <TrendingUp className="h-3 w-3" /> live
                  </span>
                ) : null}
                {s.warn ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmployeesDirectoryClient
        tenantId={tenantId}
        rows={rows}
        error={error}
        canManageStaff={manage}
        allDepartments={departments}
        departmentsForStaffForm={departments}
        departmentFormError={null}
      />
    </div>
  );
}
