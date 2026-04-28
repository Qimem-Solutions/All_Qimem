"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { TenantReportRow } from "@/lib/queries/superadmin";

/** Display prices for the billing table (configure to match your catalog). */
const PLAN_ETB: Record<string, { amount: string; name: string }> = {
  basic: { amount: "9.00", name: "Basic" },
  pro: { amount: "20.00", name: "Pro" },
  advanced: { amount: "49.00", name: "Advanced" },
};

function planPrice(plan: string | null) {
  if (!plan) return { amount: "—", name: "—" as string };
  const p = plan.toLowerCase();
  return PLAN_ETB[p] ?? { amount: "—", name: plan };
}

function statusLabel(s: string | null) {
  if (!s) return "No plan";
  const x = s.toLowerCase();
  if (x === "active") return "Active";
  if (x === "trialing" || x === "trial") return "Trialing";
  if (x === "past_due" || x === "unpaid") return "Past due";
  if (x === "canceled" || x === "cancelled") return "Canceled";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusBillingBadge(s: string | null) {
  if (!s) return <Badge tone="gray">No plan</Badge>;
  const x = s.toLowerCase();
  if (x === "active" || x === "trialing" || x === "trial")
    return <Badge tone="green">{statusLabel(s)}</Badge>;
  if (x === "past_due" || x === "unpaid") return <Badge tone="orange">{statusLabel(s)}</Badge>;
  if (x === "canceled" || x === "cancelled" || x === "inactive" || x === "suspended" || x === "paused")
    return <Badge tone="red">{statusLabel(s)}</Badge>;
  return <Badge tone="gray">{statusLabel(s)}</Badge>;
}

type MonthValue = "all" | string;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelForMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Matches `Button` secondary + md — for `Link` / `<a>` navigation. */
const secondaryNavClass = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 text-sm font-medium text-foreground transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold dark:hover:bg-zinc-800",
  "h-10",
);

export function SuperadminBillingView({ rows, error }: { rows: TenantReportRow[]; error: string | null }) {
  const monthOptions = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(monthKey(d));
    }
    return keys;
  }, []);

  const [filterMonth, setFilterMonth] = useState<MonthValue>("all");

  const filtered = useMemo(() => {
    if (filterMonth === "all") return rows;
    const [y, m] = filterMonth.split("-").map(Number);
    if (!y || !m) return rows;
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 0, 23, 59, 59, 999).getTime();
    return rows.filter((r) => {
      const t = r.subCreatedAt
        ? new Date(r.subCreatedAt).getTime()
        : new Date(r.created_at).getTime();
      if (Number.isNaN(t)) return false;
      return t >= start && t <= end;
    });
  }, [rows, filterMonth]);

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
    const meta = planPrice(best);
    return { key: best, count: n, label: meta.name, amount: meta.amount };
  }, [rows]);

  return (
    <div className="min-h-0 space-y-6">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

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
              subscriptions. Align displayed amounts with your Stripe product prices.
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
        <CardHeader className="flex flex-col gap-2 border-b border-border bg-background/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Invoices & subscriptions</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">Period</span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value as MonthValue)}
              className="h-9 min-w-[10rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
            >
              <option value="all">All time</option>
              {monthOptions.map((k) => (
                <option key={k} value={k}>
                  {labelForMonthKey(k)}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="whitespace-nowrap px-6 py-4 font-medium">Date</th>
                  <th className="whitespace-nowrap py-4 pr-3 font-medium">Tenant</th>
                  <th className="min-w-[120px] py-4 font-medium">Description</th>
                  <th className="whitespace-nowrap py-4 font-medium">Status</th>
                  <th className="whitespace-nowrap py-4 text-right font-medium">Amount</th>
                  <th className="w-[1%] whitespace-nowrap py-4 pl-2 pr-6 text-right font-medium">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No tenants yet.
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No activity in this period. Try &quot;All time&quot; or another month.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const d = r.subCreatedAt ? new Date(r.subCreatedAt) : new Date(r.created_at);
                    const { amount, name: planName } = planPrice(r.plan);
                    const showAmount = r.plan && amount !== "—" ? `ETB ${amount}` : "—";
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/60 transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-zinc-400">
                          {formatDate(d.toISOString())}
                        </td>
                        <td className="max-w-[200px] py-4 pr-2">
                          <p className="truncate font-medium text-white">{r.name}</p>
                          <p className="truncate font-mono text-xs text-gold">/{r.slug}</p>
                        </td>
                        <td className="py-4 text-zinc-400">{r.plan ? `${planName} plan` : "—"}</td>
                        <td className="whitespace-nowrap py-4">{statusBillingBadge(r.subStatus)}</td>
                        <td className="whitespace-nowrap py-4 text-right tabular-nums text-zinc-300">
                          {showAmount}
                        </td>
                        <td className="whitespace-nowrap py-4 pl-2 pr-6 text-right">
                          <Link
                            href="/superadmin/subscriptions"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold/90 underline decoration-gold/30 underline-offset-2 hover:text-gold"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
