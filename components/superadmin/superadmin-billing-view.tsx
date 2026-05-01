"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, CreditCard, Wallet, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { planPricingDisplay } from "@/lib/constants/plan-pricing-display";
import type { TenantReportRow } from "@/lib/queries/superadmin";
import type { SubscriptionBillingEventRow } from "@/lib/queries/subscription-billing";
import { SUPERADMIN_TABLE_PAGE_SIZE } from "@/lib/constants/table-pagination";
import { SuperadminInvoicePreviewDialog } from "@/components/superadmin/superadmin-invoice-preview-dialog";

function monthKeyFromServiceMonth(iso: string) {
  return iso.slice(0, 7);
}

function labelForMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sourceBadge(source: string) {
  if (source === "initial") return <Badge tone="gold">Signup</Badge>;
  if (source === "period_extension") return <Badge tone="gray">Renewal</Badge>;
  return <Badge tone="gray">{source}</Badge>;
}

/** Matches `Button` secondary + md — for `Link` / `<a>` navigation. */
const secondaryNavClass = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 text-sm font-medium text-foreground transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold dark:hover:bg-zinc-800",
  "h-10",
);

type PlanFilterInv = "all" | "basic" | "pro" | "advanced";
type SourceFilter = "all" | "initial" | "period_extension";

export function SuperadminBillingView({
  rows,
  error,
  billingRows,
  billingError,
}: {
  rows: TenantReportRow[];
  error: string | null;
  billingRows: SubscriptionBillingEventRow[];
  billingError: string | null;
}) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<PlanFilterInv>("all");
  const [filterSource, setFilterSource] = useState<SourceFilter>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [previewRow, setPreviewRow] = useState<SubscriptionBillingEventRow | null>(null);

  const billingMonthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of billingRows) {
      const k = monthKeyFromServiceMonth(r.service_month);
      if (k.length >= 7) set.add(k);
    }
    const keys = [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    if (keys.length === 0) {
      const now = new Date();
      for (let i = 0; i < 18; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    return keys;
  }, [billingRows]);

  const filteredBilling = useMemo(() => {
    const q = search.trim().toLowerCase();
    return billingRows.filter((r) => {
      if (filterPlan !== "all" && String(r.plan).toLowerCase() !== filterPlan) return false;
      if (filterSource !== "all" && r.source !== filterSource) return false;
      if (filterMonth !== "all" && monthKeyFromServiceMonth(r.service_month) !== filterMonth) return false;
      if (!q) return true;
      const name = (r.tenant_name ?? "").toLowerCase();
      const slug = (r.tenant_slug ?? "").toLowerCase();
      const pl = String(r.plan).toLowerCase();
      return name.includes(q) || slug.includes(q) || pl.includes(q) || r.id.toLowerCase().includes(q);
    });
  }, [billingRows, search, filterPlan, filterSource, filterMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredBilling.length / SUPERADMIN_TABLE_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, filterPlan, filterSource, filterMonth]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageBillingRows = useMemo(() => {
    const start = (page - 1) * SUPERADMIN_TABLE_PAGE_SIZE;
    return filteredBilling.slice(start, start + SUPERADMIN_TABLE_PAGE_SIZE);
  }, [filteredBilling, page]);

  const activeCount = useMemo(
    () => rows.filter((r) => (r.subStatus ?? "").toLowerCase() === "active").length,
    [rows],
  );

  const nextRenewal = useMemo(() => {
    const withEnd = rows.map((r) => r.subPeriodEnd).filter(Boolean) as string[];
    if (withEnd.length === 0) return null;
    const times = withEnd
      .map((iso) => new Date(iso).getTime())
      .filter((t) => !Number.isNaN(t) && t > Date.now());
    if (times.length === 0) return null;
    return new Date(Math.min(...times));
  }, [rows]);

  const topPlan = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.plan) continue;
      const k = r.plan.toLowerCase();
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    let best: string | null = null;
    let n = 0;
    for (const [k, c] of m) {
      if (c > n) {
        n = c;
        best = k;
      }
    }
    if (!best) return null;
    const meta = planPricingDisplay(best);
    return { key: best, count: n, label: meta.name, amount: meta.amount };
  }, [rows]);

  return (
    <div className="min-h-0 space-y-6">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {billingError ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
          {billingError}
        </p>
      ) : null}

      <SuperadminInvoicePreviewDialog
        open={!!previewRow}
        onClose={() => setPreviewRow(null)}
        row={previewRow}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col justify-between">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-base">
              {topPlan ? (
                <>
                  {topPlan.label}
                  {topPlan.amount !== "—" ? (
                    <span className="ml-2 text-sm font-normal text-muted">
                      ETB {topPlan.amount}/mo · most common
                    </span>
                  ) : null}
                </>
              ) : (
                "Subscriptions"
              )}
            </CardTitle>
            <CardDescription className="leading-relaxed">
              {rows.length} propert{rows.length === 1 ? "y" : "ies"} on the platform;{" "}
              <span className="font-medium text-foreground">{activeCount} active</span> paid or trialing
              subscriptions. Amounts shown are ETB per month (catalog pricing).
            </CardDescription>
            {nextRenewal ? (
              <p className="mt-3 text-sm text-muted">
                Your next billing milestones include period ends; earliest listed:{" "}
                <span className="text-foreground">{formatDate(nextRenewal.toISOString())}</span>
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="flex justify-end pt-2">
            <Link href="/superadmin/subscriptions" className={secondaryNavClass}>
              Adjust plans
              <ChevronRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader className="space-y-1 pb-0">
            <CardTitle className="text-base">Payment</CardTitle>
            <CardDescription>Update billing and invoices in your provider.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end pt-4">
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryNavClass}
            >
              <CreditCard className="h-4 w-4" />
              Manage in Stripe
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-col gap-4 border-b border-border bg-background/40 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Invoices & subscriptions</CardTitle>
            <p className="text-xs text-muted">
              Ledger rows from signup and each <strong>Update period (+1 month)</strong> action.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Search
              </label>
              <Input
                placeholder="Hotel, slug, plan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search invoices"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Plan
              </label>
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value as PlanFilterInv)}
                className="h-10 min-w-[9rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
              >
                <option value="all">All plans</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Type
              </label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as SourceFilter)}
                className="h-10 min-w-[10rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
              >
                <option value="all">All types</option>
                <option value="initial">Initial signup</option>
                <option value="period_extension">Period renewal</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Service month
              </label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
              >
                <option value="all">All months</option>
                {billingMonthOptions.map((k) => (
                  <option key={k} value={k}>
                    {labelForMonthKey(k)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="whitespace-nowrap px-6 py-4 font-medium">Recorded</th>
                  <th className="whitespace-nowrap py-4 pr-3 font-medium">Hotel</th>
                  <th className="whitespace-nowrap py-4 font-medium">Month paid</th>
                  <th className="py-4 font-medium">Plan</th>
                  <th className="whitespace-nowrap py-4 font-medium">Type</th>
                  <th className="whitespace-nowrap py-4 text-right font-medium">Amount</th>
                  <th className="w-[1%] whitespace-nowrap py-4 pl-2 pr-6 text-right font-medium">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                {billingRows.length === 0 && !billingError ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No billing activity yet. Complete tenant setup or extend a subscription period to see
                      invoices here. If this stays empty, ask your platform administrator to verify billing is
                      enabled for your environment.
                    </td>
                  </tr>
                ) : filteredBilling.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No rows match your filters.
                    </td>
                  </tr>
                ) : (
                  pageBillingRows.map((r) => {
                    const { amount, name: planName } = planPricingDisplay(r.plan);
                    const showAmount = r.plan && amount !== "—" ? `ETB ${amount}` : "—";
                    const monthPaid = labelForMonthKey(monthKeyFromServiceMonth(r.service_month));
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/60 transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-zinc-400">
                          {r.created_at ? formatDate(r.created_at) : "—"}
                        </td>
                        <td className="max-w-[200px] py-4 pr-2">
                          <p className="truncate font-medium text-white">
                            {r.tenant_name ?? "—"}
                          </p>
                          {r.tenant_slug ? (
                            <p className="truncate font-mono text-xs text-gold">/{r.tenant_slug}</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap py-4 text-zinc-300">{monthPaid}</td>
                        <td className="py-4 capitalize text-zinc-400">{planName}</td>
                        <td className="whitespace-nowrap py-4">{sourceBadge(r.source)}</td>
                        <td className="whitespace-nowrap py-4 text-right tabular-nums text-zinc-300">
                          {showAmount}
                        </td>
                        <td className="whitespace-nowrap py-4 pl-2 pr-6 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold/90 underline decoration-gold/30 underline-offset-2 hover:text-gold"
                            onClick={() => setPreviewRow(r)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {billingRows.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
              <p className="text-xs text-zinc-500 tabular-nums">
                {filteredBilling.length === 0 ? (
                  <>Showing 0 of {filteredBilling.length}</>
                ) : (
                  <>
                    Showing {(page - 1) * SUPERADMIN_TABLE_PAGE_SIZE + 1}–
                    {Math.min(page * SUPERADMIN_TABLE_PAGE_SIZE, filteredBilling.length)} of{" "}
                    {filteredBilling.length}
                  </>
                )}
                {filteredBilling.length !== billingRows.length ? (
                  <span className="text-zinc-600"> (filtered from {billingRows.length})</span>
                ) : null}
                <span className="text-zinc-600"> · {SUPERADMIN_TABLE_PAGE_SIZE} per page</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs tabular-nums text-zinc-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || filteredBilling.length === 0}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages || filteredBilling.length === 0}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Tenant offboarding</CardTitle>
            <CardDescription>We&apos;ll be sad to see a partner go.</CardDescription>
            <p className="max-w-xl text-xs leading-relaxed text-muted">
              Cancellations and data export are handled in tenant management. Coordinate with the property
              before removing a tenant.
            </p>
          </div>
          <Link href="/superadmin/tenants" className={cn(secondaryNavClass, "shrink-0")}>
            <Wallet className="h-4 w-4" />
            Manage tenants
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
