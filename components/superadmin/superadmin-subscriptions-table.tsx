"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { planPricingDisplay } from "@/lib/constants/plan-pricing-display";
import { SUPERADMIN_TABLE_PAGE_SIZE } from "@/lib/constants/table-pagination";
import type { SubscriptionListRow } from "@/lib/queries/superadmin";
import { SubscriptionRowActions } from "@/components/superadmin/subscription-row-actions";

function periodEnded(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

type PlanFilter = "all" | "basic" | "pro" | "advanced";
type StatusFilter = "all" | "active" | "inactive";
type PeriodFilter = "all" | "current" | "ended";

export function SuperadminSubscriptionsTable({ rows }: { rows: SubscriptionListRow[] }) {
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (plan !== "all" && String(s.plan).toLowerCase() !== plan) return false;
      if (status === "active" && String(s.status).toLowerCase() !== "active") return false;
      if (status === "inactive" && String(s.status).toLowerCase() === "active") return false;
      const ended = periodEnded(s.current_period_end);
      if (period === "current" && ended) return false;
      if (period === "ended" && !ended) return false;
      if (!q) return true;
      const name = (s.tenant_name ?? "").toLowerCase();
      const tid = s.tenant_id.toLowerCase();
      const pl = String(s.plan).toLowerCase();
      return name.includes(q) || tid.includes(q) || pl.includes(q);
    });
  }, [rows, search, plan, status, period]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / SUPERADMIN_TABLE_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, plan, status, period]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * SUPERADMIN_TABLE_PAGE_SIZE;
    return filtered.slice(start, start + SUPERADMIN_TABLE_PAGE_SIZE);
  }, [filtered, page]);

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No subscription rows yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Search
          </label>
          <Input
            placeholder="Hotel name, tenant id, plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search subscriptions"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Plan
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as PlanFilter)}
            className="h-10 min-w-[9rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
          >
            <option value="all">All plans</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-10 min-w-[9rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
          >
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Not active</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
          >
            <option value="all">Any period</option>
            <option value="current">Period not ended</option>
            <option value="ended">Period ended</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background/40 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="py-3 font-medium">Plan</th>
              <th className="whitespace-nowrap py-3 text-right font-medium">Amount</th>
              <th className="py-3 font-medium">Status</th>
              <th className="py-3 font-medium">Period end</th>
              <th className="py-3 font-medium">Created</th>
              <th className="w-[4rem] py-3 pr-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No rows match your filters.
                </td>
              </tr>
            ) : (
              pageRows.map((s) => {
                const ended = periodEnded(s.current_period_end);
                const { amount } = planPricingDisplay(s.plan);
                const amountCell =
                  amount !== "—" ? `ETB ${amount}` : "—";
                return (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium text-white">{s.tenant_name ?? s.tenant_id}</td>
                    <td className="py-3 capitalize">{s.plan}</td>
                    <td className="whitespace-nowrap py-3 text-right tabular-nums text-zinc-300">
                      {amountCell}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={s.status === "active" ? "green" : "gray"}>{s.status}</Badge>
                        {ended ? <Badge tone="orange">Period ended</Badge> : null}
                      </div>
                    </td>
                    <td className="py-3 text-zinc-400">{formatDate(s.current_period_end)}</td>
                    <td className="py-3 text-zinc-500">{formatDate(s.created_at)}</td>
                    <td className="py-3 pr-4 text-right align-middle">
                      <SubscriptionRowActions row={s} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-zinc-500 tabular-nums">
          {filtered.length === 0 ? (
            <>Showing 0 of {filtered.length}</>
          ) : (
            <>
              Showing {(page - 1) * SUPERADMIN_TABLE_PAGE_SIZE + 1}–
              {Math.min(page * SUPERADMIN_TABLE_PAGE_SIZE, filtered.length)} of {filtered.length}
            </>
          )}
          {filtered.length !== rows.length ? (
            <span className="text-zinc-600"> (filtered from {rows.length})</span>
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
              disabled={page <= 1 || filtered.length === 0}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
