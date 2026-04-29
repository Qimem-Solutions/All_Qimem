"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, UserMinus, UserCheck } from "lucide-react";
import {
  deleteEmployeeRecordAction,
  setEmployeeInactiveAction,
  setEmployeeActiveAction,
  updateEmployeeRecordAction,
  uploadEmployeePhotoAction,
} from "@/lib/actions/hrms-modules";
import type { EmployeeRow } from "@/components/hrms/employees-directory-client";
import { employeePhotoSrc } from "@/lib/hrms/employee-photo-url";

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
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<"inactive" | "active" | "delete" | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  if (row.kind !== "employee") {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  const statusLower = (row.status ?? "").toLowerCase();
  const isInactive = statusLower === "inactive";

  function requestInactive() {
    setConfirmError(null);
    setConfirmDialog("inactive");
  }

  function requestActive() {
    setConfirmError(null);
    setConfirmDialog("active");
  }

  async function executeInactive() {
    setConfirmLoading(true);
    setConfirmError(null);
    const res = await setEmployeeInactiveAction({ tenantId, employeeId: row.id });
    setConfirmLoading(false);
    if (!res.ok) {
      setConfirmError(res.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  async function executeActive() {
    setConfirmLoading(true);
    setConfirmError(null);
    const res = await setEmployeeActiveAction({ tenantId, employeeId: row.id });
    setConfirmLoading(false);
    if (!res.ok) {
      setConfirmError(res.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  function requestDelete() {
    setConfirmError(null);
    setConfirmDialog("delete");
  }

  async function executeDelete() {
    setConfirmLoading(true);
    setConfirmError(null);
    const res = await deleteEmployeeRecordAction({ tenantId, employeeId: row.id });
    setConfirmLoading(false);
    if (!res.ok) {
      setConfirmError(res.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  function closeConfirm() {
    if (confirmLoading) return;
    setConfirmDialog(null);
    setConfirmError(null);
  }

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const salaryRaw = String(fd.get("monthlySalary") ?? "").trim();
    let monthlySalaryCents: number | null = null;
    if (salaryRaw.length > 0) {
      const n = Number.parseFloat(salaryRaw);
      if (!Number.isFinite(n) || n < 0) {
        setLoading(false);
        setError("Enter a valid monthly salary (0 or greater), or leave it blank.");
        return;
      }
      monthlySalaryCents = Math.round(n * 100);
    }

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
      monthlySalaryCents,
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
  const salaryDefault =
    row.monthly_salary_cents != null ? (row.monthly_salary_cents / 100).toFixed(2) : "";
  const previewSrc = employeePhotoSrc(row.photo_url);

  async function onPhotoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhotoError(null);
    setPhotoLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await uploadEmployeePhotoAction(null, fd);
    setPhotoLoading(false);
    if (!res.ok) {
      setPhotoError(res.error);
      return;
    }
    router.refresh();
  }

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
          className={
            isInactive
              ? "h-8 px-2 text-zinc-400 hover:text-emerald-400"
              : "h-8 px-2 text-zinc-400 hover:text-amber-300"
          }
          title={isInactive ? "Mark active" : "Mark inactive"}
          aria-label={
            isInactive ? `Mark ${row.full_name} active` : `Mark ${row.full_name} inactive`
          }
          onClick={isInactive ? requestActive : requestInactive}
        >
          {isInactive ? <UserCheck className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-zinc-400 hover:text-red-400"
          title="Delete employee"
          aria-label={`Delete ${row.full_name}`}
          onClick={requestDelete}
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
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-emp-title"
          >
            <h2 id="edit-emp-title" className="text-lg font-semibold text-white">
              Edit employee
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{row.full_name}</p>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/80 bg-black/20 p-4 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-3">
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover ring-2 ring-amber-500/20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-800 text-sm font-semibold text-zinc-400">
                    —
                  </div>
                )}
                <div className="text-xs text-zinc-500">
                  <p className="font-medium text-zinc-400">Profile photo</p>
                  <p>JPEG, PNG, or WebP · max 5 MB</p>
                </div>
              </div>
              <form className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onPhotoSubmit}>
                <input type="hidden" name="tenantId" value={tenantId} />
                <input type="hidden" name="employeeId" value={row.id} />
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor={`photo-${row.id}`}>
                    New photo
                  </label>
                  <input
                    id={`photo-${row.id}`}
                    name="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="w-full cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
                  />
                </div>
                <Button type="submit" size="sm" variant="secondary" disabled={photoLoading}>
                  {photoLoading ? "Uploading…" : "Upload"}
                </Button>
              </form>
            </div>
            {photoError ? (
              <p className="mt-2 text-xs text-red-400">{photoError}</p>
            ) : null}

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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`hd-${row.id}`}>
                    Hire date
                  </label>
                  <Input id={`hd-${row.id}`} name="hireDate" type="date" defaultValue={hireDateValue} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor={`ms-${row.id}`}>
                    Monthly salary (ETB)
                  </label>
                  <Input
                    id={`ms-${row.id}`}
                    name="monthlySalary"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 4500"
                    defaultValue={salaryDefault}
                  />
                </div>
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

      <ConfirmModal
        open={confirmDialog === "inactive"}
        title="Mark inactive"
        description={`Mark ${row.full_name} as inactive? They will stay in the directory with status "inactive".`}
        confirmLabel="Mark inactive"
        destructive
        loading={confirmLoading}
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={executeInactive}
      />
      <ConfirmModal
        open={confirmDialog === "active"}
        title="Mark active"
        description={`Set ${row.full_name} back to active? They will show as active in the directory.`}
        confirmLabel="Mark active"
        loading={confirmLoading}
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={executeActive}
      />
      <ConfirmModal
        open={confirmDialog === "delete"}
        title="Delete employee"
        description={`Permanently delete ${row.full_name}? This removes shifts, attendance punches, and related rows for this employee. This cannot be undone.`}
        confirmLabel="Delete permanently"
        destructive
        loading={confirmLoading}
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={executeDelete}
      />
    </div>
  );
}
