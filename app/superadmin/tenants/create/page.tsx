"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Lock,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createTenantAction } from "../actions";

const steps = [
  { id: 1, label: "Hotel info", key: "hotel" },
  { id: 2, label: "Branding", key: "branding" },
  { id: 3, label: "Confirmation", key: "confirm" },
] as const;

const regions = ["Middle East — GCC", "Europe", "Americas", "Asia Pacific", "Africa"];
const categories = [
  "Luxury resort",
  "Urban business",
  "Boutique",
  "Extended stay",
  "Convention",
];

export default function TenantCreationOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    hotelName: "",
    subdomain: "",
    region: "",
    category: "",
    primaryColor: "#e8c547",
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function next() {
    if (step === 1) {
      if (!form.hotelName.trim() || !form.subdomain.trim()) {
        setActionError("Enter hotel name and subdomain before continuing.");
        return;
      }
    }
    setActionError(null);
    setStep((s) => Math.min(3, s + 1));
  }
  function back() {
    if (step <= 1) {
      router.push("/superadmin/tenants");
      return;
    }
    setStep((s) => s - 1);
  }

  async function completeProvisioning() {
    setActionError(null);
    const name = form.hotelName.trim();
    const slug = form.subdomain.trim();
    if (!name || !slug) {
      setActionError("Go back to step 1 and enter both hotel name and subdomain.");
      return;
    }
    setSubmitting(true);
    const result = await createTenantAction({
      name,
      slug,
      region: form.region || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    router.push("/superadmin/tenants");
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] text-foreground">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
        <div className="mb-10 text-center">
          <p className="text-2xl font-semibold text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            All Qimem
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-400">
            Tenant creation onboarding
          </p>
        </div>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          {steps.map((s) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                      active
                        ? "bg-gold text-gold-foreground"
                        : done
                          ? "bg-emerald-600/30 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : s.id}
                  </span>
                  <span
                    className={cn(
                      "hidden text-sm font-medium sm:inline",
                      active ? "text-gold" : "text-zinc-500",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {s.id < 3 ? (
                  <div
                    className={cn(
                      "hidden h-px w-8 sm:block",
                      step > s.id ? "bg-gold/50" : "bg-zinc-800",
                    )}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-surface-elevated/60 p-6 shadow-xl backdrop-blur-sm sm:p-8">
              {actionError && step !== 3 ? (
                <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                  {actionError}
                </p>
              ) : null}
              {step === 1 && (
                <>
                  <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Hotel identity
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Define the core properties of the new tenant system.
                  </p>
                  <div className="mt-8 space-y-6">
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Hotel name
                      </label>
                      <Input
                        value={form.hotelName}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, hotelName: e.target.value }))
                        }
                        placeholder="Grand Qimem Resort"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Domain access
                      </label>
                      <div className="flex rounded-lg border border-border bg-background overflow-hidden">
                        <input
                          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none"
                          value={form.subdomain}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              subdomain: e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, ""),
                            }))
                          }
                          placeholder="grand-qimem"
                          aria-label="Subdomain"
                        />
                        <span className="flex items-center border-l border-border bg-zinc-900/80 px-3 text-sm text-zinc-500">
                          .qimem.com
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Region
                      </label>
                      <select
                        className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
                        value={form.region}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, region: e.target.value }))
                        }
                      >
                        <option value="">Select region</option>
                        {regions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Category
                      </label>
                      <select
                        className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
                        value={form.category}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, category: e.target.value }))
                        }
                      >
                        <option value="">Select style</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Branding
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Visual identity for guest-facing surfaces (stored per tenant).
                  </p>
                  <div className="mt-8 space-y-6">
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Primary brand color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form.primaryColor}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, primaryColor: e.target.value }))
                          }
                          className="h-12 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                        />
                        <Input
                          value={form.primaryColor}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, primaryColor: e.target.value }))
                          }
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Logo asset
                      </label>
                      <div className="rounded-lg border border-dashed border-zinc-600 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-500">
                        Drag & drop or browse — wire to Supabase Storage in production.
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Confirmation
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Review and provision the tenant. This saves the property to Supabase (tenant +
                    default subscription). Add hotel admins from <strong>Admins → Create admin</strong>.
                  </p>
                  {actionError ? (
                    <p className="mt-4 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                      {actionError}
                    </p>
                  ) : null}
                  <dl className="mt-8 space-y-4 text-sm">
                    <div className="flex justify-between border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Hotel</dt>
                      <dd className="font-medium text-white">{form.hotelName}</dd>
                    </div>
                    <div className="flex justify-between border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Domain</dt>
                      <dd className="font-mono text-gold">
                        {form.subdomain}.qimem.com
                      </dd>
                    </div>
                    <div className="flex justify-between border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Region / category</dt>
                      <dd className="text-right text-zinc-300">
                        {form.region || "—"} · {form.category || "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-zinc-500">Primary color</dt>
                      <dd className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded border border-white/20"
                          style={{ backgroundColor: form.primaryColor }}
                        />
                        {form.primaryColor}
                      </dd>
                    </div>
                  </dl>
                </>
              )}

              <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={back}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-gold"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {step === 1 ? "Cancel" : "Back"}
                </button>
                {step < 3 ? (
                  <Button type="button" onClick={next} className="gap-2">
                    {step === 1 ? "Continue to branding" : "Review"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => void completeProvisioning()}
                  >
                    {submitting ? "Saving…" : "Complete provisioning"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div
              className={cn(
                "rounded-2xl border border-border bg-surface-elevated/40 p-5",
                step < 2 && "opacity-90",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15">
                  <Lock className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Branding configuration</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Customize the guest experience with bespoke logos and brand colors.
                  </p>
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
                      Primary brand color
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="h-8 w-8 rounded border border-white/10"
                        style={{ backgroundColor: form.primaryColor }}
                      />
                      <span className="text-xs text-zinc-400">{form.primaryColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="aspect-[16/10] bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
                <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/80 to-transparent p-6">
                  <p className="text-lg font-semibold text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Crafting excellence.
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Your new tenant will inherit the Sovereign Standard design tokens by default.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/superadmin/tenants"
              className="block text-center text-xs text-zinc-600 hover:text-gold"
            >
              Return to tenants list
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600">
        Powered by Qimem OS · Secure superadmin environment
      </p>
    </div>
  );
}
