"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    const fd = new FormData(form);
    const res = await createStaffUserAction({
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? "") || undefined,
      jobTitle: String(fd.get("jobTitle") ?? "") || undefined,
      departmentId: String(fd.get("departmentId") ?? "") || null,
      hrmsAccess: hrms,
      hrrmAccess: hrrm,
    });
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
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-[#141416] p-6 shadow-xl"
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
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Defaults to Staff@123"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="jobTitle">
                  Job title (optional)
                </label>
                <Input id="jobTitle" name="jobTitle" autoComplete="organization-title" />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-zinc-400"
                  htmlFor="departmentId"
                >
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
