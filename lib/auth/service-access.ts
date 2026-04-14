import { createClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/queries/context";

export type ServiceAccessLevel = "none" | "view" | "manage";

/**
 * Resolves HRMS/HRRM access for route layouts.
 * Hotel admins and legacy global_role hrms/hrrm users get full manage access.
 */
export async function getServiceAccessForLayout(
  ctx: UserContext,
  service: "hrms" | "hrrm",
): Promise<ServiceAccessLevel> {
  if (ctx.globalRole === "superadmin" || ctx.globalRole === "hotel_admin") {
    return "manage";
  }
  if (service === "hrms" && ctx.globalRole === "hrms") return "manage";
  if (service === "hrrm" && ctx.globalRole === "hrrm") return "manage";
  if (!ctx.tenantId) return "none";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("access_level")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("service", service)
    .maybeSingle();

  if (error || !data?.access_level) return "none";
  const level = data.access_level as string;
  if (level === "view" || level === "manage" || level === "none") {
    return level;
  }
  return "none";
}
