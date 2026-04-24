import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchHrrmDashboardCounts,
  fetchHrmsDashboardStats,
  fetchHrmsReportsAnalytics,
  fetchReservationStats,
  fetchRoomHousekeepingAggregate,
  fetchTenantSubscription,
  fetchTenantUsersWithRoles,
} from "@/lib/queries/tenant-data";
import { formatDate } from "@/lib/format";

export default async function HotelReportsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "hotel_admin") {
    redirect("/hotel/dashboard");
  }
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Hotel reports
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Your account is not linked to a property. Ask a platform admin to assign a tenant to load
          reports.
        </p>
      </div>
    );
  }

  const [hrmsKpis, hrmsAnalytics, hrrmKpis, reservationStats, housekeeping, users, subscription] =
    await Promise.all([
      fetchHrmsDashboardStats(tenantId),
      fetchHrmsReportsAnalytics(tenantId),
      fetchHrrmDashboardCounts(tenantId),
      fetchReservationStats(tenantId),
      fetchRoomHousekeepingAggregate(tenantId),
      fetchTenantUsersWithRoles(tenantId),
      fetchTenantSubscription(tenantId),
    ]);

  const allErrors = [
    hrmsKpis.error,
    hrmsAnalytics.error,
    hrrmKpis.error,
    reservationStats.error,
    housekeeping.error,
    users.error,
    subscription.error,
  ].filter(Boolean);

  const activeUsers = users.rows.filter(
    (u) => u.hrms_access !== "none" || u.hrrm_access !== "none" || u.global_role === "hotel_admin",
  ).length;
  const hrmsManagers = users.rows.filter((u) => u.hrms_access === "manage").length;
  const hrrmManagers = users.rows.filter((u) => u.hrrm_access === "manage").length;

  const activeDepts = hrmsAnalytics.departments.filter((d) => d.is_active !== false).length;
  const topDepts = [...hrmsAnalytics.departments]
    .sort((a, b) => b.employee_count - a.employee_count)
    .slice(0, 5);
  const maxDept = Math.max(1, ...topDepts.map((d) => d.employee_count));

  const houseRows = Object.entries(housekeeping.byHousekeeping)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Hotel reports
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Cross-module reporting for this property. Combines HRMS workforce KPIs, HRRM operations,
            user access coverage, and subscription posture in one page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="gold">HRMS</Badge>
          <Badge tone="gold">HRRM</Badge>
          <Badge tone="gold">Users</Badge>
          <Badge tone="gold">Subscription</Badge>
        </div>
      </div>

      {allErrors.length > 0 ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {allErrors.join(" ")}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{hrmsKpis.employeeCount}</p>
            <p className="mt-1 text-xs text-zinc-500">HRMS employee directory rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Reservation load
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{reservationStats.activeBookings}</p>
            <p className="mt-1 text-xs text-zinc-500">Non-canceled bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Rooms / OOO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">
              {hrrmKpis.roomCount} <span className="text-base text-zinc-500">/ {housekeeping.outOfOrder}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">Total rooms / out-of-order</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Active users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{activeUsers}</p>
            <p className="mt-1 text-xs text-zinc-500">With hotel_admin or module access</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>HRMS workforce summary</CardTitle>
            <CardDescription>
              Departments, shifts, and attendance from HRMS services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Departments</p>
                <p className="mt-1 text-xl font-semibold text-white">{activeDepts}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Shifts today</p>
                <p className="mt-1 text-xl font-semibold text-white">{hrmsKpis.shiftsToday}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Punches today</p>
                <p className="mt-1 text-xl font-semibold text-white">{hrmsKpis.punchesToday}</p>
              </div>
            </div>

            {topDepts.length === 0 ? (
              <p className="text-sm text-zinc-500">No departments yet.</p>
            ) : (
              <div className="space-y-3">
                {topDepts.map((d) => {
                  const pct = Math.round((d.employee_count / Math.max(1, hrmsAnalytics.totalEmployees)) * 100);
                  const w = Math.max(6, (d.employee_count / maxDept) * 100);
                  return (
                    <div key={d.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-zinc-300">{d.name}</span>
                        <span className="text-zinc-500">{d.employee_count} staff · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800">
                        <div className="h-2 rounded-full bg-gold/70" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module access coverage</CardTitle>
            <CardDescription>Who can manage each microservice module.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
              <span className="text-zinc-400">HRMS managers</span>
              <span className="font-semibold text-white">{hrmsManagers}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
              <span className="text-zinc-400">HRRM managers</span>
              <span className="font-semibold text-white">{hrrmManagers}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
              <span className="text-zinc-400">Total profiles</span>
              <span className="font-semibold text-white">{users.rows.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>HRRM operations summary</CardTitle>
            <CardDescription>
              Reservations, arrivals/departures, and housekeeping distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Guests</p>
                <p className="mt-1 text-xl font-semibold text-white">{hrrmKpis.guestCount}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Check-ins today</p>
                <p className="mt-1 text-xl font-semibold text-white">{reservationStats.checkInsToday}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Departures today</p>
                <p className="mt-1 text-xl font-semibold text-white">{reservationStats.departuresToday}</p>
              </div>
            </div>

            {houseRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No room housekeeping data yet.</p>
            ) : (
              <div className="space-y-3">
                {houseRows.map(([status, count]) => {
                  const w = Math.max(6, (count / Math.max(1, housekeeping.total)) * 100);
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="capitalize text-zinc-300">{status.replaceAll("_", " ")}</span>
                        <span className="text-zinc-500">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800">
                        <div className="h-2 rounded-full bg-emerald-500/70" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription posture</CardTitle>
            <CardDescription>Billing tier and renewal metadata for this tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Plan</span>
              <span className="capitalize text-white">{subscription.subscription?.plan ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Status</span>
              <Badge tone={subscription.subscription?.status === "active" ? "green" : "gray"}>
                {subscription.subscription?.status ?? "unknown"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Period end</span>
              <span className="text-zinc-300">
                {formatDate(subscription.subscription?.current_period_end ?? null)}
              </span>
            </div>
            <Link
              href="/hotel/subscription"
              className="mt-2 inline-flex text-sm font-medium text-gold hover:text-gold-dim"
            >
              Open subscription details →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
