import { createClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/queries/context";
import { type HrrmScope, type HrrmEffective, resolveEffective } from "@/lib/auth/hrrm-nav";

export async function fetchUserHrrmScope(
  userId: string,
  tenantId: string,
  globalRole: string | null,
): Promise<HrrmScope> {
  if (globalRole === "superadmin" || globalRole === "hotel_admin") {
    return "all";
  }
  if (globalRole === "hrrm") {
    return "all";
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("hrrm_scope, access_level")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("service", "hrrm")
    .maybeSingle();

  if (error || !data || data.access_level === "none") {
    return "all";
  }
  const s = (data as { hrrm_scope?: string | null }).hrrm_scope;
  if (s === "front_desk" || s === "inventory") return s;
  return "all";
}

export async function getHrrmLayoutModel(
  ctx: UserContext,
  cookieMode: string | undefined,
): Promise<{
  orgScope: HrrmScope;
  effective: HrrmEffective;
  canSwitch: boolean;
}> {
  const orgScope = await fetchUserHrrmScope(ctx.userId, ctx.tenantId!, ctx.globalRole);
  const effective = resolveEffective(orgScope, cookieMode);
  const canSwitch = orgScope === "all";
  return { orgScope, effective, canSwitch };
}
