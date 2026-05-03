import type { HrmsShiftRow } from "@/lib/queries/hrms-extended";

export type PunchLike = { punch_type: string; punched_at: string };

export const SHIFT_TYPE_OPTIONS = [
  "Morning shift",
  "Afternoon Shift",
  "Night Shift",
] as const;

export type PresenceStatus = "in" | "out" | "on_break" | "absent";

/** UTC calendar day bounds for YYYY-MM-DD. */
export function utcDayBounds(dateIso: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(`${dateIso}T00:00:00.000Z`);
  const endMs = Date.parse(`${dateIso}T23:59:59.999Z`);
  return { startMs, endMs };
}

export function punchesOnUtcDay(punches: PunchLike[], dateIso: string): PunchLike[] {
  const { startMs, endMs } = utcDayBounds(dateIso);
  return punches.filter((p) => {
    const t = Date.parse(p.punched_at);
    return t >= startMs && t <= endMs;
  });
}

export function sortPunchesAsc(punches: PunchLike[]): PunchLike[] {
  return [...punches].sort((a, b) => Date.parse(a.punched_at) - Date.parse(b.punched_at));
}

/** Live status from today’s punches (last event wins; break_end implies back on duty). */
export function derivePresenceStatus(sortedTodayAsc: PunchLike[]): PresenceStatus {
  if (sortedTodayAsc.length === 0) return "absent";
  const last = sortedTodayAsc[sortedTodayAsc.length - 1]!;
  const pt = last.punch_type.toLowerCase();
  if (pt === "in") return "in";
  if (pt === "out") return "out";
  if (pt === "break_start") return "on_break";
  if (pt === "break_end") return "in";
  return "absent";
}

function parseTimeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** Scheduled shift length in minutes (handles end before start as overnight). */
export function scheduledShiftMinutes(startTime: string, endTime: string): number {
  let a = parseTimeToMinutes(startTime);
  let b = parseTimeToMinutes(endTime);
  if (b <= a) b += 24 * 60;
  return b - a;
}

export function shiftCoversDate(row: HrmsShiftRow, dateIso: string): boolean {
  const from = row.shift_date;
  const to = row.shift_date_to ?? row.shift_date;
  return dateIso >= from && dateIso <= to;
}

/** First shift row covering this calendar day (stable: earliest start_time). */
export function pickShiftForDay(
  shifts: HrmsShiftRow[],
  employeeId: string,
  dateIso: string,
): HrmsShiftRow | null {
  const candidates = shifts
    .filter((s) => s.employee_id === employeeId && shiftCoversDate(s, dateIso))
    .sort((x, y) => parseTimeToMinutes(x.start_time) - parseTimeToMinutes(y.start_time));
  return candidates[0] ?? null;
}

export function expectedClockInMs(shift: HrmsShiftRow, dateIso: string): number {
  const t = shift.start_time.slice(0, 5);
  return Date.parse(`${dateIso}T${t}:00.000Z`);
}

/** Worked minutes from in/out segments minus completed break intervals (UTC day). */
export function computeWorkedMinutesForDay(sortedDayAsc: PunchLike[]): number {
  const sorted = sortPunchesAsc(sortedDayAsc);
  let segmentMs = 0;
  let openIn: number | null = null;
  let breakOpen: number | null = null;
  let breakMs = 0;

  for (const p of sorted) {
    const t = Date.parse(p.punched_at);
    const pt = p.punch_type.toLowerCase();
    if (pt === "in") {
      openIn = t;
    } else if (pt === "out" && openIn != null) {
      segmentMs += t - openIn;
      openIn = null;
    } else if (pt === "break_start") {
      breakOpen = t;
    } else if (pt === "break_end" && breakOpen != null) {
      breakMs += t - breakOpen;
      breakOpen = null;
    }
  }

  const gross = segmentMs / 60000;
  const breaks = breakMs / 60000;
  return Math.max(0, gross - breaks);
}

export function firstClockInMs(sortedDayAsc: PunchLike[]): number | null {
  const sorted = sortPunchesAsc(sortedDayAsc);
  for (const p of sorted) {
    if (p.punch_type.toLowerCase() === "in") return Date.parse(p.punched_at);
  }
  return null;
}

export function formatPresenceLabel(s: PresenceStatus): string {
  switch (s) {
    case "in":
      return "In";
    case "out":
      return "Out";
    case "on_break":
      return "On Break";
    case "absent":
      return "Absent";
    default:
      return s;
  }
}
