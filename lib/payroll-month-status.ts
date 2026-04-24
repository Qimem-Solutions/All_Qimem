import type { PayrollLineRow, PayrollRunRow } from "@/lib/queries/hrms-extended";

export type MonthPayrollStatusKind =
  | "full_month"
  | "paid_variance"
  | "awaiting_payout"
  | "in_draft"
  | "not_in_run";

export type MonthPayrollRow = {
  employeeId: string;
  fullName: string;
  expectedCents: number | null;
  /** From payroll line: gross & deductions. */
  grossCents: number | null;
  deductionsCents: number | null;
  /** Withholding: tax% × gross, rounded. */
  taxCents: number;
  /** Take-home after withholding on gross. */
  netAfterTaxCents: number | null;
  runId: string | null;
  runLabel: string | null;
  runStatus: string | null;
  status: MonthPayrollStatusKind;
};

/**
 * User input: `15` = 15%. Values in (0,1) (e.g. 0.15) are treated as a decimal fraction of 1 → 15%.
 * caps at 100.
 */
export function normalizeWithholdingInput(raw: number): number {
  if (Number.isNaN(raw) || raw < 0) return 0;
  if (raw > 0 && raw < 1) return Math.min(100, raw * 100);
  return Math.min(100, raw);
}

/** Tax = round(gross × taxPercent / 100). Net = gross − tax − deductions. */
export function applyWithholdingOnGross(
  grossCents: number,
  deductionsCents: number,
  taxPercent: number,
): { taxCents: number; netAfterTaxCents: number } {
  const p = Math.max(0, Math.min(100, taxPercent));
  if (grossCents <= 0) return { taxCents: 0, netAfterTaxCents: Math.max(0, -deductionsCents) };
  const taxCents = p <= 0 ? 0 : Math.round((grossCents * p) / 100);
  const net = grossCents - taxCents - deductionsCents;
  return { taxCents, netAfterTaxCents: net };
}

/** When using expected monthly salary as base: same as gross with zero payroll deductions. */
function applyWithholdingOnExpected(
  expectedCents: number,
  taxPercent: number,
): { taxCents: number; netAfterTaxCents: number } {
  return applyWithholdingOnGross(expectedCents, 0, taxPercent);
}

const RUN_PRIORITY: Record<string, number> = {
  paid: 3,
  processed: 2,
  draft: 1,
};

export function firstDayOfCalendarMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m) return "1970-01-01";
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function lastDayOfCalendarMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m) return "1970-01-31";
  const last = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

export function monthInputRange(ym: string): { start: string; end: string } {
  return { start: firstDayOfCalendarMonth(ym), end: lastDayOfCalendarMonth(ym) };
}

/** API may return `2026-04-01` or ISO datetimes; compare as calendar dates. */
function toYmd(d: string): string {
  if (!d) return "";
  const s = d.trim();
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function runOverlapsMonth(run: PayrollRunRow, first: string, last: string): boolean {
  const rs = toYmd(run.period_start);
  const re = toYmd(run.period_end);
  return rs <= last && re >= first;
}

function lineStatus(
  run: PayrollRunRow,
  netForCompareCents: number,
  monthlySalaryCents: number | null,
): MonthPayrollStatusKind {
  if (run.status === "paid") {
    if (monthlySalaryCents == null || monthlySalaryCents <= 0) {
      return netForCompareCents > 0 ? "full_month" : "paid_variance";
    }
    return netForCompareCents + 1 >= monthlySalaryCents ? "full_month" : "paid_variance";
  }
  if (run.status === "processed") return "awaiting_payout";
  return "in_draft";
}

/**
 * For a calendar month, map each employee to their best matching payroll line among runs whose period overlaps that month.
 */
export function computeMonthPayrollRows(
  yearMonth: string,
  runs: PayrollRunRow[],
  linesByRun: Record<string, PayrollLineRow[]>,
  employees: { id: string; full_name: string; monthly_salary_cents: number | null }[],
  taxPercent: number = 0,
): MonthPayrollRow[] {
  const first = firstDayOfCalendarMonth(yearMonth);
  const last = lastDayOfCalendarMonth(yearMonth);
  const overlapping = runs.filter((r) => runOverlapsMonth(r, first, last));

  return employees.map((emp) => {
    let best: {
      run: PayrollRunRow;
      line: PayrollLineRow;
      pri: number;
    } | null = null;

    for (const run of overlapping) {
      const lines = linesByRun[run.id] ?? [];
      const line = lines.find((l) => l.employee_id === emp.id);
      if (!line) continue;
      const pri = RUN_PRIORITY[run.status] ?? 0;
      if (!best || pri > best.pri) {
        best = { run, line, pri };
      } else if (pri === best.pri && run.period_start > best.run.period_start) {
        best = { run, line, pri };
      }
    }

    const exp = emp.monthly_salary_cents;

    if (!best) {
      if (exp != null && exp > 0) {
        const { taxCents, netAfterTaxCents } = applyWithholdingOnExpected(exp, taxPercent);
        return {
          employeeId: emp.id,
          fullName: emp.full_name,
          expectedCents: exp,
          grossCents: null,
          deductionsCents: null,
          taxCents,
          netAfterTaxCents,
          runId: null,
          runLabel: null,
          runStatus: null,
          status: "not_in_run",
        };
      }
      return {
        employeeId: emp.id,
        fullName: emp.full_name,
        expectedCents: exp,
        grossCents: null,
        deductionsCents: null,
        taxCents: 0,
        netAfterTaxCents: null,
        runId: null,
        runLabel: null,
        runStatus: null,
        status: "not_in_run",
      };
    }

    const g = best.line.gross_cents;
    const d = best.line.deductions_cents;
    const useExpected = exp != null && exp > 0;
    const { taxCents, netAfterTaxCents } = useExpected
      ? applyWithholdingOnExpected(exp, taxPercent)
      : applyWithholdingOnGross(g, d, taxPercent);
    const status = lineStatus(best.run, netAfterTaxCents, exp);

    return {
      employeeId: emp.id,
      fullName: emp.full_name,
      expectedCents: exp,
      grossCents: g,
      deductionsCents: d,
      taxCents,
      netAfterTaxCents,
      runId: best.run.id,
      runLabel: best.run.period_label,
      runStatus: best.run.status,
      status,
    };
  });
}

export const MONTH_PAYROLL_STATUS_LABEL: Record<MonthPayrollStatusKind, string> = {
  full_month: "Full month",
  paid_variance: "Paid (short)",
  awaiting_payout: "Processed",
  in_draft: "Draft",
  not_in_run: "Not in payroll",
};

export function monthPayrollBadgeTone(
  status: MonthPayrollStatusKind,
): "gold" | "green" | "red" | "gray" | "orange" {
  switch (status) {
    case "full_month":
      return "green";
    case "paid_variance":
      return "orange";
    case "awaiting_payout":
      return "gold";
    case "in_draft":
      return "gray";
    default:
      return "red";
  }
}
