"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import { formatDate } from "@/lib/format";
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

type AttendanceOverviewRow = {
  employeeName: string;
  department: string;
  workDate: string;
  totalMs: number;
  latestPunchAt: string;
  latestPunchType: string;
  status: "working" | "away";
};

function formatDuration(totalMs: number) {
  if (totalMs <= 0) return "0m";
  const totalMinutes = Math.round(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatPunchTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

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
  const [shiftDeleteId, setShiftDeleteId] = useState<string | null>(null);
  const [shiftDeleteLoading, setShiftDeleteLoading] = useState(false);
  const [shiftDeleteError, setShiftDeleteError] = useState<string | null>(null);
  const [shiftQuery, setShiftQuery] = useState("");
  const [shiftPage, setShiftPage] = useState(1);
  const [shiftPageSize, setShiftPageSize] = useState(10);
  const [shiftTypeFilter, setShiftTypeFilter] = useState<"all" | string>("all");
  const [shiftDateFilter, setShiftDateFilter] = useState<string>("");
  const [attQuery, setAttQuery] = useState("");
  const [attFilter, setAttFilter] = useState<"all" | string>("all");
  const [attPage, setAttPage] = useState(1);
  const [attPageSize, setAttPageSize] = useState(10);
  const [overviewGeneratedAt] = useState(() => Date.now());

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const attendanceOverview = useMemo<AttendanceOverviewRow[]>(() => {
    const grouped = new Map<string, AttRow[]>();

    for (const row of attendance) {
      const workDate = row.punched_at.slice(0, 10);
      const key = `${row.employee_name}::${workDate}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(row);
      grouped.set(key, bucket);
    }

    return Array.from(grouped.values())
      .map((rows) => {
        const ordered = [...rows].sort(
          (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
        );
        let activeStart: number | null = null;
        let totalMs = 0;

        for (const row of ordered) {
          const stamp = new Date(row.punched_at).getTime();
          if (Number.isNaN(stamp)) continue;

          if (row.punch_type === "in") {
            if (activeStart == null) activeStart = stamp;
            continue;
          }

          if (row.punch_type === "break_start" || row.punch_type === "out") {
            if (activeStart != null && stamp > activeStart) totalMs += stamp - activeStart;
            activeStart = null;
            continue;
          }

          if (row.punch_type === "break_end" && activeStart == null) {
            activeStart = stamp;
          }
        }

        if (activeStart != null) {
          totalMs += Math.max(0, overviewGeneratedAt - activeStart);
        }

        const latest = ordered.at(-1);
        if (!latest) return null;

        return {
          employeeName: latest.employee_name,
          department: latest.department,
          workDate: latest.punched_at.slice(0, 10),
          totalMs,
          latestPunchAt: latest.punched_at,
          latestPunchType: latest.punch_type,
          status: latest.punch_type === "in" || latest.punch_type === "break_end" ? "working" : "away",
        };
      })
      .filter((row): row is AttendanceOverviewRow => row != null)
      .sort((a, b) => new Date(b.latestPunchAt).getTime() - new Date(a.latestPunchAt).getTime());
  }, [attendance, overviewGeneratedAt]);
  const totalWorkedMs = useMemo(
    () => attendanceOverview.reduce((sum, row) => sum + row.totalMs, 0),
    [attendanceOverview],
  );
  const uniqueEmployeesInLog = useMemo(
    () => new Set(attendance.map((row) => row.employee_name)).size,
    [attendance],
  );

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

  function requestRemoveShift(id: string) {
    if (!canManage) return;
    setShiftDeleteError(null);
    setShiftDeleteId(id);
  }

  async function confirmRemoveShift() {
    if (!shiftDeleteId || !canManage) return;
    setShiftDeleteLoading(true);
    setShiftDeleteError(null);
    setMsg(null);
    const res = await deleteShiftAction({ tenantId, shiftId: shiftDeleteId });
    setShiftDeleteLoading(false);
    if (!res.ok) {
      setShiftDeleteError(res.error);
      return;
    }
    setShiftDeleteId(null);
    router.refresh();
  }

  function closeShiftDelete() {
    if (shiftDeleteLoading) return;
    setShiftDeleteId(null);
    setShiftDeleteError(null);
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
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
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
                <CardTitle className="text-sm text-zinc-400">Team members in log</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-white">{uniqueEmployeesInLog}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">Total tracked time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-white">{formatDuration(totalWorkedMs)}</p>
                <p className="mt-1 text-xs text-zinc-500">Calculated from the latest 50 punches</p>
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance overview</CardTitle>
              <CardDescription>User, work date, and total tracked time from recent punches.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {attendanceOverview.length === 0 ? (
                <p className="text-sm text-zinc-500">No attendance activity to summarize yet.</p>
              ) : (
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-zinc-500">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Total time</th>
                      <th className="pb-3 font-medium">Latest punch</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceOverview.map((row) => (
                      <tr key={`${row.employeeName}-${row.workDate}`} className="border-b border-border/60">
                        <td className="py-3">
                          <p className="font-medium text-white">{row.employeeName}</p>
                          <p className="text-xs text-zinc-500">{row.department || "—"}</p>
                        </td>
                        <td className="py-3 text-zinc-300">{formatDate(row.workDate)}</td>
                        <td className="py-3 font-medium text-white">{formatDuration(row.totalMs)}</td>
                        <td className="py-3">
                          <p className="font-mono text-xs text-zinc-300">
                            {new Date(row.latestPunchAt).toLocaleString()}
                          </p>
                          <p className="text-xs capitalize text-zinc-500">
                            {formatPunchTypeLabel(row.latestPunchType)}
                          </p>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              row.status === "working"
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-zinc-500/15 text-zinc-300"
                            }`}
                          >
                            {row.status === "working" ? "Working" : "Away"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                <div className="mb-3 flex flex-col gap-3 sm:flex-row">
                  <Input
                    placeholder="Search employee, type, or date…"
                    value={shiftQuery}
                    onChange={(e) => {
                      setShiftQuery(e.target.value);
                      setShiftPage(1);
                    }}
                    aria-label="Search shifts"
                  />
                  <select
                    className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                    value={shiftTypeFilter}
                    onChange={(e) => {
                      setShiftTypeFilter((e.target.value as "all" | string) || "all");
                      setShiftPage(1);
                    }}
                    aria-label="Filter shifts by type"
                  >
                    <option value="all">All types</option>
                    {Array.from(new Set(shifts.map((s) => s.shift_type).filter(Boolean)))
                      .map((t) => String(t))
                      .map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                  </select>
                  <label className="text-xs">
                    <span className="sr-only">Filter by date</span>
                    <Input
                      type="date"
                      value={shiftDateFilter}
                      onChange={(e) => {
                        setShiftDateFilter(e.target.value);
                        setShiftPage(1);
                      }}
                      className="h-10"
                      aria-label="Filter shifts by date"
                    />
                  </label>
                </div>
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
                      {(() => {
                        const q = shiftQuery.trim().toLowerCase();
                        const filtered = shifts.filter((r) => {
                          if (shiftTypeFilter !== "all" && (r.shift_type ?? "") !== shiftTypeFilter) return false;
                          if (shiftDateFilter && r.shift_date !== shiftDateFilter) return false;
                          if (!q) return true;
                          const blob = [r.employee_label ?? "", r.shift_type ?? "", r.shift_date ?? ""].join(" ").toLowerCase();
                          return blob.includes(q);
                        });
                        const totalPages = Math.max(1, Math.ceil(filtered.length / shiftPageSize));
                        const pageSafe = Math.min(Math.max(1, shiftPage), totalPages);
                        const offset = (pageSafe - 1) * shiftPageSize;
                        const paged = filtered.slice(offset, offset + shiftPageSize);
                        return paged.map((r) => (
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
                                  onClick={() => requestRemoveShift(r.id)}
                                >
                                  Delete
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                )}
              </CardContent>
              {shifts.length > 0 ? (
                <ListPagination
                  itemLabel="shifts"
                  totalItems={shifts.length}
                  filteredItems={shifts.filter((r) => {
                    if (shiftTypeFilter !== "all" && (r.shift_type ?? "") !== shiftTypeFilter) return false;
                    if (shiftDateFilter && r.shift_date !== shiftDateFilter) return false;
                    const q = shiftQuery.trim().toLowerCase();
                    if (!q) return true;
                    const blob = [r.employee_label ?? "", r.shift_type ?? "", r.shift_date ?? ""].join(" ").toLowerCase();
                    return blob.includes(q);
                  }).length}
                  page={Math.min(Math.max(1, shiftPage), Math.max(1, Math.ceil(shifts.length / shiftPageSize)))}
                  pageSize={shiftPageSize}
                  totalPages={Math.max(1, Math.ceil(shifts.length / shiftPageSize))}
                  onPageChange={setShiftPage}
                  onPageSizeChange={(next) => {
                    setShiftPageSize(next);
                    setShiftPage(1);
                  }}
                />
              ) : null}
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
                <div className="mb-3 flex flex-col gap-3 sm:flex-row">
                  <Input
                    placeholder="Search employee, type, or department…"
                    value={attQuery}
                    onChange={(e) => {
                      setAttQuery(e.target.value);
                      setAttPage(1);
                    }}
                    aria-label="Search attendance"
                  />
                  <select
                    className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                    value={attFilter}
                    onChange={(e) => {
                      setAttFilter((e.target.value as "all" | string) || "all");
                      setAttPage(1);
                    }}
                    aria-label="Filter attendance by type"
                  >
                    <option value="all">All types</option>
                    <option value="in">In</option>
                    <option value="out">Out</option>
                    <option value="break_start">Break start</option>
                    <option value="break_end">Break end</option>
                  </select>
                </div>
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
                      {(() => {
                        const q = attQuery.trim().toLowerCase();
                        const filtered = attendance.filter((r) => {
                          if (attFilter !== "all" && r.punch_type !== attFilter) return false;
                          if (!q) return true;
                          const blob = [r.employee_name ?? "", r.punch_type ?? "", r.department ?? "", r.punched_at ?? ""].join(" ").toLowerCase();
                          return blob.includes(q);
                        });
                        const totalPages = Math.max(1, Math.ceil(filtered.length / attPageSize));
                        const pageSafe = Math.min(Math.max(1, attPage), totalPages);
                        const offset = (pageSafe - 1) * attPageSize;
                        const paged = filtered.slice(offset, offset + attPageSize);
                        return paged.map((r) => (
                          <tr key={r.id} className="border-b border-border/60">
                            <td className="py-3 font-medium text-white">{r.employee_name}</td>
                            <td className="py-3 capitalize text-zinc-400">{r.punch_type}</td>
                            <td className="py-3 font-mono text-xs text-zinc-300">{new Date(r.punched_at).toLocaleString()}</td>
                            <td className="py-3 text-zinc-400">{r.department}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                )}
              </CardContent>
              {attendance.length > 0 ? (
                <ListPagination
                  itemLabel="punches"
                  totalItems={attendance.length}
                  filteredItems={attendance.filter((r) => {
                    if (attFilter !== "all" && r.punch_type !== attFilter) return false;
                    const q = attQuery.trim().toLowerCase();
                    if (!q) return true;
                    const blob = [r.employee_name ?? "", r.punch_type ?? "", r.department ?? "", r.punched_at ?? ""].join(" ").toLowerCase();
                    return blob.includes(q);
                  }).length}
                  page={Math.min(Math.max(1, attPage), Math.max(1, Math.ceil(attendance.length / attPageSize)))}
                  pageSize={attPageSize}
                  totalPages={Math.max(1, Math.ceil(attendance.length / attPageSize))}
                  onPageChange={setAttPage}
                  onPageSizeChange={(next) => {
                    setAttPageSize(next);
                    setAttPage(1);
                  }}
                />
              ) : null}
            </Card>
          )}
        </div>
      )}

      <ConfirmModal
        open={shiftDeleteId != null}
        title="Delete shift"
        description="Delete this shift? This cannot be undone."
        confirmLabel="Delete shift"
        destructive
        loading={shiftDeleteLoading}
        error={shiftDeleteError}
        onCancel={closeShiftDelete}
        onConfirm={confirmRemoveShift}
      />
    </div>
  );
}
