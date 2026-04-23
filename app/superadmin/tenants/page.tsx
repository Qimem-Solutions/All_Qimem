import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowDownToLine, Filter, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchTenantsWithSubscriptions,
  fetchSubscriptionPlansSummary,
  type TenantRow,
} from "@/lib/queries/superadmin";
import { formatRelative, tenantDisplayId } from "@/lib/format";
import { TenantRowActions } from "@/components/superadmin/tenant-row-actions";

function planIcon(plan: string | null) {
  if (!plan) {
    return (
      <span className="inline-flex items-center gap-1.5 text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />—
      </span>
    );
  }
  const p = plan.toLowerCase();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          p === "advanced" ? "bg-gold" : p === "pro" ? "bg-amber-600" : "bg-zinc-500",
        )}
      />
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function statusBadge(t: TenantRow) {
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

function aggregateRegions(rows: TenantRow[]) {
  const m = new Map<string, number>();
  for (const t of rows) {
    const key = (t.region?.trim() || "Unknown").slice(0, 32);
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  const total = rows.length || 1;
  return [...m.entries()]
    .map(([label, n]) => ({ label, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);
}

export default async function TenantsManagementPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const { rows: tenants, error } = await fetchTenantsWithSubscriptions();
  const { byPlan, error: planErr } = await fetchSubscriptionPlansSummary();

  const total = tenants.length;
  const activeSubs = tenants.filter((t) => (t.subStatus ?? "").toLowerCase() === "active").length;
  const nonActive = tenants.filter((t) => {
    const s = (t.subStatus ?? "").toLowerCase();
    return s && s !== "active";
  }).length;
  const engagementPct =
    total === 0 ? 0 : Math.round((activeSubs / total) * 100);

  const kpis = [
    {
      label: "Total partners",
      value: String(total),
      sub: error ? "Could not load tenants" : "Properties in database",
      icon: TrendingUp,
      tone: "neutral" as const,
    },
    {
      label: "Active subscriptions",
      value: String(activeSubs),
      sub: planErr ? planErr : "Linked to a subscription row",
      tone: "neutral" as const,
    },
    {
      label: "Engagement",
      value: `${engagementPct}%`,
      sub: "Tenants with active subscription",
      tone: "neutral" as const,
    },
    {
      label: "Non-active subs",
      value: String(nonActive),
      sub: "Review billing or onboarding",
      icon: AlertTriangle,
      tone: nonActive > 0 ? ("alert" as const) : ("neutral" as const),
    },
  ];

  const regionBars = aggregateRegions(tenants);
  const planTotal = byPlan.basic + byPlan.pro + byPlan.advanced;
  const planPct = (n: number) => (planTotal === 0 ? 0 : Math.round((n / planTotal) * 100));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Tenants management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Orchestrate and monitor hotel partners across the All Qimem platform.
          </p>
        </div>
        <Link
          href="/superadmin/tenants/create"
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gold px-4 text-sm font-semibold text-gold-foreground transition-colors hover:bg-gold-dim",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
          )}
        >
          + Add new tenant
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className={k.tone === "alert" ? "border-red-500/20 bg-red-950/10" : ""}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {k.label}
                </CardTitle>
                {Icon ? (
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      k.tone === "alert" ? "text-red-400" : "text-gold/80",
                    )}
                  />
                ) : null}
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-3xl font-semibold",
                    k.tone === "alert" ? "text-red-300" : "text-white",
                  )}
                >
                  {k.value}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{k.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border bg-background/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-gold-foreground">
              All tenants ({total})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="px-3" type="button" disabled>
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" type="button" disabled>
              <ArrowDownToLine className="h-4 w-4" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4 font-medium">Hotel name</th>
                  <th className="py-4 font-medium">Slug</th>
                  <th className="py-4 font-medium">Region</th>
                  <th className="py-4 font-medium">Status</th>
                  <th className="py-4 font-medium">Plan</th>
                  <th className="py-4 font-medium">Last activity</th>
                  <th className="py-4 text-right font-medium">ID</th>
                  <th className="w-[72px] py-4 pr-6 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-zinc-500">
                      No tenants yet. Create your first property to see it here.
                    </td>
                  </tr>
                ) : (
                  tenants.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {row.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.cover_image_url}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                            />
                          ) : (
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 ring-1 ring-white/10" />
                          )}
                          <div>
                            <p className="font-medium text-white">{row.name}</p>
                            <p className="text-xs text-zinc-500">{tenantDisplayId(row.id)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-xs text-gold">/{row.slug}</td>
                      <td className="py-4 text-zinc-400">{row.region ?? "—"}</td>
                      <td className="py-4">{statusBadge(row)}</td>
                      <td className="py-4 text-zinc-300">{planIcon(row.plan)}</td>
                      <td className="py-4 text-zinc-500">
                        {formatRelative(row.subCreatedAt ?? row.created_at)}
                      </td>
                      <td className="py-4 text-right font-mono text-xs text-zinc-500">
                        {row.id.slice(0, 8)}…
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <TenantRowActions row={row} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4 text-xs text-zinc-500">
            <span>
              Showing {total} tenant{total === 1 ? "" : "s"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Regional distribution</CardTitle>
            <CardDescription>By region field on each tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            {regionBars.length === 0 ? (
              <p className="text-sm text-zinc-500">No region data yet.</p>
            ) : (
              <div className="flex h-40 items-end justify-between gap-3">
                {regionBars.map((r) => (
                  <div key={r.label} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t bg-gold/50"
                      style={{ height: `${Math.max(8, r.pct * 2)}px` }}
                    />
                    <span className="text-center text-[10px] text-zinc-500">{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan breakdown</CardTitle>
            <CardDescription>Active subscriptions by tier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planErr ? (
              <p className="text-sm text-red-300">{planErr}</p>
            ) : planTotal === 0 ? (
              <p className="text-sm text-zinc-500">No active subscription rows.</p>
            ) : (
              [
                { label: "Advanced", n: byPlan.advanced, color: "bg-gold/80" },
                { label: "Pro", n: byPlan.pro, color: "bg-amber-700/70" },
                { label: "Basic", n: byPlan.basic, color: "bg-zinc-600" },
              ].map((p) => (
                <div key={p.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-zinc-400">{p.label}</span>
                    <span className="text-white">{planPct(p.n)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn("h-full rounded-full", p.color)}
                      style={{ width: `${planPct(p.n)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600">
        Powered by Qimem OS · Secure superadmin environment
      </p>
    </div>
  );
}
