"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createHotelAdminAction } from "./actions";
import { DEFAULT_HOTEL_ADMIN_PASSWORD } from "@/lib/constants/admin";

type TenantOption = { id: string; name: string; slug: string };

export function CreateAdminButton({ tenants }: { tenants: TenantOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEFAULT_HOTEL_ADMIN_PASSWORD);
  const [tenantId, setTenantId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createHotelAdminAction({
      tenantId,
      fullName,
      email,
      password,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFullName("");
    setEmail("");
    setPassword(DEFAULT_HOTEL_ADMIN_PASSWORD);
    setTenantId("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Create admin
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-admin-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-sm text-zinc-500 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
            <h2
              id="create-admin-title"
              className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]"
            >
              Create hotel admin
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Creates a login with the default password (change after first sign-in). Requires a
              unique email per user.
            </p>

            {tenants.length === 0 ? (
              <p className="mt-6 text-sm text-amber-200/90">
                Create a hotel (tenant) first under <strong>Tenants</strong>, then return here to add
                an admin.
              </p>
            ) : null}

            <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Hotel
                </label>
                <select
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className={cn(
                    "flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60",
                  )}
                >
                  <option value="">Select hotel</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Full name
                </label>
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Elena Rodriguez"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Login email
                </label>
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@property.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Password
                </label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={DEFAULT_HOTEL_ADMIN_PASSWORD}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-zinc-600">
                  Default: <span className="font-mono text-zinc-400">{DEFAULT_HOTEL_ADMIN_PASSWORD}</span>
                </p>
              </div>

              {error ? (
                <p className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || tenants.length === 0}>
                  {submitting ? "Creating…" : "Create admin"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
