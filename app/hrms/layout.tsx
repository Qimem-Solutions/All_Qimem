import { redirect } from "next/navigation";
import { HrmsShell } from "@/components/layout/hrms-shell";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { displayNameFromProfile, globalRoleLabel } from "@/lib/auth/user-display";
import { enforceExpiredSubscriptionForTenant } from "@/lib/subscriptions/subscription-expiry";

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

  return (
    <HrmsShell readOnly={access === "view"} userBlock={userBlock}>
      {children}
    </HrmsShell>
  );
}
