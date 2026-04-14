import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { createClient } from "@/lib/supabase/server";
import { fetchAttendanceLogs } from "@/lib/queries/tenant-data";

export default async function AttendancePage() {
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
          Assign a tenant to your profile to load attendance.
        </p>
      </div>
    );
  }

  const { rows, error } = await fetchAttendanceLogs(tenantId);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;

  const { count: punchCount } = await supabase
    .from("attendance_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("punched_at", startOfDay);

  const { count: empCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Time & attendance
          </h1>
          <p className="mt-1 text-sm text-emerald-500/90">Live data · attendance_logs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" type="button" disabled>
            Export PDF
          </Button>
          <Button type="button" disabled>
            + Manual entry
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Punches today", String(punchCount ?? 0), "UTC day boundary", false],
          ["Employees", String(empCount ?? 0), "Headcount in HRMS", false],
          ["Log rows (latest 50)", String(rows.length), "Most recent first", false],
          ["Status", error ? "Error" : "OK", error ?? "Query health", Boolean(error)],
        ].map(([a, b, c, warn]) => (
          <Card key={a as string}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase text-zinc-500">{a}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">{b}</p>
              <p className={`mt-1 text-xs ${warn ? "text-red-400" : "text-zinc-500"}`}>{c}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance log</CardTitle>
          <CardDescription>Backed by attendance_logs in Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !error ? (
            <p className="text-sm text-zinc-500">No punches recorded yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase text-zinc-500">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Punch type</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Department</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-3 font-medium text-white">{r.employee_name}</td>
                    <td className="py-3 text-zinc-400 capitalize">{r.punch_type}</td>
                    <td className="py-3 font-mono text-xs text-zinc-300">
                      {new Date(r.punched_at).toLocaleString()}
                    </td>
                    <td className="py-3 text-zinc-400">{r.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
