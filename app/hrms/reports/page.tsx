import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchHrmsReportsAnalytics } from "@/lib/queries/tenant-data";
import { HrmsLinkButton } from "@/components/hrms/hrms-link-button";
import { HrReportsToolbarClient } from "@/components/hrms/hr-reports-toolbar-client";

export default async function HrReportsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Analytics & insights
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load HR analytics.
        </p>
      </div>
    );
  }

  const { totalEmployees: total, departments: depts, error: reportErr } =
    await fetchHrmsReportsAnalytics(tenantId);
  const max = Math.max(1, ...depts.map((d) => d.employee_count));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Analytics & insights
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Live headcount and department breakdown from Supabase. Use exports below to download CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HrmsLinkButton href="/hrms/employees" variant="secondary">
            Employee directory
          </HrmsLinkButton>
          <HrmsLinkButton href="/hrms/time" variant="secondary">
            Time & attendance
          </HrmsLinkButton>
        </div>
      </div>

      {reportErr ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {reportErr}
        </p>
      ) : null}

      <HrReportsToolbarClient departments={depts} totalEmployees={total} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Headcount snapshot</CardTitle>
            <CardDescription>Total employees in the tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gold">{total}</p>
            <p className="mt-2 text-xs text-zinc-500">Employee records (employees table) for this property.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Department distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8">
            <p className="text-3xl font-bold text-gold">{total}</p>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Staff total</p>
            <div className="mt-6 w-full space-y-2 text-sm">
              {depts.length === 0 ? (
                <p className="text-center text-zinc-500">No departments yet.</p>
              ) : (
                depts.map((d) => (
                  <div key={d.id} className="flex justify-between">
                    <span className="text-zinc-400">{d.name}</span>
                    <span>
                      {total === 0
                        ? "0%"
                        : `${Math.round((d.employee_count / total) * 100)}%`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department bar chart</CardTitle>
          <CardDescription>Relative headcount by department.</CardDescription>
        </CardHeader>
        <CardContent>
          {depts.length === 0 ? (
            <p className="text-sm text-zinc-500">No departments to chart.</p>
          ) : (
            <div className="flex h-40 items-end justify-between gap-1">
              {depts.map((d) => (
                <div key={d.id} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-gold/50"
                    style={{ height: `${Math.max(8, (d.employee_count / max) * 120)}px` }}
                  />
                  <span className="text-center text-[10px] text-zinc-600">
                    {d.name.slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
