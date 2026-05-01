import { Badge } from "@/components/ui/badge";
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
          Analytics and insights
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
  const activeDepts = depts.filter((d) => d.is_active !== false);
  const inactiveDepts = depts.length - activeDepts.length;
  const avgPerDept =
    activeDepts.length === 0 ? 0 : Number((total / Math.max(1, activeDepts.length)).toFixed(1));
  const largestDept = [...depts].sort((a, b) => b.employee_count - a.employee_count)[0] ?? null;
  const top5 = [...depts].sort((a, b) => b.employee_count - a.employee_count).slice(0, 5);
  const concentrationPct =
    total === 0
      ? 0
      : Math.round((top5.reduce((sum, d) => sum + d.employee_count, 0) / total) * 100);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Analytics and insights
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Executive workforce reporting for this property: live headcount, department concentration,
            and organizational balance metrics from HRMS.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="gold">Live</Badge>
          <HrmsLinkButton href="/hrms/employees" variant="secondary">
            Employee directory
          </HrmsLinkButton>
          <HrmsLinkButton href="/hrms/time" variant="secondary">
            Time and attendance
          </HrmsLinkButton>
        </div>
      </div>

      {reportErr ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {reportErr}
        </p>
      ) : null}

      <HrReportsToolbarClient departments={depts} totalEmployees={total} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Total headcount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{total}</p>
            <p className="mt-1 text-xs text-zinc-500">Employee records in this tenant.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Active departments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{activeDepts.length}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {inactiveDepts > 0
                ? `${inactiveDepts} inactive department(s)`
                : "No inactive departments"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Avg staff per dept
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{avgPerDept}</p>
            <p className="mt-1 text-xs text-zinc-500">Across active departments.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Top-5 concentration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{concentrationPct}%</p>
            <p className="mt-1 text-xs text-zinc-500">Share of workforce in top 5 departments.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Department composition</CardTitle>
            <CardDescription>Headcount and contribution by department.</CardDescription>
          </CardHeader>
          <CardContent>
            {depts.length === 0 ? (
              <p className="text-sm text-zinc-500">No departments yet.</p>
            ) : (
              <div className="space-y-3">
                {[...depts].sort((a, b) => b.employee_count - a.employee_count).map((d) => {
                  const pct = total === 0 ? 0 : Math.round((d.employee_count / total) * 100);
                  return (
                    <div key={d.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-300">{d.name}</span>
                          {d.is_active === false ? <Badge tone="gray">inactive</Badge> : null}
                        </div>
                        <span className="text-zinc-500">
                          {d.employee_count} staff and {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-gold/70"
                          style={{ width: `${Math.max(4, (d.employee_count / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workforce insight</CardTitle>
            <CardDescription>Quick interpretation of current structure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Largest department</p>
              <p className="mt-1 font-medium text-white">{largestDept?.name ?? "-"}</p>
              <p className="text-xs text-zinc-500">
                {largestDept
                  ? `${largestDept.employee_count} staff (${total ? Math.round((largestDept.employee_count / total) * 100) : 0}%)`
                  : "No data"}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Distribution health</p>
              <p className="mt-1 font-medium text-white">
                {concentrationPct >= 70
                  ? "Highly concentrated"
                  : concentrationPct >= 50
                    ? "Moderately concentrated"
                    : "Balanced"}
              </p>
              <p className="text-xs text-zinc-500">
                Based on top-5 departments holding {concentrationPct}% of headcount.
              </p>
            </div>

            <p className="text-xs text-zinc-500">
              Use this page as a monthly HR snapshot. For action workflows, open employee directory,
              scheduling, or attendance modules.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department skyline removed per request */}
    </div>
  );
}
