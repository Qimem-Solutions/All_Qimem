"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Search,
  Building2,
  MapPin,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate, formatRelative, tenantDisplayId } from "@/lib/format";
import type { TenantReportRow } from "@/lib/queries/superadmin";

function subStatusLabel(status: string | null) {
  if (!status) return "No subscription";
  const s = status.toLowerCase();
  if (s === "active") return "Active";
  if (s === "canceled" || s === "cancelled") return "Canceled";
  return status;
}

function statusBadge(t: TenantReportRow) {
  const s = (t.subStatus ?? "").toLowerCase();
  if (!t.subStatus) return <Badge tone="gray">No plan</Badge>;
  if (s === "active") return <Badge tone="green">Active</Badge>;
  if (s === "trialing" || s === "trial") return <Badge tone="gray">Trial</Badge>;
  if (s === "past_due" || s === "unpaid") return <Badge tone="red">Billing issue</Badge>;
  if (s === "canceled" || s === "cancelled") return <Badge tone="red">Canceled</Badge>;
  if (s === "inactive" || s === "suspended" || s === "paused")
    return <Badge tone="gray">Inactive</Badge>;
  return <Badge tone="gray">{t.subStatus}</Badge>;
}

function planPill(plan: string | null) {
  if (!plan) {
    return <span className="text-zinc-500">—</span>;
  }
  const p = plan.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        p === "advanced" && "bg-gold/15 text-gold",
        p === "pro" && "bg-amber-500/15 text-amber-200",
        p === "basic" && "bg-zinc-600/50 text-zinc-200",
        p !== "advanced" && p !== "pro" && p !== "basic" && "bg-zinc-800 text-zinc-300",
      )}
    >
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function SuperadminTenantReportsTable({ rows }: { rows: TenantReportRow[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("");

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of rows) {
      set.add((t.region?.trim() || "Unspecified") as string);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      const r = (t.region?.trim() || "Unspecified");
      if (region && r !== region) return false;
      if (!needle) return true;
      const hay = [
        t.name,
        t.slug,
        t.id,
        t.region,
        t.description,
        t.plan,
        t.subStatus,
        t.initialAdminEmail,
        t.initialAdminName,
        tenantDisplayId(t.id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, region]);

  const downloadCsv = () => {
    const headers = [
      "name",
      "slug",
      "tenant_id",
      "region",
      "description",
      "plan",
      "subscription_status",
      "subscription_created",
      "current_period_end",
      "employee_count",
      "profile_count",
      "rooms_count",
      "tenant_created_at",
      "initial_admin_name",
      "initial_admin_email",
    ];
    const lines = [headers.join(",")];
    for (const t of filtered) {
      const line = [
        t.name,
        t.slug,
        t.id,
        t.region ?? "",
        t.description ?? "",
        t.plan ?? "",
        t.subStatus ?? "",
        t.subCreatedAt ?? "",
        t.subPeriodEnd ?? "",
        String(t.employeeCount),
        String(t.profileCount),
        String(t.roomsCount),
        t.created_at,
        t.initialAdminName ?? "",
        t.initialAdminEmail ?? "",
      ].map((cell) => csvEscape(String(cell)));
      lines.push(line.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `all-qimem-tenants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, slug, region, plan, contact…"
            className="border-border/80 bg-surface-elevated/30 pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <MapPin className="h-3.5 w-3.5" />
            <span className="sr-only">Region</span>
            <label htmlFor="report-region" className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 opacity-60" />
              <select
                id="report-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded-lg border border-border/80 bg-surface-elevated/50 px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">All regions</option>
                {regionOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Showing <span className="font-medium text-zinc-300">{filtered.length}</span> of{" "}
        {rows.length} propert{rows.length === 1 ? "y" : "ies"}
      </p>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-surface-elevated/20">
        <div className="max-h-[min(70vh,900px)] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-[#0c0c0d] shadow-sm">
              <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="whitespace-nowrap px-4 py-3.5 font-medium sm:pl-5">Property</th>
                <th className="whitespace-nowrap py-3.5 font-medium">Slug</th>
                <th className="whitespace-nowrap py-3.5 font-medium">Region</th>
                <th className="whitespace-nowrap py-3.5 font-medium">Plan</th>
                <th className="whitespace-nowrap py-3.5 font-medium">Status</th>
                <th className="whitespace-nowrap py-3.5 text-right font-medium">Employees</th>
                <th className="whitespace-nowrap py-3.5 text-right font-medium" title="Profiles linked to this tenant">
                  App users
                </th>
                <th className="whitespace-nowrap py-3.5 text-right font-medium">Rooms</th>
                <th className="whitespace-nowrap py-3.5 font-medium">Period end</th>
                <th className="min-w-[140px] whitespace-nowrap py-3.5 font-medium sm:pr-5">
                  Provis. contact
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-zinc-500">
                    No tenants in the platform yet. Create one from{" "}
                    <Link href="/superadmin/tenants/create" className="text-gold underline decoration-gold/30">
                      New tenant
                    </Link>
                    .
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-zinc-500">
                    No properties match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="align-top transition-colors hover:bg-gold/[0.03] [&:nth-child(even)]:bg-white/[0.01]"
                  >
                    <td className="px-4 py-4 sm:pl-5">
                      <div className="flex gap-3">
                        {row.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.cover_image_url}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-950 ring-1 ring-white/10">
                            <Building2 className="h-5 w-5 text-zinc-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-white">{row.name}</p>
                          <p className="font-mono text-[11px] text-zinc-500">{tenantDisplayId(row.id)}</p>
                          {row.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-zinc-500" title={row.description ?? undefined}>
                              {row.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[120px] py-4 font-mono text-xs text-gold/90">/{row.slug}</td>
                    <td className="py-4 text-zinc-400">{row.region ?? "—"}</td>
                    <td className="py-4">{planPill(row.plan)}</td>
                    <td className="whitespace-nowrap py-4">{statusBadge(row)}</td>
                    <td className="py-4 text-right tabular-nums text-zinc-200">{row.employeeCount}</td>
                    <td className="py-4 text-right tabular-nums text-zinc-200">{row.profileCount}</td>
                    <td className="py-4 text-right tabular-nums text-zinc-200">{row.roomsCount}</td>
                    <td className="whitespace-nowrap py-4 text-zinc-400">
                      {row.subPeriodEnd ? formatDate(row.subPeriodEnd) : "—"}
                    </td>
                    <td className="py-4 pr-4 sm:pr-5">
                      <div className="min-w-0 text-xs">
                        {row.initialAdminName || row.initialAdminEmail ? (
                          <>
                            {row.initialAdminName ? (
                              <p className="font-medium text-zinc-200">{row.initialAdminName}</p>
                            ) : null}
                            {row.initialAdminEmail ? (
                              <a
                                href={`mailto:${row.initialAdminEmail}`}
                                className="text-gold/90 underline decoration-gold/30 underline-offset-2 hover:text-gold"
                              >
                                {row.initialAdminEmail}
                              </a>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                        <p className="mt-0.5 text-[10px] text-zinc-600">
                          Sub: {subStatusLabel(row.subStatus)} ·{" "}
                          {formatRelative(row.subCreatedAt ?? row.created_at)}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-xs text-zinc-500">
        <span>
          HR &quot;Employees&quot; = directory records · &quot;App users&quot; = auth profiles with this{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-[10px]">tenant_id</code>
        </span>
        <Link
          href="/superadmin/tenants"
          className="text-gold/90 transition-colors hover:text-gold hover:underline"
        >
          Open tenant management →
        </Link>
      </div>
    </div>
  );
}
