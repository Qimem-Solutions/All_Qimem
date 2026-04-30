"use client";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { planPricingDisplay } from "@/lib/constants/plan-pricing-display";
import type { SubscriptionBillingEventRow } from "@/lib/queries/subscription-billing";

function formatPaidMonth(serviceMonth: string) {
  const iso = serviceMonth.includes("T") ? serviceMonth : `${serviceMonth.slice(0, 10)}T12:00:00Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return serviceMonth;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sourceLabel(source: string) {
  if (source === "initial") return "Initial subscription";
  if (source === "period_extension") return "Period renewal (+1 month)";
  return source;
}

export function SuperadminInvoicePreviewDialog({
  open,
  onClose,
  row,
}: {
  open: boolean;
  onClose: () => void;
  row: SubscriptionBillingEventRow | null;
}) {
  if (!open || !row) return null;

  const hotel = row.tenant_name?.trim() || "Hotel";
  const slug = row.tenant_slug?.trim();
  const { amount, name: planName } = planPricingDisplay(row.plan);
  const amountLine = amount !== "—" ? `ETB ${amount}` : "—";

  return (
    <div
      className="fixed inset-0 isolate z-[10050] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-preview-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-black/70"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-zinc-700/80 bg-gradient-to-b from-zinc-900 to-zinc-950 p-0 shadow-2xl ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-8 pb-6 pt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-gold/90">Invoice</p>
          <h2 id="invoice-preview-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">
            All Qimem
          </h2>
          <p className="mt-1 text-sm text-zinc-400">Subscription billing record</p>
        </div>

        <div className="space-y-6 px-8 py-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Hotel</p>
            <p className="mt-1 text-lg font-medium text-white">{hotel}</p>
            {slug ? <p className="font-mono text-sm text-gold/80">/{slug}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Month covered</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">{formatPaidMonth(row.service_month)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Recorded</p>
              <p className="mt-1 text-sm text-zinc-300">
                {row.created_at ? formatDate(row.created_at) : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3">
              <div>
                <p className="font-medium text-white">{planName} plan</p>
                <p className="mt-0.5 text-xs text-zinc-500">{sourceLabel(row.source)}</p>
              </div>
              <p className="shrink-0 tabular-nums text-sm font-semibold text-zinc-100">{amountLine}</p>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-medium text-zinc-400">Total due</span>
              <span className="text-lg font-semibold tabular-nums text-white">{amountLine}</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-zinc-500">
            Reference <span className="font-mono text-zinc-400">{row.id.slice(0, 8)}…</span>
          </p>
        </div>

        <div className="flex justify-end border-t border-white/10 px-8 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
