"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createPayrollRunAction,
  loadPayrollBundleAction,
  upsertPayrollLineAction,
  updatePayrollRunStatusAction,
} from "@/lib/actions/hrms-modules";
import type { PayrollRunRow, PayrollLineRow, PayrollEmployeeRow } from "@/lib/queries/hrms-extended";
import { formatMoneyCents } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  applyWithholdingOnGross,
  computeMonthPayrollRows,
  monthInputRange,
  monthPayrollBadgeTone,
  MONTH_PAYROLL_STATUS_LABEL,
  normalizeWithholdingInput,
} from "@/lib/payroll-month-status";

type Props = {
  tenantId: string;
  canManage: boolean;
  runs: PayrollRunRow[];
  linesByRun: Record<string, PayrollLineRow[]>;
  payrollEmployees: PayrollEmployeeRow[];
  defaultYearMonth: string;
};

function toCents(s: string): number {
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Gross field: ETB from monthly_salary_cents (2 decimal places). */
function grossInputFromMonthlySalaryCents(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents) || cents <= 0) return "0.00";
  return (cents / 100).toFixed(2);
}

function monthTitleFromPicker(ym: string): string {
  const [y, m] = ym.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m) return "";
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function HrmsPayrollClient({
  tenantId,
  canManage,
  runs,
  linesByRun,
  payrollEmployees,
  defaultYearMonth,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(runs[0]?.id ?? null);
  const [viewMonth, setViewMonth] = useState(defaultYearMonth);
  const [withholdingPct, setWithholdingPct] = useState("0");
  const [dataOverride, setDataOverride] = useState<{
    runs: PayrollRunRow[];
    linesByRun: Record<string, PayrollLineRow[]>;
  } | null>(null);
  const [runsTab, setRunsTab] = useState<"pending" | "paid">("pending");
  const [newRunEmployeeId, setNewRunEmployeeId] = useState("");
  /** Draft for “Save line” per run: gross auto-filled from expected monthly salary when employee changes. */
  const [lineFormByRunId, setLineFormByRunId] = useState<
    Record<string, { employeeId: string; gross: string; deductions: string; deductionReason: string }>
  >({});

  const [empSearch, setEmpSearch] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState("all");
  const [empPage, setEmpPage] = useState(1);
  const [empPageSize, setEmpPageSize] = useState(10);

  // per-run lines search/pagination maps
  const [linesQueryMap, setLinesQueryMap] = useState<Record<string, string>>({});
  const [linesPageMap, setLinesPageMap] = useState<Record<string, number>>({});
  const [linesPageSizeMap, setLinesPageSizeMap] = useState<Record<string, number>>({});

  const setLinesQueryFor = (runId: string, q: string) => {
    setLinesQueryMap((s) => ({ ...s, [runId]: q }));
    setLinesPageMap((p) => ({ ...p, [runId]: 1 }));
  };
  const setLinesPageFor = (runId: string, page: number) => setLinesPageMap((p) => ({ ...p, [runId]: page }));
  const setLinesPageSizeFor = (runId: string, size: number) => {
    setLinesPageSizeMap((m) => ({ ...m, [runId]: size }));
    setLinesPageMap((p) => ({ ...p, [runId]: 1 }));
  };

  useEffect(() => {
    setNewRunEmployeeId("");
    setEmpPage(1);
  }, [viewMonth, empSearch, empStatusFilter]);

  const effRuns = dataOverride?.runs ?? runs;
  const effLinesByRun = dataOverride?.linesByRun ?? linesByRun;

  const taxPercentNum = useMemo(() => {
    return normalizeWithholdingInput(Number.parseFloat(withholdingPct));
  }, [withholdingPct]);

  const sortedRuns = useMemo(
    () =>
      [...effRuns].sort((a, b) =>
        String(b.period_start).slice(0, 10).localeCompare(String(a.period_start).slice(0, 10)),
      ),
    [effRuns],
  );

  const pendingRuns = useMemo(
    () => sortedRuns.filter((r) => r.status === "draft" || r.status === "processed"),
    [sortedRuns],
  );
  const paidRuns = useMemo(() => sortedRuns.filter((r) => r.status === "paid"), [sortedRuns]);
  const displayedRuns = runsTab === "pending" ? pendingRuns : paidRuns;

  const monthRows = useMemo(
    () => computeMonthPayrollRows(viewMonth, effRuns, effLinesByRun, payrollEmployees, taxPercentNum),
    [viewMonth, effRuns, effLinesByRun, payrollEmployees, taxPercentNum],
  );

  const empFiltered = useMemo(() => {
    let result = monthRows;
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      result = result.filter((r) => r.fullName.toLowerCase().includes(q));
    }
    if (empStatusFilter !== "all") {
      result = result.filter((r) => r.status === empStatusFilter);
    }
    return result;
  }, [monthRows, empSearch, empStatusFilter]);

  const empTotalPages = Math.max(1, Math.ceil(empFiltered.length / empPageSize));
  const empPaged = useMemo(() => {
    const start = (empPage - 1) * empPageSize;
    return empFiltered.slice(start, start + empPageSize);
  }, [empFiltered, empPage, empPageSize]);

  async function refreshPayrollData() {
    const res = await loadPayrollBundleAction(tenantId);
    if (res.ok) {
      setDataOverride({ runs: res.runs, linesByRun: res.linesByRun });
    }
    await router.refresh();
  }

  const totalTaxCents = useMemo(() => monthRows.reduce((acc, r) => acc + r.taxCents, 0), [monthRows]);

  const newRunDefaults = useMemo(() => {
    const { start, end } = monthInputRange(viewMonth);
    return { periodStart: start, periodEnd: end, periodLabel: monthTitleFromPicker(viewMonth) };
  }, [viewMonth]);

  const newRunPreview = useMemo(() => {
    if (!newRunEmployeeId) {
      return { taxCents: 0, netAfterTaxCents: null as number | null };
    }
    const emp = payrollEmployees.find((e) => e.id === newRunEmployeeId);
    if (!emp || emp.monthly_salary_cents == null || emp.monthly_salary_cents <= 0) {
      return { taxCents: 0, netAfterTaxCents: null as number | null };
    }
    return applyWithholdingOnGross(emp.monthly_salary_cents, 0, taxPercentNum);
  }, [newRunEmployeeId, payrollEmployees, taxPercentNum]);

  async function onRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData(form);
    const firstId = (newRunEmployeeId || String(fd.get("initialEmployeeId") ?? "")).trim();
    if (!firstId) {
      setErr("Select an employee — the run must be tied to at least one person.");
      setLoading(false);
      return;
    }
    const res = await createPayrollRunAction({
      tenantId,
      periodLabel: String(fd.get("periodLabel")),
      periodStart: String(fd.get("periodStart")),
      periodEnd: String(fd.get("periodEnd")),
      notes: null,
      employeeIds: [firstId],
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    if (res.data) setOpenRun(res.data.id);
    setNewRunEmployeeId("");
    form.reset();
    await refreshPayrollData();
  }

  async function onLine(runId: string) {
    if (!canManage) return;
    const draft = lineFormByRunId[runId];
    if (!draft?.employeeId) {
      setErr("Select an employee.");
      return;
    }
    setErr(null);
    setLoading(true);
    const gross = toCents(draft.gross);
    const ded = toCents(draft.deductions);
    const dedReason = (draft.deductionReason ?? "").trim();
    const res = await upsertPayrollLineAction({
      tenantId,
      payrollRunId: runId,
      employeeId: draft.employeeId,
      grossCents: gross,
      deductionsCents: ded,
      deductionReason: dedReason,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setLineFormByRunId((prev) => {
      const next = { ...prev };
      delete next[runId];
      return next;
    });
    await refreshPayrollData();
  }

  async function setRunStatus(runId: string, status: "draft" | "processed" | "paid") {
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const res = await updatePayrollRunStatusAction({ tenantId, runId, status });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    if (status === "paid") {
      setRunsTab("paid");
      setOpenRun((current) => (current === runId ? null : current));
    }
    await refreshPayrollData();
  }

  return (
    <div className="space-y-8">
      {err ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly salary & payment status</CardTitle>
          <CardDescription>
            Withholding uses the same % for everyone. If an employee has an <span className="text-zinc-300">expected monthly salary</span>, tax
            and net are calculated from that (net = expected − tax). If not, values come from the payroll line (gross − tax − deductions).{" "}
            A payroll run’s dates must <span className="text-zinc-200">include</span> the month you select. <span className="text-zinc-200">Run</span> marks
            the run <span className="text-zinc-300">paid</span> or scrolls to create a run when the employee is not on a run yet. Enter <span className="text-zinc-200">15</span> for 15%, or
            <span className="text-zinc-200"> 0.15</span> for 15% as a decimal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4 border-b border-border pb-4">
            <label className="block text-xs text-zinc-400">
              Month
              <input
                type="month"
                className="mt-1 h-10 w-full min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-white"
                value={viewMonth}
                onChange={(e) => setViewMonth(e.target.value)}
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Withholding tax (%)
              <Input
                className="mt-1 w-28 font-mono"
                type="number"
                min={0}
                step={0.01}
                value={withholdingPct}
                onChange={(e) => setWithholdingPct(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Search employees
              <Input
                className="mt-1 w-48 sm:w-64"
                placeholder="Search by name..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Status
              <select
                className="mt-1 h-10 min-w-[120px] rounded-lg border border-border bg-surface px-3 text-sm text-white"
                value={empStatusFilter}
                onChange={(e) => setEmpStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {Object.entries(MONTH_PAYROLL_STATUS_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>
            <p className="min-w-0 pb-2.5 text-sm text-zinc-400">
              <span className="text-zinc-500">Total tax:</span>{" "}
              <span className="font-mono text-gold">{formatMoneyCents(totalTaxCents)}</span>
            </p>
          </div>
          {payrollEmployees.length === 0 ? (
            <p className="text-sm text-zinc-500">Add employees in HRMS to see this list.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-zinc-500">
                      <th className="pb-2 pr-2">Employee</th>
                      <th className="pb-2 pr-2">Expected / mo</th>
                      <th className="pb-2 pr-2">Tax</th>
                      <th className="pb-2 pr-2">Net in month</th>
                      <th className="pb-2 pr-2">Run</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empPaged.map((row) => (
                      <tr key={row.employeeId} className="border-b border-border/60">
                        <td className="py-2.5 pr-2 text-white">{row.fullName}</td>
                        <td className="py-2.5 pr-2 font-mono text-zinc-300">{formatMoneyCents(row.expectedCents)}</td>
                        <td className="py-2.5 pr-2 font-mono text-zinc-400">
                          {row.netAfterTaxCents != null ? formatMoneyCents(row.taxCents) : "—"}
                        </td>
                        <td className="py-2.5 pr-2 font-mono text-gold">{formatMoneyCents(row.netAfterTaxCents)}</td>
                        <td className="py-2.5 pr-2">
                          {canManage ? (
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                              {row.runLabel ? <span className="text-xs text-zinc-500">{row.runLabel}</span> : null}
                              {!row.runId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={loading}
                                  onClick={() => {
                                    setNewRunEmployeeId(row.employeeId);
                                    document
                                      .getElementById("hrms-new-payroll-run")
                                      ?.scrollIntoView({ behavior: "smooth" });
                                  }}
                                >
                                  Run
                                </Button>
                              ) : row.runStatus === "paid" ? (
                                <span className="text-sm font-medium text-emerald-400">Paid</span>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={loading}
                                  onClick={() => row.runId && setRunStatus(row.runId, "paid")}
                                >
                                  Run
                                </Button>
                              )}
                            </div>
                          ) : row.runId ? (
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                              {row.runLabel ? <span className="text-xs text-zinc-500">{row.runLabel}</span> : null}
                              {row.runStatus === "paid" ? (
                                <span className="text-sm font-medium text-emerald-400">Paid</span>
                              ) : (
                                <span className="text-xs capitalize text-zinc-500">{row.runStatus ?? "—"}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <Badge tone={monthPayrollBadgeTone(row.status)}>{MONTH_PAYROLL_STATUS_LABEL[row.status]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ListPagination
                itemLabel="employees"
                totalItems={monthRows.length}
                filteredItems={empFiltered.length}
                page={empPage}
                pageSize={empPageSize}
                totalPages={empTotalPages}
                onPageChange={setEmpPage}
                onPageSizeChange={setEmpPageSize}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card id="hrms-new-payroll-run">
          <CardHeader>
            <CardTitle className="text-base">New payroll run</CardTitle>
            <CardDescription>
              Net salary and tax use the <span className="text-zinc-300">Withholding tax %</span> from the table above, same as the monthly list. A payroll line
              is created with gross = expected monthly salary when set. Open <span className="text-zinc-300">Lines</span> after creating to add more people. Use
              <span className="text-zinc-300"> Run</span> on a row to jump here with that person selected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payrollEmployees.length === 0 ? (
              <p className="text-sm text-zinc-500">Add employees in HRMS before creating a payroll run.</p>
            ) : (
              <form
                key={viewMonth}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
                onSubmit={onRun}
              >
                <label className="text-xs text-zinc-400 lg:col-span-2">
                  Label
                  <Input
                    className="mt-1"
                    name="periodLabel"
                    required
                    placeholder="e.g. March 2026"
                    defaultValue={newRunDefaults.periodLabel}
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Period start
                  <Input
                    className="mt-1"
                    name="periodStart"
                    type="date"
                    required
                    defaultValue={newRunDefaults.periodStart}
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Period end
                  <Input
                    className="mt-1"
                    name="periodEnd"
                    type="date"
                    required
                    defaultValue={newRunDefaults.periodEnd}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2">
                  <div>
                    <p className="text-xs text-zinc-400">Net salary (ETB)</p>
                    <p className="mt-1 font-mono text-sm text-gold">
                      {newRunPreview.netAfterTaxCents != null
                        ? formatMoneyCents(newRunPreview.netAfterTaxCents)
                        : "—"}
                    </p>
                    {newRunEmployeeId && newRunPreview.netAfterTaxCents == null ? (
                      <p className="mt-0.5 text-xs text-zinc-500">Set expected monthly salary in HR to preview.</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Taxed value (ETB)</p>
                    <p className="mt-1 font-mono text-sm text-zinc-300">
                      {newRunPreview.netAfterTaxCents != null ? formatMoneyCents(newRunPreview.taxCents) : "—"}
                    </p>
                  </div>
                </div>
                <label className="text-xs text-zinc-400 lg:col-span-2">
                  Employee
                  <select
                    name="initialEmployeeId"
                    required
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-white"
                    value={newRunEmployeeId}
                    onChange={(e) => setNewRunEmployeeId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select employee…
                    </option>
                    {payrollEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end lg:col-span-5">
                  <Button type="submit" disabled={loading}>
                    Create run
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-zinc-500">HRMS manage access is required to edit payroll.</p>
      )}

      <div className="space-y-4">
        {sortedRuns.length === 0 ? (
          <p className="text-sm text-zinc-500">No payroll runs yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1 border-b border-border">

              <button
                type="button"
                onClick={() => {
                  setRunsTab("pending");
                  setOpenRun(null);
                }}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${runsTab === "pending"
                  ? "border-gold text-gold"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                Pending (Draft) <span className="text-xs font-normal text-zinc-500">({pendingRuns.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRunsTab("paid");
                  setOpenRun(null);
                }}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${runsTab === "paid"
                  ? "border-gold text-gold"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                Paid
                <span className="ml-1.5 text-xs text-zinc-500">({paidRuns.length})</span>
              </button>
            </div>

            {displayedRuns.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {runsTab === "pending" ? "No pending payroll runs — payment in progress will appear here." : "No paid payroll runs yet."}
              </p>
            ) : null}

            {displayedRuns.map((run) => {
              const lines = effLinesByRun[run.id] ?? [];
              const isOpen = openRun === run.id;
              const isPendingRun = run.status === "draft" || run.status === "processed";
              const firstEmpId = payrollEmployees[0]?.id ?? "";
              const lineDraft = lineFormByRunId[run.id];
              const lineEmployeeId = lineDraft?.employeeId ?? firstEmpId;
              const salaryCents = payrollEmployees.find((e) => e.id === lineEmployeeId)?.monthly_salary_cents;
              const lineGrossDisplayed =
                lineDraft?.gross ?? grossInputFromMonthlySalaryCents(salaryCents);
              const lineDeductionsDisplayed = lineDraft?.deductions ?? "0.00";
              const lineDeductionReasonDisplayed = lineDraft?.deductionReason ?? "";
              return (
                <Card key={run.id}>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{run.period_label}</CardTitle>
                      <CardDescription>
                        {String(run.period_start).slice(0, 10)} → {String(run.period_end).slice(0, 10)}
                        {isPendingRun ? (
                          <span className="ml-2">
                            <Badge tone={run.status === "processed" ? "gold" : "gray"}>
                              {run.status === "processed" ? "In progress" : "Draft"}
                            </Badge>
                          </span>
                        ) : (
                          <span className="ml-2">
                            <Badge tone="green">Paid</Badge>
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setOpenRun(isOpen ? null : run.id)}>
                        {isOpen ? "Collapse" : "Lines"}
                      </Button>
                      {canManage && isPendingRun ? (
                        <Button type="button" size="sm" onClick={() => setRunStatus(run.id, "paid")} disabled={loading}>
                          Mark paid
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  {isOpen ? (
                    <CardContent className="space-y-6">
                      {canManage && payrollEmployees.length > 0 ? (
                        <form
                          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-8"
                          onSubmit={(ev) => {
                            ev.preventDefault();
                            void onLine(run.id);
                          }}
                        >
                          <label className="text-xs text-zinc-400 lg:col-span-2">
                            Employee
                            <select
                              required
                              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                              value={lineEmployeeId}
                              onChange={(e) => {
                                const id = e.target.value;
                                const emp = payrollEmployees.find((x) => x.id === id);
                                setLineFormByRunId((prev) => ({
                                  ...prev,
                                  [run.id]: {
                                    employeeId: id,
                                    gross: grossInputFromMonthlySalaryCents(emp?.monthly_salary_cents),
                                    deductions: prev[run.id]?.deductions ?? "0.00",
                                    deductionReason: prev[run.id]?.deductionReason ?? "",
                                  },
                                }));
                              }}
                            >
                              {payrollEmployees.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.full_name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs text-zinc-400">
                            Gross (ETB)
                            <Input
                              className="mt-1"
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={lineGrossDisplayed}
                              onChange={(e) =>
                                setLineFormByRunId((prev) => ({
                                  ...prev,
                                  [run.id]: {
                                    employeeId: lineEmployeeId,
                                    gross: e.target.value,
                                    deductions: prev[run.id]?.deductions ?? lineDeductionsDisplayed,
                                    deductionReason: prev[run.id]?.deductionReason ?? lineDeductionReasonDisplayed,
                                  },
                                }))
                              }
                              placeholder="0.00"
                            />
                          </label>
                          <label className="text-xs text-zinc-400">
                            Deductions (ETB)
                            <Input
                              className="mt-1"
                              type="number"
                              step="0.01"
                              min="0"
                              value={lineDeductionsDisplayed}
                              onChange={(e) =>
                                setLineFormByRunId((prev) => ({
                                  ...prev,
                                  [run.id]: {
                                    employeeId: lineEmployeeId,
                                    gross: prev[run.id]?.gross ?? lineGrossDisplayed,
                                    deductions: e.target.value,
                                    deductionReason: prev[run.id]?.deductionReason ?? lineDeductionReasonDisplayed,
                                  },
                                }))
                              }
                              placeholder="0.00"
                            />
                          </label>
                          <label className="text-xs text-zinc-400 lg:col-span-2">
                            Deduction reason (optional)
                            <Input
                              className="mt-1"
                              type="text"
                              value={lineDeductionReasonDisplayed}
                              onChange={(e) =>
                                setLineFormByRunId((prev) => ({
                                  ...prev,
                                  [run.id]: {
                                    employeeId: lineEmployeeId,
                                    gross: prev[run.id]?.gross ?? lineGrossDisplayed,
                                    deductions: prev[run.id]?.deductions ?? lineDeductionsDisplayed,
                                    deductionReason: e.target.value,
                                  },
                                }))
                              }
                              placeholder="e.g. Tax, penalty"
                            />
                          </label>
                          <div className="flex items-end lg:col-span-2">
                            <Button type="submit" disabled={loading}>
                              Save line
                            </Button>
                          </div>
                        </form>
                      ) : canManage ? (
                        <p className="text-sm text-zinc-500">Add employees before payroll lines.</p>
                      ) : null}
                      {(() => {
                        const q = (linesQueryMap[run.id] ?? "").trim().toLowerCase();
                        const filtered = lines.filter((l) => {
                          if (!q) return true;
                          return String(l.employee_name ?? "").toLowerCase().includes(q);
                        });
                        const page = linesPageMap[run.id] ?? 1;
                        const pageSize = linesPageSizeMap[run.id] ?? 10;
                        const total = filtered.length;
                        const totalPages = Math.max(1, Math.ceil(total / pageSize));
                        const pageSafe = Math.min(Math.max(1, page), totalPages);
                        const paged = filtered.slice((pageSafe - 1) * pageSize, (pageSafe - 1) * pageSize + pageSize);

                        return (
                          <div>
                            <div className="mb-2 flex items-center gap-3">
                              <label className="text-xs text-zinc-400">
                                Search lines
                                <Input
                                  className="mt-1"
                                  placeholder="Search by employee"
                                  value={linesQueryMap[run.id] ?? ""}
                                  onChange={(e) => setLinesQueryFor(run.id, e.target.value)}
                                />
                              </label>
                            </div>
                            {lines.length === 0 ? (
                              <p className="text-sm text-zinc-500">No lines for this run.</p>
                            ) : paged.length === 0 ? (
                              <p className="text-sm text-zinc-500">No matching lines.</p>
                            ) : (
                              <>
                                <table className="w-full text-left text-sm">
                                  <thead>
                                    <tr className="border-b border-border text-xs uppercase text-zinc-500">
                                      <th className="pb-2">Employee</th>
                                      <th className="pb-2">Gross</th>
                                      <th className="pb-2">Deductions</th>
                                      <th className="pb-2">Reason</th>
                                      <th className="pb-2">Net</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paged.map((l) => (
                                      <tr key={l.id} className="border-b border-border/60">
                                        <td className="py-2 text-white">{l.employee_name ?? "—"}</td>
                                        <td className="py-2 font-mono">{formatMoneyCents(l.gross_cents)}</td>
                                        <td className="py-2 font-mono">{formatMoneyCents(l.deductions_cents)}</td>
                                        <td className="py-2 text-zinc-400">{l.deduction_reason || "—"}</td>
                                        <td className="py-2 font-mono text-gold">{formatMoneyCents(l.net_cents)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <ListPagination
                                  itemLabel="lines"
                                  totalItems={lines.length}
                                  filteredItems={filtered.length}
                                  page={pageSafe}
                                  pageSize={pageSize}
                                  totalPages={totalPages}
                                  onPageChange={(p) => setLinesPageFor(run.id, p)}
                                  onPageSizeChange={(s) => setLinesPageSizeFor(run.id, s)}
                                />
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
