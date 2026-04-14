"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createShiftAction,
  deleteShiftAction,
  recordPunchAction,
} from "@/lib/actions/hrms-modules";
import type { HrmsShiftRow } from "@/lib/queries/hrms-extended";

type AttRow = {
  id: string;
  punch_type: string;
  punched_at: string;
  employee_name: string;
  department: string;
};

type Props = {
  tenantId: string;
  canManage: boolean;
  shifts: HrmsShiftRow[];
  attendance: AttRow[];
  employees: { id: string; full_name: string }[];
  punchToday: number;
  shiftError: string | null;
  attendanceError: string | null;
};

export function TimeWorkforceClient({
  tenantId,
  canManage,
  shifts,
  attendance,
  employees,
  punchToday,
  shiftError,
  attendanceError,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "shifts" | "attendance">("overview");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function onShiftSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setMsg(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createShiftAction({
      tenantId,
      employeeId: String(fd.get("employeeId")),
      shiftDate: String(fd.get("shiftDate")),
      startTime: String(fd.get("startTime")),
      endTime: String(fd.get("endTime")),
      shiftType: String(fd.get("shiftType") ?? "") || null,
    });
    setLoading(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    e.currentTarget.reset();
    (e.currentTarget.elements.namedItem("shiftDate") as HTMLInputElement)?.setAttribute("value", today);
    router.refresh();
    setMsg("Shift saved.");
  }

  async function onPunchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setMsg(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await recordPunchAction({
      tenantId,
      employeeId: String(fd.get("employeeId")),
      punchType: String(fd.get("punchType")),
    });
    setLoading(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    router.refresh();
    setMsg("Punch recorded.");
  }

  async function removeShift(id: string) {
    if (!canManage || !confirm("Delete this shift?")) return;
    setMsg(null);
    const res = await deleteShiftAction({ tenantId, shiftId: id });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    router.refresh();
  }

  const tabs = (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {(
        [
          ["overview", "Overview"],
          ["shifts", "Shifts"],
          ["attendance", "Attendance"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === id ? "bg-gold text-gold-foreground" : "text-zinc-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {tabs}

      {msg ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
          {msg}
        </p>
      ) : null}

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Punches today (UTC)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{punchToday}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Shifts listed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{shifts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Attendance rows</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{attendance.length}</p>
              <p className="mt-1 text-xs text-zinc-500">Latest 50 in log</p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "shifts" && (
        <div className="space-y-6">
          {canManage && employees.length === 0 ? (
            <p className="text-sm text-amber-200/90">Add employees in the directory before creating shifts.</p>
          ) : null}
          {canManage && employees.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add shift</CardTitle>
                <CardDescription>Creates a row in the shifts table for scheduling.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={onShiftSubmit}>
                  <label className="text-xs text-zinc-400 lg:col-span-2">
                    Employee
                    <select
                      name="employeeId"
                      required
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                    >
                      <option value="">Select…</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-zinc-400">
                    Date
                    <Input className="mt-1" name="shiftDate" type="date" required defaultValue={today} />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Start
                    <Input className="mt-1 font-mono" name="startTime" type="time" required defaultValue="09:00" />
                  </label>
                  <label className="text-xs text-zinc-400">
                    End
                    <Input className="mt-1 font-mono" name="endTime" type="time" required defaultValue="17:00" />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Type (optional)
                    <Input className="mt-1" name="shiftType" placeholder="morning, night…" />
                  </label>
                  <div className="flex items-end lg:col-span-6">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving…" : "Save shift"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : !canManage ? (
            <p className="text-sm text-zinc-500">HRMS manage access is required to add or delete shifts.</p>
          ) : null}

          {shiftError ? (
            <p className="text-sm text-red-300">{shiftError}</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shift list</CardTitle>
                <CardDescription>Most recent first (up to 120 rows).</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {shifts.length === 0 ? (
                  <p className="text-sm text-zinc-500">No shifts yet.</p>
                ) : (
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-zinc-500">
                        <th className="pb-3 font-medium">Employee</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Start</th>
                        <th className="pb-3 font-medium">End</th>
                        <th className="pb-3 font-medium">Type</th>
                        {canManage ? <th className="pb-3 text-right font-medium"> </th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((r) => (
                        <tr key={r.id} className="border-b border-border/60">
                          <td className="py-3 text-white">{r.employee_label}</td>
                          <td className="py-3">{r.shift_date}</td>
                          <td className="py-3 font-mono text-xs">{r.start_time}</td>
                          <td className="py-3 font-mono text-xs">{r.end_time}</td>
                          <td className="py-3 text-zinc-400">{r.shift_type ?? "—"}</td>
                          {canManage ? (
                            <td className="py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-xs text-red-400 hover:text-red-300"
                                onClick={() => removeShift(r.id)}
                              >
                                Delete
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-6">
          {canManage && employees.length === 0 ? (
            <p className="text-sm text-amber-200/90">Add employees before recording punches.</p>
          ) : null}
          {canManage && employees.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record punch</CardTitle>
                <CardDescription>Writes to attendance_logs (in / out / break).</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-wrap items-end gap-3" onSubmit={onPunchSubmit}>
                  <label className="text-xs text-zinc-400">
                    Employee
                    <select
                      name="employeeId"
                      required
                      className="mt-1 h-10 min-w-[200px] rounded-lg border border-border bg-surface px-3 text-sm"
                    >
                      <option value="">Select…</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-zinc-400">
                    Type
                    <select
                      name="punchType"
                      required
                      className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm"
                    >
                      <option value="in">In</option>
                      <option value="out">Out</option>
                      <option value="break_start">Break start</option>
                      <option value="break_end">Break end</option>
                    </select>
                  </label>
                  <Button type="submit" disabled={loading}>
                    Record punch
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : !canManage ? (
            <p className="text-sm text-zinc-500">HRMS manage access is required to record punches.</p>
          ) : null}

          {attendanceError ? (
            <p className="text-sm text-red-300">{attendanceError}</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance log</CardTitle>
                <CardDescription>Latest 50 punches.</CardDescription>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <p className="text-sm text-zinc-500">No punches recorded yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-zinc-500">
                        <th className="pb-3 font-medium">Employee</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium">Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((r) => (
                        <tr key={r.id} className="border-b border-border/60">
                          <td className="py-3 font-medium text-white">{r.employee_name}</td>
                          <td className="py-3 capitalize text-zinc-400">{r.punch_type}</td>
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
          )}
        </div>
      )}
    </div>
  );
}
