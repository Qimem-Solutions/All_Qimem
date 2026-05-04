"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import { formatDate } from "@/lib/format";
import {
  createShiftAction,
  copyPriorWeekShiftsAction,
  createShiftsForDepartmentAction,
  deleteShiftAction,
  recordPunchAction,
  upsertTimesheetApprovalAction,
} from "@/lib/actions/hrms-modules";
import type { HrmsShiftRow, TimesheetApprovalRow } from "@/lib/queries/hrms-extended";
import {
  SHIFT_TYPE_OPTIONS,
  derivePresenceStatus,
  expectedClockInMs,
  firstClockInOnBusinessDay,
  formatPresenceLabel,
  pickShiftForBusinessDay,
  punchesOnUtcDay,
  scheduledShiftMinutes,
  sortPunchesAsc,
  workedMinutesPerBusinessDay,
  utcBusinessDayKey,
  type PresenceStatus,
  DEFAULT_WORK_DAY_BOUNDARY_HOUR_UTC,
} from "@/lib/hrms/attendance-compute";
import { Mail, Phone } from "lucide-react";

type AttRow = {
  id: string;
  punch_type: string;
  punched_at: string;
  employee_name: string;
  department: string;
};

type RangeAttRow = {
  id: string;
  employee_id: string;
  punch_type: string;
  punched_at: string;
};

type DashboardEmp = {
  id: string;
  full_name: string;
  department: string;
  email: string | null;
  phone: string | null;
};

type DeptOpt = { id: string; name: string };

type Props = {
  tenantId: string;
  canManage: boolean;
  shifts: HrmsShiftRow[];
  attendance: AttRow[];
  attendanceRange: RangeAttRow[];
  attendanceRangeError: string | null;
  dashboardEmployees: DashboardEmp[];
  dashboardEmployeesError: string | null;
  employees: { id: string; full_name: string }[];
  punchToday: number;
  shiftError: string | null;
  attendanceError: string | null;
  timesheetApprovals: TimesheetApprovalRow[];
  timesheetApprovalsError: string | null;
  departments: DeptOpt[];
  departmentsError: string | null;
};

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function presenceBadgeClass(s: PresenceStatus): string {
  switch (s) {
    case "in":
      return "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40";
    case "out":
      return "bg-zinc-500/20 text-zinc-200 ring-1 ring-zinc-500/40";
    case "on_break":
      return "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40";
    case "absent":
      return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/35";
    default:
      return "bg-zinc-500/20 text-zinc-300";
  }
}

/** Monday-start week (UTC) containing anchor date. */
function weekDatesUtcContaining(anchor: string): string[] {
  const d = new Date(`${anchor}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(monday.getUTCDate() + toMonday);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setUTCDate(monday.getUTCDate() + i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

/** All UTC calendar days in the month of anchor. */
function monthDatesUtcFor(anchor: string): string[] {
  const [yStr, mStr] = anchor.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return [anchor];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    dates.push(new Date(Date.UTC(y, m - 1, day)).toISOString().slice(0, 10));
  }
  return dates;
}

function reportDates(
  period: "day" | "week" | "month",
  anchor: string,
): { dates: string[]; label: string } {
  if (period === "day") {
    return { dates: [anchor], label: anchor };
  }
  if (period === "week") {
    const dates = weekDatesUtcContaining(anchor);
    return {
      dates,
      label: `${dates[0]} → ${dates[dates.length - 1]}`,
    };
  }
  const dates = monthDatesUtcFor(anchor);
  const label = anchor.slice(0, 7);
  return { dates, label: `${label} (full month, UTC)` };
}

type AttendanceOverviewRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  workDate: string;
  totalMs: number;
  latestPunchAt: string;
  latestPunchType: string;
  displayStatus: "working" | "on_break" | "clocked_out";
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

/** Short weekday tags present in an inclusive UTC date span (e.g. M W F). */
function weekdaysLabelUtc(fromIso: string, toIso: string): string {
  const from = Date.parse(`${fromIso}T12:00:00.000Z`);
  const to = Date.parse(`${toIso}T12:00:00.000Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return "—";
  const label = ["Su", "M", "T", "W", "Th", "F", "Sa"];
  const bits = new Set<number>();
  for (let t = from; t <= to; t += 86400000) {
    bits.add(new Date(t).getUTCDay());
  }
  return [...bits]
    .sort((a, b) => a - b)
    .map((d) => label[d])
    .join(" ");
}

function shiftOverlapsIsoDate(r: HrmsShiftRow, iso: string): boolean {
  const start = r.shift_date;
  const end = r.shift_date_to ?? r.shift_date;
  return iso >= start && iso <= end;
}

function overviewRowLabel(
  latestPunchType: string,
): "Working" | "On break" | "Clocked out" {
  const t = latestPunchType.toLowerCase();
  if (t === "break_start") return "On break";
  if (t === "out") return "Clocked out";
  return "Working";
}

function overviewDisplayStatus(
  latestType: string,
): "working" | "on_break" | "clocked_out" {
  const t = latestType.toLowerCase();
  if (t === "break_start") return "on_break";
  if (t === "out") return "clocked_out";
  return "working";
}

export function TimeWorkforceClient({
  tenantId,
  canManage,
  shifts,
  attendance,
  attendanceRange,
  attendanceRangeError,
  dashboardEmployees,
  dashboardEmployeesError,
  employees,
  punchToday,
  shiftError,
  attendanceError,
  timesheetApprovals,
  timesheetApprovalsError,
  departments,
  departmentsError,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "overview" | "shifts" | "attendance" | "reports">(
    "dashboard",
  );
  const msgTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (msgTimer.current) window.clearTimeout(msgTimer.current);
    };
  }, []);

  function showMsg(m: string, ms = 3000) {
    setMsg(m);
    if (msgTimer.current) window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMsg(null), ms) as unknown as number;
  }
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
  const [overviewQuery, setOverviewQuery] = useState("");
  const [overviewStatus, setOverviewStatus] = useState<
    "all" | "working" | "on_break" | "clocked_out"
  >("all");
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewPageSize, setOverviewPageSize] = useState(10);
  const [overviewGeneratedAt] = useState(() => Date.now());

  const [dashboardDate, setDashboardDate] = useState(() => utcTodayIso());
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [dashboardPage, setDashboardPage] = useState(1);
  const [dashboardPageSize, setDashboardPageSize] = useState(10);
  const [copyWeekLoading, setCopyWeekLoading] = useState(false);
  const [deptBulkLoading, setDeptBulkLoading] = useState(false);
  const [approvalKey, setApprovalKey] = useState<string | null>(null);

  const [reportPeriod, setReportPeriod] = useState<"day" | "week" | "month">("week");
  const [reportAnchor, setReportAnchor] = useState(() => utcTodayIso());

  const today = useMemo(() => utcTodayIso(), []);

  const punchesByEmployee = useMemo(() => {
    const m = new Map<string, RangeAttRow[]>();
    for (const p of attendanceRange) {
      const list = m.get(p.employee_id) ?? [];
      list.push(p);
      m.set(p.employee_id, list);
    }
    return m;
  }, [attendanceRange]);

  const dashboardRows = useMemo(() => {
    return dashboardEmployees.map((emp) => {
      const empPunches = punchesByEmployee.get(emp.id) ?? [];
      const dayPunches = sortPunchesAsc(punchesOnUtcDay(empPunches, dashboardDate));
      const status = derivePresenceStatus(dayPunches);
      const lastAt =
        dayPunches.length > 0 ? dayPunches[dayPunches.length - 1]!.punched_at : null;
      return {
        ...emp,
        status,
        lastAt,
      };
    });
  }, [dashboardEmployees, dashboardDate, punchesByEmployee]);

  const dashboardFiltered = useMemo(() => {
    const q = dashboardQuery.trim().toLowerCase();
    return dashboardRows.filter((r) => {
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q)
      );
    });
  }, [dashboardRows, dashboardQuery]);

  const reportSlice = useMemo(() => {
    const { dates, label } = reportDates(reportPeriod, reportAnchor);
    const lastDayIso = dates[dates.length - 1] ?? reportAnchor;
    const periodEndMs = Date.parse(`${lastDayIso}T23:59:59.999Z`);
    type Row = {
      employeeId: string;
      name: string;
      department: string;
      totalMinutes: number;
      daysWithWork: number;
      lateDays: number;
      overtimeMinutes: number;
    };
    const rows: Row[] = dashboardEmployees.map((emp) => {
      let totalMinutes = 0;
      let daysWithWork = 0;
      let lateDays = 0;
      let overtimeMinutes = 0;

      const empPunches = punchesByEmployee.get(emp.id) ?? [];
      const perDay = workedMinutesPerBusinessDay(empPunches, periodEndMs);

      for (const dateIso of dates) {
        const worked = perDay.get(dateIso) ?? 0;
        if (worked > 0) daysWithWork += 1;
        totalMinutes += worked;

        const picked = pickShiftForBusinessDay(shifts, emp.id, dateIso);
        if (picked && worked > 0) {
          const { shift, clockInDateIso } = picked;
          const sched = scheduledShiftMinutes(shift.start_time, shift.end_time);
          overtimeMinutes += Math.max(0, worked - sched);
          const firstIn = firstClockInOnBusinessDay(empPunches, dateIso);
          const exp = expectedClockInMs(shift, clockInDateIso);
          if (firstIn != null && firstIn > exp + 60_000) lateDays += 1;
        }
      }

      return {
        employeeId: emp.id,
        name: emp.full_name,
        department: emp.department,
        totalMinutes,
        daysWithWork,
        lateDays,
        overtimeMinutes,
      };
    });

    const exceptions = rows.filter((r) => r.lateDays > 0 || r.overtimeMinutes > 0);

    const periodStart = dates[0] ?? reportAnchor;
    const periodEnd = dates[dates.length - 1] ?? reportAnchor;

    return { dates, label, rows, exceptions, periodStart, periodEnd };
  }, [dashboardEmployees, punchesByEmployee, reportAnchor, reportPeriod, shifts]);

  const attendanceOverview = useMemo<AttendanceOverviewRow[]>(() => {
    const asOf = overviewGeneratedAt;
    const rows: AttendanceOverviewRow[] = [];

    for (const emp of dashboardEmployees) {
      const empPunches = punchesByEmployee.get(emp.id) ?? [];
      const perDay = workedMinutesPerBusinessDay(empPunches, asOf);

      for (const [workDate, minutes] of perDay) {
        if (minutes <= 0) continue;
        const dayPunches = sortPunchesAsc(
          empPunches.filter((p) => utcBusinessDayKey(Date.parse(p.punched_at)) === workDate),
        );
        const latest = dayPunches[dayPunches.length - 1];
        if (!latest) continue;
        rows.push({
          employeeId: emp.id,
          employeeName: emp.full_name,
          department: emp.department,
          workDate,
          totalMs: minutes * 60000,
          latestPunchAt: latest.punched_at,
          latestPunchType: latest.punch_type,
          displayStatus: overviewDisplayStatus(latest.punch_type),
        });
      }
    }

    return rows.sort(
      (a, b) => new Date(b.latestPunchAt).getTime() - new Date(a.latestPunchAt).getTime(),
    );
  }, [dashboardEmployees, punchesByEmployee, overviewGeneratedAt]);
  const totalWorkedMs = useMemo(
    () => attendanceOverview.reduce((sum, row) => sum + row.totalMs, 0),
    [attendanceOverview],
  );
  const uniqueEmployeesInLog = useMemo(
    () => new Set(attendance.map((row) => row.employee_name)).size,
    [attendance],
  );

  const shiftListFiltered = useMemo(() => {
    const q = shiftQuery.trim().toLowerCase();
    return shifts.filter((r) => {
      if (shiftTypeFilter !== "all" && (r.shift_type ?? "") !== shiftTypeFilter) return false;
      if (shiftDateFilter && !shiftOverlapsIsoDate(r, shiftDateFilter)) return false;
      if (!q) return true;
      const blob = [r.employee_label ?? "", r.shift_type ?? "", r.shift_date ?? ""]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [shifts, shiftQuery, shiftTypeFilter, shiftDateFilter]);

  const timesheetByEmployee = useMemo(() => {
    const m = new Map<string, TimesheetApprovalRow>();
    for (const a of timesheetApprovals) {
      if (a.period_start === reportSlice.periodStart && a.period_end === reportSlice.periodEnd) {
        m.set(a.employee_id, a);
      }
    }
    return m;
  }, [timesheetApprovals, reportSlice.periodStart, reportSlice.periodEnd]);

  async function onShiftSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setMsg(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createShiftAction({
      tenantId,
      employeeId: String(fd.get("employeeId")),
      shiftDateFrom: String(fd.get("shiftDateFrom")),
      shiftDateTo: String(fd.get("shiftDateTo")),
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
    (e.currentTarget.elements.namedItem("shiftDateFrom") as HTMLInputElement)?.setAttribute(
      "value",
      today,
    );
    (e.currentTarget.elements.namedItem("shiftDateTo") as HTMLInputElement)?.setAttribute(
      "value",
      today,
    );
    router.refresh();
    showMsg("Shift saved.");
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
    showMsg("Punch recorded.");
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

  function shiftDateLabel(r: HrmsShiftRow): string {
    const end = r.shift_date_to ?? r.shift_date;
    return r.shift_date === end ? r.shift_date : `${r.shift_date} → ${end}`;
  }

  async function onCopyPriorWeekSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    const fd = new FormData(e.currentTarget);
    const mon = String(fd.get("targetMonday") ?? "").trim();
    if (!mon) {
      showMsg("Choose the Monday of the week you want to fill.");
      return;
    }
    setCopyWeekLoading(true);
    setMsg(null);
    const res = await copyPriorWeekShiftsAction({ tenantId, targetWeekMondayIso: mon });
    setCopyWeekLoading(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    router.refresh();
    showMsg(`Copied ${res.data?.created ?? 0} shift row(s) into that week.`);
  }

  async function onDepartmentBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    const fd = new FormData(e.currentTarget);
    setDeptBulkLoading(true);
    setMsg(null);
    const res = await createShiftsForDepartmentAction({
      tenantId,
      departmentId: String(fd.get("departmentId")),
      shiftDateFrom: String(fd.get("shiftDateFrom")),
      shiftDateTo: String(fd.get("shiftDateTo")),
      startTime: String(fd.get("startTime")),
      endTime: String(fd.get("endTime")),
      shiftType: String(fd.get("shiftType") ?? "") || null,
    });
    setDeptBulkLoading(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    router.refresh();
    showMsg(`Created ${res.data?.created ?? 0} shift(s) for that department.`);
  }

  async function onTimesheetDecision(employeeId: string, status: "approved" | "rejected") {
    if (!canManage) return;
    setApprovalKey(`${employeeId}-${status}`);
    setMsg(null);
    const res = await upsertTimesheetApprovalAction({
      tenantId,
      employeeId,
      periodStart: reportSlice.periodStart,
      periodEnd: reportSlice.periodEnd,
      status,
    });
    setApprovalKey(null);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    router.refresh();
    showMsg(status === "approved" ? "Timesheet marked approved." : "Timesheet rejected.");
  }

  const tabs = (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {(
        [
          ["dashboard", "Dashboard"],
          ["overview", "Overview"],
          ["shifts", "Shifts"],
          ["attendance", "Attendance"],
          ["reports", "Reports"],
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

      {tab === "dashboard" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Real-time attendance</CardTitle>
              <CardDescription>
                Filter by UTC date, search the roster, and page results. Status uses punches on that calendar
                day (UTC midnight to midnight). For night shifts attributed to a “work day,” see Overview
                (business-day rollup).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-auto">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="text-xs text-zinc-400">
                  Date (UTC)
                  <Input
                    className="mt-1 h-10 w-full min-w-[10rem] font-mono sm:w-auto"
                    type="date"
                    value={dashboardDate}
                    onChange={(e) => {
                      setDashboardDate(e.target.value);
                      setDashboardPage(1);
                    }}
                  />
                </label>
                <Input
                  placeholder="Search name or department…"
                  value={dashboardQuery}
                  onChange={(e) => {
                    setDashboardQuery(e.target.value);
                    setDashboardPage(1);
                  }}
                  className="max-w-md"
                  aria-label="Search attendance list"
                />
              </div>
              {dashboardEmployeesError ? (
                <p className="text-sm text-red-300">{dashboardEmployeesError}</p>
              ) : attendanceRangeError ? (
                <p className="text-sm text-amber-200/90">
                  Punch range failed to load: {attendanceRangeError}
                </p>
              ) : dashboardEmployees.length === 0 ? (
                <p className="text-sm text-zinc-500">No active employees for this property.</p>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-zinc-500">
                      <th className="pb-3 font-medium">Employee</th>
                      <th className="pb-3 font-medium">Department</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Last punch</th>
                      <th className="pb-3 font-medium text-right">Follow up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(dashboardFiltered.length / dashboardPageSize));
                      const pageSafe = Math.min(Math.max(1, dashboardPage), totalPages);
                      const offset = (pageSafe - 1) * dashboardPageSize;
                      const paged = dashboardFiltered.slice(offset, offset + dashboardPageSize);
                      return paged.map((r) => (
                        <tr key={r.id} className="border-b border-border/60">
                          <td className="py-3 font-medium text-white">{r.full_name}</td>
                          <td className="py-3 text-zinc-400">{r.department}</td>
                          <td className="py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${presenceBadgeClass(r.status)}`}
                            >
                              {formatPresenceLabel(r.status)}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-xs text-zinc-300">
                            {r.lastAt ? new Date(r.lastAt).toLocaleString() : "—"}
                          </td>
                          <td className="py-3 text-right">
                            {r.status === "absent" ? (
                              <div className="inline-flex justify-end gap-2">
                                {r.email ? (
                                  <a
                                    href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent("Attendance follow-up")}`}
                                    className="inline-flex rounded-lg border border-border/60 p-1.5 text-zinc-300 hover:border-gold/40 hover:text-white"
                                    title="Message"
                                    aria-label="Send email"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <span
                                    className="inline-flex cursor-not-allowed rounded-lg border border-border/30 p-1.5 text-zinc-600"
                                    title="No email on file"
                                    aria-label="No email"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </span>
                                )}
                                {r.phone ? (
                                  <a
                                    href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}
                                    className="inline-flex rounded-lg border border-border/60 p-1.5 text-zinc-300 hover:border-gold/40 hover:text-white"
                                    title="Call"
                                    aria-label="Call employee"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <span
                                    className="inline-flex cursor-not-allowed rounded-lg border border-border/30 p-1.5 text-zinc-600"
                                    title="No phone on file"
                                    aria-label="No phone"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              )}
              <ListPagination
                itemLabel="employees"
                totalItems={dashboardRows.length}
                filteredItems={dashboardFiltered.length}
                page={Math.min(
                  Math.max(1, dashboardPage),
                  Math.max(1, Math.ceil(Math.max(1, dashboardFiltered.length) / dashboardPageSize)),
                )}
                pageSize={dashboardPageSize}
                totalPages={Math.max(
                  1,
                  Math.ceil(Math.max(1, dashboardFiltered.length) / dashboardPageSize),
                )}
                onPageChange={setDashboardPage}
                onPageSizeChange={(next) => {
                  setDashboardPageSize(next);
                  setDashboardPage(1);
                }}
              />
              <p className="text-xs text-zinc-500">
                Showing activity for UTC date{" "}
                <span className="font-mono text-zinc-300">{dashboardDate}</span>. Refresh after new punches.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

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
                <p className="mt-1 text-xs text-zinc-500">Business-day totals from loaded punch history</p>
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
              <CardDescription>
                Each row is a hospitality business day (UTC, day starts {DEFAULT_WORK_DAY_BOUNDARY_HOUR_UTC}:00)
                with time from in/out segments minus breaks.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Search user or department…"
                  value={overviewQuery}
                  onChange={(e) => {
                    setOverviewQuery(e.target.value);
                    setOverviewPage(1);
                  }}
                />
                <select
                  className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                  value={overviewStatus}
                  onChange={(e) => {
                    setOverviewStatus(
                      e.target.value as "all" | "working" | "on_break" | "clocked_out",
                    );
                    setOverviewPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="working">Working</option>
                  <option value="on_break">On break</option>
                  <option value="clocked_out">Clocked out</option>
                </select>
              </div>
              {attendanceOverview.length === 0 ? (
                <p className="text-sm text-zinc-500">No attendance activity to summarize yet.</p>
              ) : (
                <>
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
                      {(() => {
                        const q = overviewQuery.trim().toLowerCase();
                        const filtered = attendanceOverview.filter((row) => {
                          if (overviewStatus !== "all" && row.displayStatus !== overviewStatus) return false;
                          if (!q) return true;
                          return (
                            row.employeeName.toLowerCase().includes(q) ||
                            (row.department || "").toLowerCase().includes(q) ||
                            row.workDate.includes(q)
                          );
                        });
                        const totalPages = Math.max(1, Math.ceil(filtered.length / overviewPageSize));
                        const pageSafe = Math.min(Math.max(1, overviewPage), totalPages);
                        const offset = (pageSafe - 1) * overviewPageSize;
                        const paged = filtered.slice(offset, offset + overviewPageSize);
                        return paged.map((row) => (
                          <tr key={`${row.employeeId}-${row.workDate}`} className="border-b border-border/60">
                            <td className="py-3">
                              <p className="font-medium text-white">{row.employeeName}</p>
                              <p className="text-xs text-zinc-500">{row.department || "—"}</p>
                            </td>
                            <td className="py-3 text-zinc-300">{formatDate(row.workDate)}</td>
                            <td className="py-3 font-medium text-white">{formatDuration(row.totalMs)}</td>
                            <td className="py-3">
                              <p className="font-mono text-xs text-zinc-300">{new Date(row.latestPunchAt).toLocaleString()}</p>
                              <p className="text-xs capitalize text-zinc-500">{formatPunchTypeLabel(row.latestPunchType)}</p>
                            </td>
                            <td className="py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                  row.displayStatus === "working"
                                    ? "bg-emerald-500/15 text-emerald-200"
                                    : row.displayStatus === "on_break"
                                      ? "bg-amber-500/15 text-amber-100"
                                      : "bg-zinc-500/15 text-zinc-300"
                                }`}
                              >
                                {overviewRowLabel(row.latestPunchType)}
                              </span>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                  <div className="mt-3">
                    <ListPagination
                      itemLabel="rows"
                      totalItems={attendanceOverview.length}
                      filteredItems={attendanceOverview.filter((row) => {
                        const q = overviewQuery.trim().toLowerCase();
                        if (overviewStatus !== "all" && row.displayStatus !== overviewStatus) return false;
                        if (!q) return true;
                        return (
                          row.employeeName.toLowerCase().includes(q) ||
                          (row.department || "").toLowerCase().includes(q) ||
                          row.workDate.includes(q)
                        );
                      }).length}
                      page={Math.min(
                        Math.max(1, overviewPage),
                        Math.max(
                          1,
                          Math.ceil(
                            attendanceOverview.filter((row) => {
                              const q = overviewQuery.trim().toLowerCase();
                              if (overviewStatus !== "all" && row.displayStatus !== overviewStatus)
                                return false;
                              if (!q) return true;
                              return (
                                row.employeeName.toLowerCase().includes(q) ||
                                (row.department || "").toLowerCase().includes(q) ||
                                row.workDate.includes(q)
                              );
                            }).length / overviewPageSize,
                          ),
                        ),
                      )}
                      pageSize={overviewPageSize}
                      totalPages={Math.max(
                        1,
                        Math.ceil(
                          attendanceOverview.filter((row) => {
                            const q = overviewQuery.trim().toLowerCase();
                            if (overviewStatus !== "all" && row.displayStatus !== overviewStatus)
                              return false;
                            if (!q) return true;
                            return (
                              row.employeeName.toLowerCase().includes(q) ||
                              (row.department || "").toLowerCase().includes(q) ||
                              row.workDate.includes(q)
                            );
                          }).length / overviewPageSize,
                        ),
                      )}
                      onPageChange={setOverviewPage}
                      onPageSizeChange={(next) => {
                        setOverviewPageSize(next);
                        setOverviewPage(1);
                      }}
                    />
                  </div>
                </>
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
            <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add shift</CardTitle>
                <CardDescription>
                  Schedule by date range (from / to) with morning, afternoon, or night shift type.
                </CardDescription>
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
                    From
                    <Input className="mt-1" name="shiftDateFrom" type="date" required defaultValue={today} />
                  </label>
                  <label className="text-xs text-zinc-400">
                    To
                    <Input className="mt-1" name="shiftDateTo" type="date" required defaultValue={today} />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Start
                    <Input className="mt-1 font-mono" name="startTime" type="time" required defaultValue="09:00" />
                  </label>
                  <label className="text-xs text-zinc-400">
                    End
                    <Input className="mt-1 font-mono" name="endTime" type="time" required defaultValue="17:00" />
                  </label>
                  <label className="text-xs text-zinc-400 lg:col-span-2">
                    Type
                    <select
                      name="shiftType"
                      required
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                    >
                      <option value="">Select shift type…</option>
                      {SHIFT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end lg:col-span-6">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving…" : "Save shift"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bulk scheduling</CardTitle>
                <CardDescription>
                  Copy last week&apos;s shifts forward, or assign one pattern to an entire department.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <form className="space-y-3" onSubmit={onCopyPriorWeekSubmit}>
                  <p className="text-sm font-medium text-white">Copy previous calendar week</p>
                  <p className="text-xs text-zinc-500">
                    Finds shifts with a start date in the Monday–Sunday before your target week, then inserts
                    copies with all dates moved forward by 7 days.
                  </p>
                  <label className="text-xs text-zinc-400">
                    Target week (Monday, UTC)
                    <Input
                      className="mt-1 font-mono"
                      name="targetMonday"
                      type="date"
                      required
                      defaultValue={weekDatesUtcContaining(today)[0]}
                    />
                  </label>
                  <Button type="submit" disabled={copyWeekLoading} variant="secondary">
                    {copyWeekLoading ? "Copying…" : "Copy into this week"}
                  </Button>
                </form>

                <form className="space-y-3" onSubmit={onDepartmentBulkSubmit}>
                  <p className="text-sm font-medium text-white">Assign to department</p>
                  {departmentsError ? (
                    <p className="text-xs text-amber-200/90">{departmentsError}</p>
                  ) : null}
                  <label className="text-xs text-zinc-400">
                    Department
                    <select
                      name="departmentId"
                      required
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                    >
                      <option value="">Select…</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-zinc-400">
                      From
                      <Input className="mt-1 font-mono" name="shiftDateFrom" type="date" required defaultValue={today} />
                    </label>
                    <label className="text-xs text-zinc-400">
                      To
                      <Input className="mt-1 font-mono" name="shiftDateTo" type="date" required defaultValue={today} />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-zinc-400">
                      Start
                      <Input className="mt-1 font-mono" name="startTime" type="time" required defaultValue="09:00" />
                    </label>
                    <label className="text-xs text-zinc-400">
                      End
                      <Input className="mt-1 font-mono" name="endTime" type="time" required defaultValue="17:00" />
                    </label>
                  </div>
                  <label className="text-xs text-zinc-400">
                    Type
                    <select
                      name="shiftType"
                      required
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                    >
                      <option value="">Select shift type…</option>
                      {SHIFT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" disabled={deptBulkLoading} variant="secondary">
                    {deptBulkLoading ? "Saving…" : "Create for all in dept"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            </>
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
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-zinc-500">
                        <th className="pb-3 font-medium">Employee</th>
                        <th className="pb-3 font-medium">Dates</th>
                        <th className="pb-3 font-medium">Days (UTC)</th>
                        <th className="pb-3 font-medium">Start</th>
                        <th className="pb-3 font-medium">End</th>
                        <th className="pb-3 font-medium">Type</th>
                        {canManage ? <th className="pb-3 text-right font-medium"> </th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalPages = Math.max(1, Math.ceil(shiftListFiltered.length / shiftPageSize));
                        const pageSafe = Math.min(Math.max(1, shiftPage), totalPages);
                        const offset = (pageSafe - 1) * shiftPageSize;
                        const paged = shiftListFiltered.slice(offset, offset + shiftPageSize);
                        return paged.map((r) => (
                          <tr key={r.id} className="border-b border-border/60">
                            <td className="py-3 text-white">{r.employee_label}</td>
                            <td className="py-3">{shiftDateLabel(r)}</td>
                            <td className="py-3 text-xs text-zinc-400">
                              {weekdaysLabelUtc(r.shift_date, r.shift_date_to ?? r.shift_date)}
                            </td>
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
                  filteredItems={shiftListFiltered.length}
                  page={Math.min(
                    Math.max(1, shiftPage),
                    Math.max(1, Math.ceil(Math.max(1, shiftListFiltered.length) / shiftPageSize)),
                  )}
                  pageSize={shiftPageSize}
                  totalPages={Math.max(
                    1,
                    Math.ceil(Math.max(1, shiftListFiltered.length) / shiftPageSize),
                  )}
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

      {tab === "reports" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automated timesheets</CardTitle>
              <CardDescription>
                Daily, weekly, or monthly totals use hospitality business days (UTC, day starts{" "}
                {DEFAULT_WORK_DAY_BOUNDARY_HOUR_UTC}:00). Overtime and late flags compare worked time to the
                scheduled shift (including overnight shifts anchored the previous calendar day).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {timesheetApprovalsError ? (
                <p className="text-sm text-amber-200/90">
                  Timesheet approvals could not be loaded: {timesheetApprovalsError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-zinc-400">
                  Period
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as typeof reportPeriod)}
                    className="mt-1 block h-10 rounded-lg border border-border bg-surface px-3 text-sm"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                </label>
                <label className="text-xs text-zinc-400">
                  Anchor date
                  <Input
                    className="mt-1 w-auto font-mono"
                    type="date"
                    value={reportAnchor}
                    onChange={(e) => setReportAnchor(e.target.value)}
                  />
                </label>
                <p className="text-xs text-zinc-500 pb-1">
                  Range: <span className="text-zinc-300">{reportSlice.label}</span> ({reportSlice.dates.length}{" "}
                  {reportSlice.dates.length === 1 ? "day" : "days"}, UTC)
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-white/[0.03] text-xs uppercase text-zinc-500">
                      <th className="px-3 py-2 font-medium">Employee</th>
                      <th className="px-3 py-2 font-medium">Dept</th>
                      <th className="px-3 py-2 font-medium">Days w/ hours</th>
                      <th className="px-3 py-2 font-medium">Total hours</th>
                      <th className="px-3 py-2 font-medium">Late days</th>
                      <th className="px-3 py-2 font-medium">Overtime (hrs)</th>
                      <th className="px-3 py-2 font-medium">Payroll</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportSlice.rows.map((r) => {
                      const appr = timesheetByEmployee.get(r.employeeId);
                      const busy =
                        approvalKey === `${r.employeeId}-approved` ||
                        approvalKey === `${r.employeeId}-rejected`;
                      return (
                      <tr key={r.employeeId} className="border-b border-border/40">
                        <td className="px-3 py-2.5 font-medium text-white">{r.name}</td>
                        <td className="px-3 py-2.5 text-zinc-400">{r.department}</td>
                        <td className="px-3 py-2.5 text-zinc-300">{r.daysWithWork}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-200">
                          {(r.totalMinutes / 60).toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.lateDays > 0 ? (
                            <span className="text-amber-200">{r.lateDays}</span>
                          ) : (
                            <span className="text-zinc-500">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          {r.overtimeMinutes > 0 ? (
                            <span className="text-rose-200">{(r.overtimeMinutes / 60).toFixed(2)}</span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {appr?.status === "approved" ? (
                            <span className="text-emerald-200">Approved</span>
                          ) : appr?.status === "rejected" ? (
                            <span className="text-rose-200/90">Rejected</span>
                          ) : canManage ? (
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs"
                                disabled={busy}
                                onClick={() => onTimesheetDecision(r.employeeId, "approved")}
                              >
                                {busy && approvalKey === `${r.employeeId}-approved` ? "…" : "Approve"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-rose-200 hover:text-rose-100"
                                disabled={busy}
                                onClick={() => onTimesheetDecision(r.employeeId, "rejected")}
                              >
                                {busy && approvalKey === `${r.employeeId}-rejected` ? "…" : "Reject"}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-zinc-500">Pending</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Card className="border-amber-500/25 bg-amber-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-100">Overtime & late detection</CardTitle>
                  <CardDescription className="text-amber-200/70">
                    Late: first clock-in after scheduled start (+1 min grace). Overtime: worked minutes minus
                    scheduled shift length when a shift exists on that day.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportSlice.exceptions.length === 0 ? (
                    <p className="text-sm text-zinc-500">No late or overtime flags in this period.</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-zinc-200">
                      {reportSlice.exceptions.map((r) => (
                        <li key={r.employeeId} className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border/40 pb-2 last:border-0">
                          <span className="font-medium text-white">{r.name}</span>
                          {r.lateDays > 0 ? (
                            <span className="text-amber-200">Late on {r.lateDays} day(s)</span>
                          ) : null}
                          {r.overtimeMinutes > 0 ? (
                            <span className="text-rose-200">
                              Overtime {(r.overtimeMinutes / 60).toFixed(2)} hrs
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
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
