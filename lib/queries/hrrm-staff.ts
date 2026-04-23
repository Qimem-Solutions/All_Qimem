import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { HrrmScope } from "@/lib/auth/hrrm-nav";

export type HrrmStaffRow = {
  user_id: string;
  full_name: string | null;
  access_level: string;
  hrrm_scope: HrrmScope;
};

/**
 * HRRM-assigned property staff (any access level other than none).
 */
export async function fetchHrrmStaffList(tenantId: string): Promise<{
  rows: HrrmStaffRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("user_id, access_level, hrrm_scope")
    .eq("tenant_id", tenantId)
    .eq("service", "hrrm")
    .neq("access_level", "none");
  if (rErr) return { rows: [], error: rErr.message };
  if (!roles?.length) return { rows: [], error: null };

  const ids = roles.map((r) => r.user_id);
  /** RLS only allows reading your own profile with the user JWT; load peer names with service role (tenant-scoped). */
  let profileDb = supabase;
  try {
    profileDb = createServiceRoleClient();
  } catch {
    /* missing SUPABASE_SERVICE_ROLE_KEY — names may show as — */
  }
  const { data: profiles, error: pErr } = await profileDb
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  if (pErr) return { rows: [], error: pErr.message };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name?.trim() || null]));

  const rows: HrrmStaffRow[] = roles.map((r) => {
    const raw = (r as { hrrm_scope?: string | null }).hrrm_scope;
    const hrrm_scope: HrrmScope =
      raw === "front_desk" || raw === "inventory" ? raw : "all";
    return {
      user_id: r.user_id,
      full_name: nameMap.get(r.user_id) ?? null,
      access_level: r.access_level,
      hrrm_scope,
    };
  });
  return { rows, error: null };
}
