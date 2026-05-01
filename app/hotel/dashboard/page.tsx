import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchTenantName,
  fetchTenantPortfolio,
  fetchTenantSubscription,
  fetchHotelTenantSettings,
  type TenantPortfolio,
} from "@/lib/queries/tenant-data";
import { fetchJobRequisitions } from "@/lib/queries/hrms-extended";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import {
  StaffModulePicker,
  buildStaffModuleItems,
} from "@/components/hotel/staff-module-picker";
import { HotelPortfolioView } from "@/components/hotel/hotel-portfolio-view";

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
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Hotel portfolio
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Your account is not linked to a property. Ask a superadmin to set tenant_id on your
          profile.
        </p>
      </div>
    );
  }

  const isHotelAdmin = ctx.globalRole === "hotel_admin";

  if (!isHotelAdmin) {
    const [hrmsAccess, hrrmAccess] = await Promise.all([
      getServiceAccessForLayout(ctx, "hrms"),
      getServiceAccessForLayout(ctx, "hrrm"),
    ]);
    const modules = buildStaffModuleItems({ hrmsAccess, hrrmAccess });
    return <StaffModulePicker notice={notice} modules={modules} />;
  }

  const [
    { portfolio, error: pErr },
    { subscription, error: subErr },
    { name: fallbackName },
    { rows: jobRows, error: jobsErr },
    { settings: hotelSettings },
  ] = await Promise.all([
    fetchTenantPortfolio(tenantId),
    fetchTenantSubscription(tenantId),
    fetchTenantName(tenantId),
    fetchJobRequisitions(tenantId),
    fetchHotelTenantSettings(tenantId),
  ]);

  const openJobs = (jobRows ?? []).filter((j) => j.status === "open");

  const planLabel = subscription?.plan
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : null;

  const showNotice = notice ? (
    <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
      {notice}
    </p>
  ) : null;

  const displayPortfolio: TenantPortfolio = portfolio ?? {
    name: fallbackName ?? "Your property",
    slug: "—",
    description: null,
    cover_image_url: null,
    gallery_urls: [],
  };

  const contactPropertyName = hotelSettings?.name?.trim() || displayPortfolio.name;
  const contact = {
    propertyName: contactPropertyName,
    region: hotelSettings?.region?.trim() || null,
    phone: hotelSettings?.contact_phone ?? null,
    email: hotelSettings?.reservations_email ?? null,
    policiesNotes: hotelSettings?.policies_notes ?? null,
  };

  return (
    <div className="space-y-6">
      {showNotice}
      {pErr ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Could not load full property details: {pErr}
        </p>
      ) : null}
      <div>
        <h1 className="sr-only">Hotel portfolio</h1>
        <HotelPortfolioView
          tenantId={tenantId}
          portfolio={displayPortfolio}
          planLabel={planLabel}
          subscriptionStatus={subscription?.status ?? null}
          subError={subErr}
          openJobs={openJobs}
          jobsError={jobsErr}
          contact={contact}
        />
      </div>
    </div>
  );
}
