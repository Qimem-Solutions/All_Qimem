import { createClient } from "@/lib/supabase/server";

export type PendingPlanRequestSummary = {
  id: string;
  requested_plan: string;
  current_plan: string | null;
  message: string | null;
  created_at: string;
};

export type SubscriptionPlanRequestRow = {
  id: string;
  tenant_id: string;
  requested_plan: string;
  current_plan: string | null;
  status: string;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
};

function mapRequest(r: Record<string, unknown>, tenantName: string | null, tenantSlug: string | null): SubscriptionPlanRequestRow {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    requested_plan: String(r.requested_plan),
    current_plan: (r.current_plan as string | null) ?? null,
    status: String(r.status),
    message: (r.message as string | null) ?? null,
    created_at: String(r.created_at),
    resolved_at: (r.resolved_at as string | null) ?? null,
    resolved_by: (r.resolved_by as string | null) ?? null,
    tenant_name: tenantName,
    tenant_slug: tenantSlug,
  };
}

export async function fetchPendingPlanRequestForTenant(
  tenantId: string,
): Promise<{ request: PendingPlanRequestSummary | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_plan_requests")
    .select("id, requested_plan, current_plan, message, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    if (
      error.message.toLowerCase().includes("column") ||
      error.message.includes("relation") ||
      error.message.includes("does not exist")
    ) {
      return { request: null, error: null };
    }
    return { request: null, error: error.message };
  }
  if (!data) {
    return { request: null, error: null };
  }
  return {
    request: {
      id: String((data as { id: string }).id),
      requested_plan: String((data as { requested_plan: string }).requested_plan),
      current_plan: (data as { current_plan: string | null }).current_plan ?? null,
      message: (data as { message: string | null }).message ?? null,
      created_at: String((data as { created_at: string }).created_at),
    },
    error: null,
  };
}

export async function fetchPendingPlanChangeRequestsForSuperadmin(): Promise<{
  rows: SubscriptionPlanRequestRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: reqs, error: rErr } = await supabase
    .from("subscription_plan_requests")
    .select("id, tenant_id, requested_plan, current_plan, status, message, created_at, resolved_at, resolved_by")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (rErr) {
    return { rows: [], error: rErr.message };
  }
  const list = (reqs ?? []) as Record<string, unknown>[];
  if (list.length === 0) {
    return { rows: [], error: null };
  }
  const tenantIds = [...new Set(list.map((r) => String(r.tenant_id)))];
  const { data: tenants, error: tErr } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .in("id", tenantIds);

  if (tErr) {
    return { rows: [], error: tErr.message };
  }
  const byId = new Map((tenants ?? []).map((t) => [t.id, t] as const));
  const rows = list.map((r) => {
    const t = byId.get(String(r.tenant_id));
    return mapRequest(r, t?.name ?? null, t?.slug ?? null);
  });
  return { rows, error: null };
}
