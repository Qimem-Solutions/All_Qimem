import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, TrendingUp, AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchEmployees, fetchEmployeeStats } from "@/lib/queries/tenant-data";
import { formatDate } from "@/lib/format";

function StatusBadge({ s }: { s: string }) {
  const x = s.toLowerCase();
  if (x === "active") return <Badge tone="gold">Active</Badge>;
  if (x === "pending" || x === "probation") return <Badge tone="orange">Pending</Badge>;
  if (x === "leave" || x === "on_leave") return <Badge tone="red">On leave</Badge>;
  if (x === "terminated" || x === "inactive") return <Badge tone="gray">Inactive</Badge>;
  return <Badge tone="gray">{s}</Badge>;
}

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

  const { rows, error } = await fetchEmployees(tenantId);
  const stats = await fetchEmployeeStats(tenantId);
  const activeApprox = rows.filter((r) => (r.status ?? "").toLowerCase() === "active").length;

  const statCards = [
    {
      label: "Total workforce",
      value: String(rows.length),
      sub: stats.error ? stats.error : "Employees in this property",
      trend: rows.length > 0,
    },
    {
      label: "Active (listed)",
      value: String(activeApprox),
      sub: "Rows with status active",
    },
    {
      label: "Departments",
      value: String(new Set(rows.map((r) => r.department_id).filter(Boolean)).size),
      sub: "Distinct department IDs",
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Employee directory
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Staff records from the employees table for your tenant.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button" disabled>
            Advanced filters
          </Button>
          <Button type="button" disabled>
            + Invite new staff
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Staff roster</CardTitle>
            <CardDescription>Sorted by name.</CardDescription>
          </div>
          <div className="flex w-full max-w-md flex-wrap gap-2">
            <Input placeholder="Search name or ID..." className="min-w-[160px] flex-1" disabled />
            <Button variant="secondary" size="sm" type="button" disabled>
              All departments
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !error ? (
            <p className="text-sm text-zinc-500">No employees yet. Add rows in Supabase or your admin flow.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Role & department</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Join date</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold">
                          {r.full_name
                            .split(" ")
                            .map((x: string) => x[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{r.full_name}</p>
                          <p className="text-xs text-zinc-500">{r.employee_code ?? r.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <p className="text-white">{r.job_title ?? "—"}</p>
                      <p className="text-xs text-gold">{r.department_name ?? "—"}</p>
                    </td>
                    <td className="py-4">
                      <StatusBadge s={r.status} />
                    </td>
                    <td className="py-4 text-zinc-400">
                      {r.hire_date ? formatDate(r.hire_date) : "—"}
                    </td>
                    <td className="py-4 text-right">
                      <button type="button" className="text-zinc-500 hover:text-white">
                        <MoreHorizontal className="inline h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-xs text-zinc-600">
            Showing {rows.length} employee{rows.length === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
