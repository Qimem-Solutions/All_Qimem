import type { HrmsShiftRow } from "@/lib/queries/hrms-extended";

export type PunchLike = { punch_type: string; punched_at: string };

export const SHIFT_TYPE_OPTIONS = [
  "Morning shift",
  "Afternoon Shift",
  "Night Shift",
] as const;

/** Hospitality “work day” starts at this UTC hour (default 06:00). Night shifts crossing midnight roll into the day that started at this boundary. */
export const DEFAULT_WORK_DAY_BOUNDARY_HOUR_UTC = 6;

export type PresenceStatus = "in" | "out" | "on_break" | "absent";

/** State after replaying punch sequence (since last completed `out` / session start). */
export type PunchSessionState = "off_duty" | "working" | "on_break";

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

/** Worked minutes from in/out segments minus completed break intervals (single shift slice or UTC day). */
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

/** Slice from last unmatched `in` through last real punch, or null if none. */
export function getOpenShiftSlice(sortedAllAsc: PunchLike[]): PunchLike[] | null {
  const sorted = sortPunchesAsc(sortedAllAsc);
  const stack: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i]!.punch_type.toLowerCase();
    if (pt === "in") stack.push(i);
    else if (pt === "out") stack.pop();
  }
  if (stack.length === 0) return null;
  const start = stack[stack.length - 1]!;
  return sorted.slice(start);
}

/** Close an open segment with synthetic punches at `asOfMs` for minute calculation only. */
export function syntheticCloseOpenShift(openSlice: PunchLike[], asOfMs: number): PunchLike[] {
  const iso = new Date(asOfMs).toISOString();
  if (openSlice.length === 0) return openSlice;
  const out: PunchLike[] = [...openSlice];
  const last = out[out.length - 1]!;
  const lastPt = last.punch_type.toLowerCase();
  if (lastPt === "break_start") {
    out.push({ punch_type: "break_end", punched_at: iso });
  }
  out.push({ punch_type: "out", punched_at: iso });
  return out;
}

/** Calendar date (YYYY-MM-DD) of the “business day” containing this instant in UTC. */
export function utcBusinessDayKey(ms: number, boundaryHourUtc = DEFAULT_WORK_DAY_BOUNDARY_HOUR_UTC): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  const h = d.getUTCHours();
  if (h < boundaryHourUtc) {
    const prev = new Date(Date.UTC(y, mo, day - 1));
    return prev.toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(y, mo, day)).toISOString().slice(0, 10);
}

export function addUtcDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Prefer same-day shift; else overnight shift anchored on the previous calendar day. */
export function pickShiftForBusinessDay(
  shifts: HrmsShiftRow[],
  employeeId: string,
  businessDayKey: string,
): { shift: HrmsShiftRow; clockInDateIso: string } | null {
  const direct = pickShiftForDay(shifts, employeeId, businessDayKey);
  if (direct) return { shift: direct, clockInDateIso: businessDayKey };
  const prevDay = addUtcDaysIso(businessDayKey, -1);
  const prior = pickShiftForDay(shifts, employeeId, prevDay);
  if (prior) return { shift: prior, clockInDateIso: prevDay };
  return null;
}

/** Pair each `in` with the next `out` (LIFO) so cross-midnight shifts stay one segment. */
export function extractInOutSegments(sortedAllAsc: PunchLike[]): PunchLike[][] {
  const sorted = sortPunchesAsc(sortedAllAsc);
  const stack: number[] = [];
  const segments: PunchLike[][] = [];
  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i]!.punch_type.toLowerCase();
    if (pt === "in") stack.push(i);
    else if (pt === "out") {
      const start = stack.pop();
      if (start !== undefined) segments.push(sorted.slice(start, i + 1));
    }
  }
  return segments;
}

/** Net worked minutes per business-day key, including open sessions evaluated at `asOfMs`. */
export function workedMinutesPerBusinessDay(
  empPunches: PunchLike[],
  asOfMs: number,
  boundaryHourUtc = DEFAULT_WORK_DAY_BOUNDARY_HOUR_UTC,
): Map<string, number> {
  const map = new Map<string, number>();
  const sorted = sortPunchesAsc(empPunches);
  const closed = extractInOutSegments(sorted);
  for (const seg of closed) {
    const firstIn = seg[0];
    if (!firstIn || firstIn.punch_type.toLowerCase() !== "in") continue;
    const inMs = Date.parse(firstIn.punched_at);
    const key = utcBusinessDayKey(inMs, boundaryHourUtc);
    const net = computeWorkedMinutesForDay(seg);
    map.set(key, (map.get(key) ?? 0) + net);
  }

  const openSlice = getOpenShiftSlice(sorted);
  if (openSlice?.length) {
    const first = openSlice[0];
    if (first && first.punch_type.toLowerCase() === "in") {
      const inMs = Date.parse(first.punched_at);
      const key = utcBusinessDayKey(inMs, boundaryHourUtc);
      const net = computeWorkedMinutesForDay(syntheticCloseOpenShift(openSlice, asOfMs));
      map.set(key, (map.get(key) ?? 0) + net);
    }
  }

  return map;
}

/** Replay punches and return session state suitable for sequential validation. */
export function derivePunchSessionState(sortedAsc: PunchLike[]): PunchSessionState {
  let state: PunchSessionState = "off_duty";
  for (const p of sortPunchesAsc(sortedAsc)) {
    const pt = p.punch_type.toLowerCase();
    if (pt === "in") {
      if (state === "off_duty") state = "working";
    } else if (pt === "out") {
      state = "off_duty";
    } else if (pt === "break_start") {
      if (state === "working") state = "on_break";
    } else if (pt === "break_end") {
      if (state === "on_break") state = "working";
    }
  }
  return state;
}

export function nextPunchAllowed(t: string): PunchSessionState[] {
  const p = t.toLowerCase();
  switch (p) {
    case "in":
      return ["off_duty"];
    case "out":
      return ["working", "on_break"];
    case "break_start":
      return ["working"];
    case "break_end":
      return ["on_break"];
    default:
      return [];
  }
}

/** Earliest clock-in attributed to this business day (closed + open segments). */
export function firstClockInOnBusinessDay(
  empPunches: PunchLike[],
  dayKey: string,
  boundaryHourUtc = DEFAULT_WORK_DAY_BOUNDARY_HOUR_UTC,
): number | null {
  const sorted = sortPunchesAsc(empPunches);
  let best: number | null = null;
  for (const seg of extractInOutSegments(sorted)) {
    const ms = firstClockInMs(seg);
    if (ms == null) continue;
    if (utcBusinessDayKey(ms, boundaryHourUtc) !== dayKey) continue;
    if (best == null || ms < best) best = ms;
  }
  const open = getOpenShiftSlice(sorted);
  if (open?.length) {
    const ms = firstClockInMs(open);
    if (ms != null && utcBusinessDayKey(ms, boundaryHourUtc) === dayKey) {
      if (best == null || ms < best) best = ms;
    }
  }
  return best;
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
