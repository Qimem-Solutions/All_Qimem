"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createStaffUserAction } from "@/lib/actions/hr-staff";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";

const LEVELS: { value: ServiceAccessLevel; label: string }[] = [
  { value: "none", label: "None (no access)" },
  { value: "view", label: "View (read-only)" },
  { value: "manage", label: "Manage (full)" },
];

type Props = {
  departments: { id: string; name: string }[];
};

export function CreateStaffButton({ departments }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hrms, setHrms] = useState<ServiceAccessLevel>("view");
  const [hrrm, setHrrm] = useState<ServiceAccessLevel>("view");
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    const fd = new FormData(form);
    fd.set("hrmsAccess", hrms);
    fd.set("hrrmAccess", hrrm);
    const res = await createStaffUserAction(fd);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setHrms("view");
    setHrrm("view");
    form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Add staff
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close dialog"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-staff-title"
          >
            <h2 id="create-staff-title" className="text-lg font-semibold text-white">
              Create staff & login
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Creates an <strong className="text-zinc-400">employees</strong> row, links a Supabase
              login, and sets HRMS/HRRM access.{" "}
              <strong className="text-zinc-400">None</strong> blocks that app (redirected away);{" "}
              <strong className="text-zinc-400">View</strong> is read-only;{" "}
              <strong className="text-zinc-400">Manage</strong> can change data.
            </p>
            <form
              className="mt-6 space-y-4"
              encType="multipart/form-data"
              onSubmit={onSubmit}
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="fullName">
                  Full name
                </label>
                <Input id="fullName" name="fullName" required autoComplete="name" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="email">
                  Login email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="password">
                  Password (optional)
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Defaults to Staff@123"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/55 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    ) : (
                      <Eye className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="jobTitle">
                  Job title (optional)
                </label>
                <Input id="jobTitle" name="jobTitle" autoComplete="organization-title" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="hireDate">
                    Hire date
                  </label>
                  <Input id="hireDate" name="hireDate" type="date" />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-zinc-400"
                    htmlFor="monthlySalary"
                  >
                    Monthly salary (ETB)
                  </label>
                  <Input
                    id="monthlySalary"
                    name="monthlySalary"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 4500"
                  />
                  <p className="mt-1 text-[10px] text-zinc-600">Shown in directory & payroll views.</p>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="departmentId">
                  Department (optional)
                </label>
                <select
                  id="departmentId"
                  name="departmentId"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                  defaultValue=""
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
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="photo">
                  Photo (optional)
                </label>
                <Input
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
                />
                <p className="mt-1 text-[10px] text-zinc-600">JPEG, PNG, or WebP · up to 5 MB.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="hrms">
                    HRMS access
                  </label>
                  <select
                    id="hrms"
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                    value={hrms}
                    onChange={(ev) => setHrms(ev.target.value as ServiceAccessLevel)}
                  >
                    {LEVELS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="hrrm">
                    HRRM access
                  </label>
                  <select
                    id="hrrm"
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                    value={hrrm}
                    onChange={(ev) => setHrrm(ev.target.value as ServiceAccessLevel)}
                  >
                    {LEVELS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating…" : "Create staff"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
