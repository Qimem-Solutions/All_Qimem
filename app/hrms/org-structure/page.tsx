import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchDepartmentsWithCounts } from "@/lib/queries/tenant-data";

export default async function OrgStructurePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Organization hierarchy
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to view departments.
        </p>
      </div>
    );
  }

  const { rows, totalEmployees, error } = await fetchDepartmentsWithCounts(tenantId);
  const max = Math.max(1, ...rows.map((r) => r.employee_count));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Organization hierarchy
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Departments and headcount from Supabase ({totalEmployees} employees).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" type="button" disabled>
            Export PDF
          </Button>
          <Button type="button" disabled>
            + Add node
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Departments</CardTitle>
              <CardDescription>Employee counts per department row.</CardDescription>
            </div>
            <Badge tone="gold">{totalEmployees} staff</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !error ? (
            <p className="text-sm text-zinc-500">No departments yet. Add rows in the departments table.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((d) => (
                <Card key={d.id} className="border-zinc-700 bg-surface/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{d.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-500">
                    <p>{d.employee_count} employee{d.employee_count === 1 ? "" : "s"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff distribution</CardTitle>
            <CardDescription>By department (live).</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-zinc-500">No data.</p>
            ) : (
              <div className="flex h-36 items-end gap-2">
                {rows.map((d) => (
                  <div key={d.id} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t bg-gold/40"
                      style={{ height: `${Math.max(8, (d.employee_count / max) * 120)}px` }}
                    />
                    <span className="text-center text-[10px] text-zinc-500">
                      {d.name.slice(0, 8)}
                      {d.name.length > 8 ? "…" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization vitality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-zinc-500">
              Deeper analytics can be added when you store targets or history.
            </p>
            <Button variant="ghost" className="gap-1 px-0 text-gold" type="button" disabled>
              Deep dive report <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
