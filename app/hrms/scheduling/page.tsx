import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchShiftsUpcoming } from "@/lib/queries/tenant-data";

export default async function SchedulingPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Staff scheduling
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load shifts.
        </p>
      </div>
    );
  }

  const { rows, error } = await fetchShiftsUpcoming(tenantId, 80);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
              Staff scheduling
            </h1>
            <Badge tone="gold">Pro tier</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Upcoming shifts from the shifts table (next {rows.length} rows).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled>
            + Auto-generate schedule
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shift list</CardTitle>
          <CardDescription>Connect richer UI to the same data when ready.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 && !error ? (
            <p className="text-sm text-zinc-500">No upcoming shifts.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-zinc-500">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Start</th>
                  <th className="pb-3 font-medium">End</th>
                  <th className="pb-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-3 text-white">{r.employee_label}</td>
                    <td className="py-3">{r.shift_date}</td>
                    <td className="py-3 font-mono text-xs">{r.start_time}</td>
                    <td className="py-3 font-mono text-xs">{r.end_time}</td>
                    <td className="py-3 text-zinc-400">{r.shift_type ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed border-zinc-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-zinc-500" />
            Week grid
          </CardTitle>
          <CardDescription>Visual calendar grid can map these rows by shift_date.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
