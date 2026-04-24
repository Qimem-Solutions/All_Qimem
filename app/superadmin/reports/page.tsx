import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Building2,
  Globe2,
  Layers,
  Users,
  DoorOpen,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchSuperadminTenantsReport,
  fetchSubscriptionPlansSummary,
  type TenantReportRow,
} from "@/lib/queries/superadmin";
import { cn } from "@/lib/utils";
import { SuperadminTenantReportsTable } from "@/components/superadmin/superadmin-tenant-reports-table";

export const dynamic = "force-dynamic";

function aggregateRegions(rows: TenantReportRow[]) {
  const m = new Map<string, number>();
  for (const t of rows) {
    const key = (t.region?.trim() || "Unspecified").slice(0, 32);
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  const total = rows.length || 1;
  return [...m.entries()]
    .map(([label, n]) => ({ label, pct: Math.round((n / total) * 100), n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
}

export default async function SuperadminReportsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const [{ rows, error }, { byPlan, error: planErr }] = await Promise.all([
    fetchSuperadminTenantsReport(),
    fetchSubscriptionPlansSummary(),
  ]);

  const totalTenants = rows.length;
  const totalEmployees = rows.reduce((s, t) => s + t.employeeCount, 0);
  const totalProfiles = rows.reduce((s, t) => s + t.profileCount, 0);
  const totalRooms = rows.reduce((s, t) => s + t.roomsCount, 0);
  const activeSubs = rows.filter((t) => (t.subStatus ?? "").toLowerCase() === "active").length;

  const regionBars = aggregateRegions(rows);
  const planTotal = byPlan.basic + byPlan.pro + byPlan.advanced;
  const planPct = (n: number) => (planTotal === 0 ? 0 : Math.round((n / planTotal) * 100));

  const kpis = [
    {
      label: "Properties",
      value: String(totalTenants),
      hint: "Tenants on platform",
      icon: Building2,
    },
    {
      label: "Employees (HRMS)",
      value: String(totalEmployees),
      hint: "Directory rows across tenants",
      icon: Users,
    },
    {
      label: "App-linked users",
      value: String(totalProfiles),
      hint: "Profiles with tenant_id",
      icon: Layers,
    },
    {
      label: "Rooms (HRRM)",
      value: String(totalRooms),
      hint: "Inventory units",
      icon: DoorOpen,
    },
    {
      label: "Active subs",
      value: String(activeSubs),
      hint: "Subscription status = active",
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">
            <BarChart3 className="h-3.5 w-3.5" />
            Platform report
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Tenants & operations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Live view of every property: subscription, headcount, rooms, and provisioning details.
            Use search and region filters in the table; export a CSV for finance or support.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/superadmin/tenants"
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Manage tenants
          </Link>
          <Link
            href="/superadmin/subscriptions"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gold px-4 text-sm font-semibold text-gold-foreground transition-colors hover:bg-gold-dim"
          >
            Subscriptions
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="border-border/80">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {k.label}
                </CardTitle>
                <Icon className="h-4 w-4 shrink-0 text-gold/70" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-white">{k.value}</p>
                <p className="mt-1 text-xs text-zinc-500">{k.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base [font-family:var(--font-outfit),system-ui,sans-serif]">
              Regional mix
            </CardTitle>
            <CardDescription>Share of tenants by region field.</CardDescription>
          </CardHeader>
          <CardContent>
            {regionBars.length === 0 ? (
              <p className="text-sm text-zinc-500">No tenants yet.</p>
            ) : (
              <div className="space-y-4">
                {regionBars.map((r) => (
                  <div key={r.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-zinc-400">
                        <Globe2 className="h-3.5 w-3.5 text-gold/50" />
                        {r.label}
                      </span>
                      <span className="tabular-nums text-zinc-200">
                        {r.n} <span className="text-zinc-500">({r.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold/40 to-gold/80"
                        style={{ width: `${Math.max(4, r.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base [font-family:var(--font-outfit),system-ui,sans-serif]">
              Plan mix
            </CardTitle>
            <CardDescription>Active subscription rows by tier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planErr ? (
              <p className="text-sm text-red-300">{planErr}</p>
            ) : planTotal === 0 ? (
              <p className="text-sm text-zinc-500">No active subscription rows.</p>
            ) : (
              [
                { label: "Advanced", n: byPlan.advanced, color: "from-gold/90 to-amber-600/80" },
                { label: "Pro", n: byPlan.pro, color: "from-amber-600/60 to-amber-800/60" },
                { label: "Basic", n: byPlan.basic, color: "from-zinc-500 to-zinc-700" },
              ].map((p) => (
                <div key={p.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-zinc-400">{p.label}</span>
                    <span className="text-white tabular-nums">
                      {p.n} <span className="text-zinc-500">({planPct(p.n)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800/80">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r", p.color)}
                      style={{ width: `${planPct(p.n)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader className="border-b border-border/60 bg-surface-elevated/10 px-4 py-5 sm:px-6">
          <CardTitle className="text-lg [font-family:var(--font-outfit),system-ui,sans-serif]">
            Full tenant register
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Every property in one place — subscription, HR footprint, and onboarding contacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-amber-200">Table unavailable until the error above is resolved.</p>
          ) : (
            <SuperadminTenantReportsTable rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
