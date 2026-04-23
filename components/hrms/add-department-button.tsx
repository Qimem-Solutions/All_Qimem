"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDepartmentAction } from "@/lib/actions/hr-staff";

export function AddDepartmentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    const fd = new FormData(form);
    const res = await createDepartmentAction({
      name: String(fd.get("name") ?? ""),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        + Add department
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
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-dept-title"
          >
            <h2 id="add-dept-title" className="text-lg font-semibold text-white">
              Add department
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Create a department for your property, then assign staff when you add them.
            </p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="dept-name">
                  Department name
                </label>
                <Input
                  id="dept-name"
                  name="name"
                  required
                  autoComplete="organization"
                  placeholder="e.g. Front Office"
                />
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
                  {loading ? "Saving…" : "Create department"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
