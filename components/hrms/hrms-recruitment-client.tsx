"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createJobRequisitionAction,
  createJobCandidateAction,
  updateJobRequisitionStatusAction,
  updateJobCandidateStageAction,
} from "@/lib/actions/hrms-modules";
import type { JobRequisitionRow, JobCandidateRow } from "@/lib/queries/hrms-extended";

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

type Props = {
  tenantId: string;
  canManage: boolean;
  requisitions: JobRequisitionRow[];
  candidates: JobCandidateRow[];
  departments: { id: string; name: string }[];
};

export function HrmsRecruitmentClient({ tenantId, canManage, requisitions, candidates, departments }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onReq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createJobRequisitionAction({
      tenantId,
      title: String(fd.get("title")),
      departmentId: String(fd.get("departmentId") ?? "") || null,
      description: String(fd.get("description") ?? "") || null,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function onCand(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await createJobCandidateAction({
      tenantId,
      requisitionId: String(fd.get("requisitionId")),
      fullName: String(fd.get("fullName")),
      email: String(fd.get("email") ?? "") || null,
      phone: String(fd.get("phone") ?? "") || null,
      notes: String(fd.get("notes") ?? "") || null,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function reqStatus(id: string, status: "open" | "paused" | "closed") {
    if (!canManage) return;
    const res = await updateJobRequisitionStatusAction({ tenantId, id, status });
    if (!res.ok) setErr(res.error);
    else router.refresh();
  }

  async function candStage(id: string, stage: string) {
    if (!canManage) return;
    const res = await updateJobCandidateStageAction({ tenantId, candidateId: id, stage });
    if (!res.ok) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-8">
      {err ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New job requisition</CardTitle>
              <CardDescription>job_requisitions</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onReq}>
                <label className="text-xs text-zinc-400">
                  Title
                  <Input className="mt-1" name="title" required placeholder="e.g. Front desk agent" />
                </label>
                <label className="text-xs text-zinc-400">
                  Department (optional)
                  <select
                    name="departmentId"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-400">
                  Description
                  <textarea
                    name="description"
                    className="mt-1 min-h-[80px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <Button type="submit" disabled={loading}>
                  Create requisition
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add candidate</CardTitle>
              <CardDescription>job_candidates</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onCand}>
                <label className="text-xs text-zinc-400">
                  Requisition
                  <select
                    name="requisitionId"
                    required
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                  >
                    <option value="">Select…</option>
                    {requisitions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-400">
                  Full name
                  <Input className="mt-1" name="fullName" required />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-zinc-400">
                    Email
                    <Input className="mt-1" name="email" type="email" />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Phone
                    <Input className="mt-1" name="phone" />
                  </label>
                </div>
                <label className="text-xs text-zinc-400">
                  Notes
                  <Input className="mt-1" name="notes" />
                </label>
                <Button type="submit" disabled={loading}>
                  Add candidate
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">HRMS manage access is required to edit recruitment.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requisitions</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {requisitions.length === 0 ? (
            <p className="text-sm text-zinc-500">None yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-zinc-500">
                  <th className="pb-3">Title</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Status</th>
                  {canManage ? <th className="pb-3"> </th> : null}
                </tr>
              </thead>
              <tbody>
                {requisitions.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-3 text-white">{r.title}</td>
                    <td className="py-3 text-zinc-400">{r.department_name ?? "—"}</td>
                    <td className="py-3 capitalize">{r.status}</td>
                    {canManage ? (
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" size="sm" variant="secondary" onClick={() => reqStatus(r.id, "open")}>
                            Open
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => reqStatus(r.id, "paused")}>
                            Pause
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => reqStatus(r.id, "closed")}>
                            Close
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidates</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {candidates.length === 0 ? (
            <p className="text-sm text-zinc-500">None yet.</p>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-zinc-500">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Stage</th>
                  {canManage ? <th className="pb-3"> </th> : null}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-3 text-white">{c.full_name}</td>
                    <td className="py-3 text-zinc-400">{c.requisition_title ?? "—"}</td>
                    <td className="py-3 text-zinc-500">{c.email ?? "—"}</td>
                    <td className="py-3 capitalize">{c.stage}</td>
                    {canManage ? (
                      <td className="py-3">
                        <select
                          className="h-9 rounded border border-border bg-surface px-2 text-xs"
                          value={c.stage}
                          onChange={(e) => candStage(c.id, e.target.value)}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
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
