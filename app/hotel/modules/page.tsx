import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchTenantSubscription } from "@/lib/queries/tenant-data";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { HotelAdminModuleCards } from "@/components/hotel/hotel-admin-module-cards";

export default async function HotelModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "hotel_admin") {
    redirect("/hotel/dashboard");
  }

  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Modules
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Your account is not linked to a property. Ask a superadmin to set tenant_id on your
          profile.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const notice = sp.notice ? decodeURIComponent(sp.notice) : null;

  const [{ subscription, error }, hrmsAccess, hrrmAccess] = await Promise.all([
    fetchTenantSubscription(tenantId),
    getServiceAccessForLayout(ctx, "hrms"),
    getServiceAccessForLayout(ctx, "hrrm"),
  ]);
  const plan = (subscription?.plan ?? "").toLowerCase();
  const isAdvanced = plan === "advanced";

  return (
    <div className="space-y-8">
      {notice ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {notice}
        </p>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Modules
        </h1>
        <p className="mt-1 text-sm text-muted">
          Open HRMS and HRRM from the module cards below; return to the{" "}
          <Link href="/hotel/dashboard" className="text-gold underline-offset-2 hover:underline">
            portfolio
          </Link>{" "}
          for your property story and photo. Entitlements follow subscription and your roles.
          {error ? (
            <span className="ml-2 text-amber-600 dark:text-amber-400">({error})</span>
          ) : subscription ? (
            <span className="ml-2 text-muted">
              Plan: <span className="text-gold capitalize">{subscription.plan}</span> (
              {subscription.status})
            </span>
          ) : (
            <span className="ml-2 text-muted">No subscription row for this tenant.</span>
          )}
        </p>
      </div>

      <HotelAdminModuleCards hrmsAccess={hrmsAccess} hrrmAccess={hrrmAccess} isAdvanced={isAdvanced} />
    </div>
  );
}
