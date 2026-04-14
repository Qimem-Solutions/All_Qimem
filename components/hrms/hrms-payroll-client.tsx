"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createPayrollRunAction,
  upsertPayrollLineAction,
  updatePayrollRunStatusAction,
} from "@/lib/actions/hrms-modules";
import type { PayrollRunRow, PayrollLineRow } from "@/lib/queries/hrms-extended";

type Props = {
  tenantId: string;
  canManage: boolean;
  runs: PayrollRunRow[];
  linesByRun: Record<string, PayrollLineRow[]>;
  employees: { id: string; full_name: string }[];
};

function toCents(s: string): number {
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function HrmsPayrollClient({ tenantId, canManage, runs, linesByRun, employees }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(runs[0]?.id ?? null);

  const sortedRuns = useMemo(() => [...runs].sort((a, b) => b.period_start.localeCompare(a.period_start)), [runs]);

  async function onRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createPayrollRunAction({
      tenantId,
      periodLabel: String(fd.get("periodLabel")),
      periodStart: String(fd.get("periodStart")),
      periodEnd: String(fd.get("periodEnd")),
      notes: String(fd.get("notes") ?? "") || null,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
    if (res.ok && res.data) setOpenRun(res.data.id);
  }

  async function onLine(e: React.FormEvent<HTMLFormElement>, runId: string) {
    e.preventDefault();
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const gross = toCents(String(fd.get("gross")));
    const ded = toCents(String(fd.get("deductions")));
    const res = await upsertPayrollLineAction({
      tenantId,
      payrollRunId: runId,
      employeeId: String(fd.get("employeeId")),
      grossCents: gross,
      deductionsCents: ded,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function setRunStatus(runId: string, status: "draft" | "processed" | "paid") {
    if (!canManage) return;
    const res = await updatePayrollRunStatusAction({ tenantId, runId, status });
    if (!res.ok) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-8">
      {err ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New payroll run</CardTitle>
            <CardDescription>payroll_runs + payroll_lines (amounts in minor units).</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={onRun}>
              <label className="text-xs text-zinc-400 lg:col-span-2">
                Label
                <Input className="mt-1" name="periodLabel" required placeholder="e.g. March 2026" />
              </label>
              <label className="text-xs text-zinc-400">
                Period start
                <Input className="mt-1" name="periodStart" type="date" required />
              </label>
              <label className="text-xs text-zinc-400">
                Period end
                <Input className="mt-1" name="periodEnd" type="date" required />
              </label>
              <label className="text-xs text-zinc-400 lg:col-span-2">
                Notes
                <Input className="mt-1" name="notes" />
              </label>
              <div className="flex items-end lg:col-span-5">
                <Button type="submit" disabled={loading}>
                  Create run
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-zinc-500">HRMS manage access is required to edit payroll.</p>
      )}

      <div className="space-y-4">
        {sortedRuns.length === 0 ? (
          <p className="text-sm text-zinc-500">No payroll runs yet.</p>
        ) : (
          sortedRuns.map((run) => {
            const lines = linesByRun[run.id] ?? [];
            const isOpen = openRun === run.id;
            return (
              <Card key={run.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{run.period_label}</CardTitle>
                    <CardDescription>
                      {run.period_start} → {run.period_end} · <span className="capitalize">{run.status}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setOpenRun(isOpen ? null : run.id)}>
                      {isOpen ? "Collapse" : "Lines"}
                    </Button>
                    {canManage ? (
                      <>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setRunStatus(run.id, "draft")}>
                          Draft
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setRunStatus(run.id, "processed")}>
                          Processed
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setRunStatus(run.id, "paid")}>
                          Paid
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardHeader>
                {isOpen ? (
                  <CardContent className="space-y-6">
                    {canManage && employees.length > 0 ? (
                      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(ev) => onLine(ev, run.id)}>
                        <label className="text-xs text-zinc-400 lg:col-span-2">
                          Employee
                          <select
                            name="employeeId"
                            required
                            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                          >
                            {employees.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.full_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-zinc-400">
                          Gross ({`$`})
                          <Input className="mt-1" name="gross" type="number" step="0.01" min="0" required placeholder="0.00" />
                        </label>
                        <label className="text-xs text-zinc-400">
                          Deductions ({`$`})
                          <Input className="mt-1" name="deductions" type="number" step="0.01" min="0" placeholder="0.00" />
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
                    {lines.length === 0 ? (
                      <p className="text-sm text-zinc-500">No lines for this run.</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs uppercase text-zinc-500">
                            <th className="pb-2">Employee</th>
                            <th className="pb-2">Gross</th>
                            <th className="pb-2">Deductions</th>
                            <th className="pb-2">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => (
                            <tr key={l.id} className="border-b border-border/60">
                              <td className="py-2 text-white">{l.employee_name ?? "—"}</td>
                              <td className="py-2 font-mono">${(l.gross_cents / 100).toFixed(2)}</td>
                              <td className="py-2 font-mono">${(l.deductions_cents / 100).toFixed(2)}</td>
                              <td className="py-2 font-mono text-gold">${(l.net_cents / 100).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
