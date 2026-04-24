"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, CreditCard, Wallet, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { TenantReportRow } from "@/lib/queries/superadmin";

const lightOutlineBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-50";

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

function statusPill(s: string | null) {
  if (!s) {
    return (
      <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-500">
        No plan
      </span>
    );
  }
  const x = s.toLowerCase();
  if (x === "active" || x === "trialing" || x === "trial")
    return (
      <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        {statusLabel(s)}
      </span>
    );
  if (x === "past_due" || x === "unpaid")
    return (
      <span className="inline-flex rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
        {statusLabel(s)}
      </span>
    );
  if (x === "canceled" || x === "cancelled" || x === "inactive" || x === "suspended" || x === "paused")
    return (
      <span className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
        {statusLabel(s)}
      </span>
    );
  return (
    <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-700">
      {statusLabel(s)}
    </span>
  );
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
    const withEnd = rows
      .map((r) => r.subPeriodEnd)
      .filter(Boolean) as string[];
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
    <div className="min-h-0 text-stone-900">
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm ring-1 ring-stone-900/[0.04]">
            <div>
              <p className="text-lg font-semibold tracking-tight text-stone-900">
                {topPlan ? (
                  <>
                    {topPlan.label}
                    {topPlan.amount !== "—" ? (
                      <span className="ml-2 text-sm font-normal text-stone-500">
                        ETB {topPlan.amount}/mo · most common
                      </span>
                    ) : null}
                  </>
                ) : (
                  "Subscriptions"
                )}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {rows.length} propert{rows.length === 1 ? "y" : "ies"} on the platform;{" "}
                <span className="font-medium text-stone-800">{activeCount} active</span> paid or trialing
                subscriptions. Align displayed amounts with your Stripe product prices.
              </p>
              {nextRenewal ? (
                <p className="mt-3 text-sm text-stone-600">
                  Your next billing milestones include period ends; earliest listed:{" "}
                  <span className="text-stone-800">{formatDate(nextRenewal.toISOString())}</span>
                </p>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end">
              <Link href="/superadmin/subscriptions" className={lightOutlineBtn}>
                Adjust plans
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm ring-1 ring-stone-900/[0.04]">
            <div>
              <p className="text-lg font-semibold tracking-tight text-stone-900">Payment</p>
              <p className="mt-1 text-sm text-stone-500">Update billing and invoices in your provider.</p>
            </div>
            <div className="mt-4 flex justify-end">
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className={lightOutlineBtn}
              >
                <CreditCard className="h-4 w-4" />
                Manage in Stripe
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm ring-1 ring-stone-900/[0.04]">
          <div className="flex flex-col gap-1 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-stone-900">Invoices & subscriptions</h2>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <span className="whitespace-nowrap">Period</span>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value as MonthValue)}
                className="h-9 min-w-[10rem] rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 shadow-sm"
              >
                <option value="all">All time</option>
                {monthOptions.map((k) => (
                  <option key={k} value={k}>
                    {labelForMonthKey(k)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs font-medium uppercase tracking-wider text-stone-500">
                  <th className="whitespace-nowrap px-5 py-3.5">Date</th>
                  <th className="whitespace-nowrap py-3.5 pr-3">Tenant</th>
                  <th className="min-w-[120px] py-3.5">Description</th>
                  <th className="whitespace-nowrap py-3.5">Status</th>
                  <th className="whitespace-nowrap py-3.5 text-right">Amount</th>
                  <th className="w-[1%] whitespace-nowrap py-3.5 pl-2 pr-5 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-stone-500">
                      No tenants yet.
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-stone-500">
                      No activity in this period. Try &quot;All time&quot; or another month.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const d = r.subCreatedAt ? new Date(r.subCreatedAt) : new Date(r.created_at);
                    const { amount, name: planName } = planPrice(r.plan);
                    const showAmount = r.plan && amount !== "—" ? `ETB ${amount}` : "—";
                    return (
                      <tr key={r.id} className="bg-white text-stone-800 transition-colors hover:bg-stone-50/80">
                        <td className="whitespace-nowrap px-5 py-3.5 text-stone-700">
                          {formatDate(d.toISOString())}
                        </td>
                        <td className="max-w-[200px] py-3.5 pr-2">
                          <p className="truncate font-medium text-stone-900">{r.name}</p>
                          <p className="truncate font-mono text-xs text-stone-400">/{r.slug}</p>
                        </td>
                        <td className="py-3.5 text-stone-600">
                          {r.plan ? `${planName} plan` : "—"}
                        </td>
                        <td className="whitespace-nowrap py-3.5">{statusPill(r.subStatus)}</td>
                        <td className="whitespace-nowrap py-3.5 text-right tabular-nums text-stone-800">
                          {showAmount}
                        </td>
                        <td className="whitespace-nowrap py-3.5 pl-2 pr-5 text-right">
                          <Link
                            href="/superadmin/subscriptions"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 underline decoration-stone-300/80 underline-offset-2 hover:text-stone-900"
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
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm ring-1 ring-stone-900/[0.04] sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-semibold text-stone-900">Tenant offboarding</p>
            <p className="mt-0.5 text-sm text-stone-500">We&apos;ll be sad to see a partner go.</p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-stone-500">
              Cancellations and data export are handled in tenant management. Coordinate with the property
              before removing a tenant.
            </p>
          </div>
          <Link
            href="/superadmin/tenants"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-50 sm:self-center"
          >
            <Wallet className="h-4 w-4" />
            Manage tenants
          </Link>
        </div>
      </div>
    </div>
  );
}
