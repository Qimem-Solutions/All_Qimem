"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLeaveRequestAction, updateLeaveStatusAction } from "@/lib/actions/hrms-modules";
import type { LeaveRequestRow } from "@/lib/queries/hrms-extended";

type Props = {
  tenantId: string;
  canManage: boolean;
  rows: LeaveRequestRow[];
  employees: { id: string; full_name: string }[];
};

const TYPES = ["annual", "sick", "personal", "unpaid", "other"] as const;

export function HrmsLeaveClient({ tenantId, canManage, rows, employees }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createLeaveRequestAction({
      tenantId,
      employeeId: String(fd.get("employeeId")),
      leaveType: String(fd.get("leaveType")),
      startDate: String(fd.get("startDate")),
      endDate: String(fd.get("endDate")),
      reason: String(fd.get("reason") ?? "") || null,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function setStatus(id: string, status: "approved" | "rejected" | "cancelled") {
    if (!canManage) return;
    setErr(null);
    const res = await updateLeaveStatusAction({ tenantId, leaveId: id, status });
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {err ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      {canManage && employees.length === 0 ? (
        <p className="text-sm text-amber-200/90">
          Add employees in the directory before creating leave requests.
        </p>
      ) : null}

      {canManage && employees.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New leave request</CardTitle>
            <CardDescription>Stored in leave_requests (pending until approved).</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={onCreate}>
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
                Type
                <select name="leaveType" className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-400">
                Start
                <Input className="mt-1" name="startDate" type="date" required />
              </label>
              <label className="text-xs text-zinc-400">
                End
                <Input className="mt-1" name="endDate" type="date" required />
              </label>
              <label className="text-xs text-zinc-400 lg:col-span-2">
                Reason (optional)
                <Input className="mt-1" name="reason" placeholder="Notes" />
              </label>
              <div className="flex items-end lg:col-span-6">
                <Button type="submit" disabled={loading}>
                  Submit request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : !canManage ? (
        <p className="text-sm text-zinc-500">HRMS manage access is required to submit or approve leave.</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No leave requests yet.</p>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-zinc-500">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Dates</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Reason</th>
                  {canManage ? <th className="pb-3 font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-3 text-white">{r.employee_name ?? "—"}</td>
                    <td className="py-3 capitalize text-zinc-400">{r.leave_type}</td>
                    <td className="py-3 font-mono text-xs">
                      {r.start_date} → {r.end_date}
                    </td>
                    <td className="py-3 capitalize">{r.status}</td>
                    <td className="py-3 text-zinc-500">{r.reason ?? "—"}</td>
                    {canManage && r.status === "pending" ? (
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" size="sm" variant="secondary" onClick={() => setStatus(r.id, "approved")}>
                            Approve
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(r.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    ) : canManage ? (
                      <td className="py-3 text-zinc-600">—</td>
                    ) : null}
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
