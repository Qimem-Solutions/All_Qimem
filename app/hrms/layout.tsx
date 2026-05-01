import { redirect } from "next/navigation";
import { HrmsShell } from "@/components/layout/hrms-shell";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { displayNameFromProfile, globalRoleLabel } from "@/lib/auth/user-display";
import { enforceExpiredSubscriptionForTenant } from "@/lib/subscriptions/subscription-expiry";
import { fetchHotelTenantSettings } from "@/lib/queries/tenant-data";
import { tenantBrandInlineStyle } from "@/lib/theme/tenant-brand-color";

export default async function HrmsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  if (ctx.tenantId && ctx.globalRole !== "superadmin") {
    await enforceExpiredSubscriptionForTenant(ctx.tenantId);
  }

  const access = await getServiceAccessForLayout(ctx, "hrms");
  if (access === "none") {
    redirect(
      "/hotel/dashboard?notice=" +
        encodeURIComponent("No access to HRMS. Ask your hotel admin to grant access."),
    );
  }

  const userBlock = {
    name: displayNameFromProfile(ctx.fullName, ctx.email),
    role: globalRoleLabel(ctx.globalRole),
  };

  let tenantName = "All Qimem";
  let propertyTag = "PROPERTY";
  let tenantThemeStyle = undefined;
  if (ctx.tenantId) {
    const { settings } = await fetchHotelTenantSettings(ctx.tenantId);
    if (settings) {
      tenantName = settings.name || tenantName;
      propertyTag = settings.name ? settings.name.toUpperCase().slice(0, 28) : propertyTag;
    }
    const primary = settings?.primary_brand_color;
    tenantThemeStyle = primary ? tenantBrandInlineStyle(primary) : undefined;
  }

  return (
    <div className="min-h-dvh" style={tenantThemeStyle}>
      <HrmsShell
        readOnly={access === "view"}
        userBlock={userBlock}
        showBackToHome={ctx.globalRole === "hotel_admin"}
        tenantName={tenantName}
        propertyTag={propertyTag}
      >
        {children}
      </HrmsShell>
    </div>
  );
}
