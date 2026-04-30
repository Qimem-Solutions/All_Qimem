import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HrrmAppChrome } from "@/components/layout/hrrm-app-chrome";
import { getHrrmLayoutModel } from "@/lib/auth/hrrm-station.server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { enforceExpiredSubscriptionForTenant } from "@/lib/subscriptions/subscription-expiry";

export default async function HrrmLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  if (ctx.tenantId && ctx.globalRole !== "superadmin") {
    await enforceExpiredSubscriptionForTenant(ctx.tenantId);
  }

  if (!ctx.tenantId) {
    redirect(
      "/hotel/dashboard?notice=" + encodeURIComponent("Select a property to use HRRM."),
    );
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access === "none") {
    redirect(
      "/hotel/dashboard?notice=" +
        encodeURIComponent("No access to HRRM. Ask your hotel admin to grant access."),
    );
  }
  const cookieStore = await cookies();
  const workstationCookie = cookieStore.get("hrrm_workstation")?.value;
  const model = await getHrrmLayoutModel(ctx, workstationCookie);

  return (
    <HrrmAppChrome
      readOnly={access === "view"}
      orgScope={model.orgScope}
      effective={model.effective}
      canSwitch={model.canSwitch}
    >
      {children}
    </HrrmAppChrome>
  );
}
