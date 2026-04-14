import type { UserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";

/** Hotel admins, legacy HR roles, and user_roles.hrms access_level = manage. */
export async function canManageHrStaff(ctx: UserContext): Promise<boolean> {
  if (!ctx.tenantId) return false;
  const level = await getServiceAccessForLayout(ctx, "hrms");
  return level === "manage";
}
