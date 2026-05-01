import { getUserContext } from "@/lib/queries/context";
import { fetchHotelTenantSettings } from "@/lib/queries/tenant-data";
import { HotelShell } from "@/components/layout/hotel-shell";
import { StaffModuleShell } from "@/components/layout/staff-module-shell";
import { tenantBrandInlineStyle } from "@/lib/theme/tenant-brand-color";
import { enforceExpiredSubscriptionForTenant } from "@/lib/subscriptions/subscription-expiry";

export default async function HotelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();

  if (ctx?.tenantId && ctx.globalRole !== "superadmin") {
    await enforceExpiredSubscriptionForTenant(ctx.tenantId);
  }

  let tenantName = "All Qimem";
  let logoUrl: string | null = null;
  let propertyTag = "PROPERTY";
  let primaryBrand: string | null = null;

  if (ctx?.tenantId) {
    const { settings } = await fetchHotelTenantSettings(ctx.tenantId);
    if (settings) {
      tenantName = settings.name || tenantName;
      logoUrl = settings.logo_url;
      propertyTag = settings.name ? settings.name.toUpperCase().slice(0, 28) : propertyTag;
      primaryBrand = settings.primary_brand_color;
    }
  }

  const tenantThemeStyle = primaryBrand ? tenantBrandInlineStyle(primaryBrand) : undefined;

  const displayName =
    ctx?.fullName?.trim() ||
    ctx?.email?.trim() ||
    "User";

  let userRoleLabel = "Staff";
  if (ctx?.globalRole === "hotel_admin") {
    userRoleLabel = "Hotel administrator";
  } else if (ctx?.globalRole === "hrms") {
    userRoleLabel = "HRMS";
  } else if (ctx?.globalRole === "hrrm") {
    userRoleLabel = "HRRM";
  } else if (ctx?.globalRole) {
    userRoleLabel = ctx.globalRole.replace(/_/g, " ");
  }

  const shell =
    ctx?.globalRole === "hotel_admin" ? (
      <HotelShell
        tenantName={tenantName}
        logoUrl={logoUrl}
        propertyTag={propertyTag}
        userName={displayName}
        userRoleLabel={userRoleLabel}
      >
        {children}
      </HotelShell>
    ) : (
      <StaffModuleShell tenantName={tenantName} logoUrl={logoUrl}>
        {children}
      </StaffModuleShell>
    );

  return (
    <div className="min-h-dvh" style={tenantThemeStyle}>
      {shell}
    </div>
  );
}
