import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Lock, Users } from "lucide-react";
import { getUserContext } from "@/lib/queries/context";
import { fetchTenantSubscription } from "@/lib/queries/tenant-data";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import {
  StaffModulePicker,
  buildStaffModuleItems,
} from "@/components/hotel/staff-module-picker";

export default async function HotelDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const sp = await searchParams;
  const notice = sp.notice ? decodeURIComponent(sp.notice) : null;
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Hotel dashboard
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Your account is not linked to a property. Ask a superadmin to set tenant_id on your
          profile.
        </p>
      </div>
    );
  }

  const [{ subscription, error }, hrmsAccess, hrrmAccess] = await Promise.all([
    fetchTenantSubscription(tenantId),
    getServiceAccessForLayout(ctx, "hrms"),
    getServiceAccessForLayout(ctx, "hrrm"),
  ]);
  const plan = (subscription?.plan ?? "").toLowerCase();
  const isAdvanced = plan === "advanced";

  const isHotelAdmin = ctx.globalRole === "hotel_admin";

  if (!isHotelAdmin) {
    const modules = buildStaffModuleItems({ hrmsAccess, hrrmAccess });
    return <StaffModulePicker notice={notice} modules={modules} />;
  }

  const modules = [
    {
      title: "HRMS",
      desc: "Employee directory, org structure, scheduling, attendance.",
      href: "/hrms/dashboard",
      locked: hrmsAccess === "none",
      badge:
        hrmsAccess === "none"
          ? "No access"
          : hrmsAccess === "view"
            ? "View only"
            : "Subscribed",
    },
    {
      title: "HRRM",
      desc: "Reservations, inventory, rates, front desk, housekeeping.",
      href: "/hrrm/dashboard",
      locked: hrrmAccess === "none",
      badge:
        hrrmAccess === "none"
          ? "No access"
          : hrrmAccess === "view"
            ? "View only"
            : "Subscribed",
    },
    {
      title: "Cross-service analytics",
      desc: "Advanced reporting across HRMS and HRRM.",
      href: "/hotel/reports",
      locked: !isAdvanced,
      badge: isAdvanced ? "Advanced tier" : "Advanced tier",
    },
  ] as const;

  return (
    <div className="space-y-8">
      {notice ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {notice}
        </p>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Hotel dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Open HRMS and HRRM from the module cards below; other hotel tools stay in the sidebar.
          Modules reflect subscription entitlements and your assigned roles.
          {error ? (
            <span className="ml-2 text-amber-400">({error})</span>
          ) : subscription ? (
            <span className="ml-2 text-zinc-400">
              Current plan: <span className="text-gold capitalize">{subscription.plan}</span> (
              {subscription.status})
            </span>
          ) : (
            <span className="ml-2 text-zinc-400">No subscription row found for this tenant.</span>
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((m) => {
          const inner = (
            <Card
              className={`h-full ${m.locked ? "opacity-60" : "transition-colors hover:border-gold/40"}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    {m.title === "HRMS" ? (
                      <Users className="h-5 w-5 text-gold" />
                    ) : m.title === "HRRM" ? (
                      <BedDouble className="h-5 w-5 text-gold" />
                    ) : (
                      <Lock className="h-5 w-5 text-zinc-500" />
                    )}
                    {m.title}
                  </CardTitle>
                  <Badge tone={m.locked ? "gray" : "gold"}>{m.badge}</Badge>
                </div>
                <CardDescription>{m.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-gold">
                  {m.locked ? "Upgrade to unlock" : "Open module →"}
                </span>
              </CardContent>
            </Card>
          );
          return m.locked ? (
            <div key={m.title}>{inner}</div>
          ) : (
            <Link key={m.title} href={m.href}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
