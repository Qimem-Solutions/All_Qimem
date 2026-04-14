"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, UserMinus } from "lucide-react";
import {
  deleteEmployeeRecordAction,
  setEmployeeInactiveAction,
  updateEmployeeRecordAction,
} from "@/lib/actions/hrms-modules";
import type { EmployeeRow } from "@/components/hrms/employees-directory-client";

const STATUS_OPTIONS = [
  "active",
  "inactive",
  "terminated",
  "probation",
  "on_leave",
  "pending",
] as const;

function normalizeStatus(raw: string | null | undefined): (typeof STATUS_OPTIONS)[number] {
  const s = (raw ?? "active").toLowerCase();
  return (STATUS_OPTIONS as readonly string[]).includes(s)
    ? (s as (typeof STATUS_OPTIONS)[number])
    : "active";
}

type Props = {
  row: EmployeeRow;
  tenantId: string;
  departments: { id: string; name: string }[];
};

export function EmployeeRowActions({ row, tenantId, departments }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (row.kind !== "employee") {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  async function onInactive() {
    if (
      !confirm(
        `Mark ${row.full_name} as inactive? They will stay in the directory with status "inactive".`,
      )
    ) {
      return;
    }
    setError(null);
    const res = await setEmployeeInactiveAction({ tenantId, employeeId: row.id });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function onDelete() {
    if (
      !confirm(
        `Permanently delete ${row.full_name}? This removes shifts, attendance punches, and related rows for this employee. This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    const res = await deleteEmployeeRecordAction({ tenantId, employeeId: row.id });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await updateEmployeeRecordAction({
      tenantId,
      employeeId: row.id,
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? "") || null,
      jobTitle: String(fd.get("jobTitle") ?? "") || null,
      employeeCode: String(fd.get("employeeCode") ?? "") || null,
      hireDate: String(fd.get("hireDate") ?? "") || null,
      departmentId: String(fd.get("departmentId") ?? "") || null,
      status: String(fd.get("status") ?? "active"),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const hireDateValue = row.hire_date ? row.hire_date.slice(0, 10) : "";

  return (
    <div className="flex flex-col items-end gap-1">
      {error && !open ? (
        <p className="max-w-[200px] text-right text-[10px] text-red-400">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-zinc-400 hover:text-white"
          title="Edit"
          aria-label={`Edit ${row.full_name}`}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-zinc-400 hover:text-amber-300"
          title="Mark inactive"
          aria-label={`Mark ${row.full_name} inactive`}
          onClick={onInactive}
        >
          <UserMinus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-zinc-400 hover:text-red-400"
          title="Delete employee"
          aria-label={`Delete ${row.full_name}`}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
          />
          <div
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-[#141416] p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-emp-title"
          >
            <h2 id="edit-emp-title" className="text-lg font-semibold text-white">
              Edit employee
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{row.full_name}</p>
            <form className="mt-6 space-y-4" onSubmit={onSaveEdit}>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`fn-${row.id}`}>
                  Full name
                </label>
                <Input id={`fn-${row.id}`} name="fullName" required defaultValue={row.full_name} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`em-${row.id}`}>
                  Email
                </label>
                <Input id={`em-${row.id}`} name="email" type="email" defaultValue={row.email ?? ""} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`jt-${row.id}`}>
                    Job title
                  </label>
                  <Input id={`jt-${row.id}`} name="jobTitle" defaultValue={row.job_title ?? ""} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`ec-${row.id}`}>
                    Employee code
                  </label>
                  <Input id={`ec-${row.id}`} name="employeeCode" defaultValue={row.employee_code ?? ""} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`hd-${row.id}`}>
                  Hire date
                </label>
                <Input id={`hd-${row.id}`} name="hireDate" type="date" defaultValue={hireDateValue} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`dp-${row.id}`}>
                  Department
                </label>
                <select
                  id={`dp-${row.id}`}
                  name="departmentId"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                  defaultValue={row.department_id ?? ""}
                >
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`st-${row.id}`}>
                  Status
                </label>
                <select
                  id={`st-${row.id}`}
                  name="status"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                  defaultValue={normalizeStatus(row.status)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
