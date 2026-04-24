import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp, Users, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchSuperadminDashboardStats,
  fetchTenantsWithSubscriptions,
} from "@/lib/queries/superadmin";
function planLabel(plan: string | null) {
  if (!plan) return "—";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function subStatusLabel(status: string | null) {
  if (!status) return "No subscription";
  const s = status.toLowerCase();
  if (s === "active") return "Active";
  if (s === "canceled" || s === "cancelled") return "Canceled";
  return status;
}

export default async function SuperadminDashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const [stats, { rows: tenants, error: tenantsErr }] = await Promise.all([
    fetchSuperadminDashboardStats(),
    fetchTenantsWithSubscriptions(),
  ]);

  const recent = tenants.slice(0, 8);

  const kpis = [
    {
      label: "Active tenants",
      value: String(stats.tenantCount),
      hint: "Total properties on the platform",
      icon: Building2,
    },
    {
      label: "Total headcount (agg.)",
      value: String(stats.employeeCount),
      hint: "Employees across all tenants",
      icon: Users,
    },
    {
      label: "Active subscriptions",
      value: String(stats.activeSubscriptions),
      hint: "Subscriptions in active status",
      icon: TrendingUp,
    },
    {
      label: "System health",
      value: stats.error ? "Check data" : "OK",
      hint: stats.error ?? "Queries completed",
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cross-tenant KPIs, provisioning, and subscription posture.
          </p>
        </div>
        <Link
          href="/superadmin/tenants/create"
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-lg bg-gold px-4 text-sm font-semibold text-gold-foreground hover:bg-gold-dim",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
          )}
        >
          + New tenant
        </Link>
      </div>

      {stats.error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
          {stats.error} — Ensure RLS migration is applied and you are signed in as superadmin.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-0">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {k.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-gold/80" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-white">{k.value}</p>
                <p className="mt-1 text-xs text-zinc-500">{k.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent tenants</CardTitle>
            <CardDescription>Newest properties by created date.</CardDescription>
          </CardHeader>
          <CardContent>
            {tenantsErr ? (
              <p className="text-sm text-red-300">{tenantsErr}</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-zinc-500">No tenants yet. Create one to get started.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-zinc-500">
                    <th className="pb-3 font-medium">Tenant</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Region</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {recent.map((t) => {
                    const st = (t.subStatus ?? "").toLowerCase();
                    const badge =
                      st === "active" ? (
                        <Badge tone="green">{subStatusLabel(t.subStatus)}</Badge>
                      ) : st === "canceled" || st === "cancelled" ? (
                        <Badge tone="red">{subStatusLabel(t.subStatus)}</Badge>
                      ) : (
                        <Badge tone="green">{subStatusLabel(t.subStatus)}</Badge>
                      );
                    return (
                      <tr key={t.id} className="border-b border-border/60">
                        <td className="py-3 font-medium text-white">{t.name}</td>
                        <td className="py-3">{planLabel(t.plan)}</td>
                        <td className="py-3">{t.region ?? "—"}</td>
                        <td className="py-3">{badge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Platform-scoped tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/superadmin/admins"
              className="inline-flex h-10 items-center justify-start rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              Manage hotel admins
            </Link>
            <Link
              href="/superadmin/tenants"
              className="inline-flex h-10 items-center justify-start rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              View all tenants
            </Link>
            <Link
              href="/superadmin/subscriptions"
              className="inline-flex h-10 items-center justify-start rounded-lg px-4 text-sm font-medium text-gold hover:underline"
            >
              Subscriptions
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
