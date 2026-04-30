import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/queries/context";
import { toUserFacingError } from "@/lib/errors/user-facing";

export type HotelAdminProfileChangeRequestListRow = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  requester_user_id: string;
  requester_full_name: string | null;
  payload: unknown;
  created_at: string;
};

/** Superadmin queue: pending self-service profile updates from hotel admins. */
export async function fetchPendingHotelAdminProfileChangeRequestsForSuperadmin(): Promise<{
  rows: HotelAdminProfileChangeRequestListRow[];
  error: string | null;
}> {
  const ctx = await getUserContext();
  if (!ctx || ctx.globalRole !== "superadmin") {
    return { rows: [], error: null };
  }
  try {
    const sr = createServiceRoleClient();
    const { data: reqs, error } = await sr
      .from("hotel_admin_profile_change_requests")
      .select("id, tenant_id, requester_user_id, payload, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      return { rows: [], error: toUserFacingError(error.message) };
    }
    const list = reqs ?? [];
    if (list.length === 0) {
      return { rows: [], error: null };
    }

    const tenantIds = [...new Set(list.map((r) => r.tenant_id as string))];
    const userIds = [...new Set(list.map((r) => r.requester_user_id as string))];

    const [{ data: tenants }, { data: profs }] = await Promise.all([
      sr.from("tenants").select("id, name, slug").in("id", tenantIds),
      sr.from("profiles").select("id, full_name").in("id", userIds),
    ]);

    const tenantMap = new Map((tenants ?? []).map((t) => [t.id as string, t]));
    const profMap = new Map((profs ?? []).map((p) => [p.id as string, p]));

    const rows: HotelAdminProfileChangeRequestListRow[] = list.map((r) => {
      const tid = r.tenant_id as string;
      const uid = r.requester_user_id as string;
      const t = tenantMap.get(tid);
      const p = profMap.get(uid);
      return {
        id: r.id as string,
        tenant_id: tid,
        tenant_name: (t?.name as string | undefined) ?? null,
        tenant_slug: (t?.slug as string | undefined) ?? null,
        requester_user_id: uid,
        requester_full_name: (p?.full_name as string | undefined) ?? null,
        payload: r.payload,
        created_at: (r.created_at as string) ?? "",
      };
    });

    return { rows, error: null };
  } catch (e) {
    return {
      rows: [],
      error:
        e instanceof Error
          ? e.message
          : "Could not load requests (check SUPABASE_SERVICE_ROLE_KEY).",
    };
  }
}

/** Banner on hotel users page when the signed-in hotel admin already has a pending request. */
export async function fetchSelfPendingHotelAdminProfileRequest(
  tenantId: string,
  userId: string,
): Promise<{ row: { id: string; created_at: string } | null; error: string | null }> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.userId !== userId || ctx.tenantId !== tenantId) {
    return { row: null, error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hotel_admin_profile_change_requests")
    .select("id, created_at")
    .eq("tenant_id", tenantId)
    .eq("requester_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    return { row: null, error: toUserFacingError(error.message) };
  }
  if (!data) {
    return { row: null, error: null };
  }
  return {
    row: { id: data.id as string, created_at: (data.created_at as string) ?? "" },
    error: null,
  };
}
