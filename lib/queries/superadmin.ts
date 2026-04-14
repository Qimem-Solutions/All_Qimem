import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/queries/context";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  created_at: string;
  plan: string | null;
  subStatus: string | null;
  subCreatedAt: string | null;
};

export async function fetchSuperadminDashboardStats() {
  const supabase = await createClient();

  const [tenantsRes, employeesRes, subsRes] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }),
    supabase.from("employees").select("id", { count: "exact", head: true }),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  return {
    tenantCount: tenantsRes.count ?? 0,
    employeeCount: employeesRes.count ?? 0,
    activeSubscriptions: subsRes.count ?? 0,
    error:
      tenantsRes.error?.message ||
      employeesRes.error?.message ||
      subsRes.error?.message ||
      null,
  };
}

export async function fetchTenantsForSelect(): Promise<{
  rows: { id: string; name: string; slug: string }[];
  error: string | null;
}> {
  const ctx = await getUserContext();
  if (!ctx || ctx.globalRole !== "superadmin") {
    return { rows: [], error: null };
  }
  try {
    const sr = createServiceRoleClient();
    const { data, error } = await sr
      .from("tenants")
      .select("id, name, slug")
      .order("name", { ascending: true });
    if (error) return { rows: [], error: error.message };
    return { rows: data ?? [], error: null };
  } catch {
    return {
      rows: [],
      error:
        "SUPABASE_SERVICE_ROLE_KEY is missing in web/.env.local — add it so the hotel list and admin roster can load (Dashboard → API → service_role).",
    };
  }
}

export async function fetchTenantsWithSubscriptions(): Promise<{
  rows: TenantRow[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data: tenants, error: tErr } = await supabase
    .from("tenants")
    .select("id, name, slug, region, created_at")
    .order("created_at", { ascending: false });

  if (tErr) {
    return { rows: [], error: tErr.message };
  }

  const { data: subs, error: sErr } = await supabase
    .from("subscriptions")
    .select("tenant_id, plan, status, created_at")
    .order("created_at", { ascending: false });

  if (sErr) {
    return { rows: [], error: sErr.message };
  }

  const latestSubByTenant = new Map<
    string,
    { plan: string; status: string; created_at: string }
  >();
  for (const s of subs ?? []) {
    if (!latestSubByTenant.has(s.tenant_id)) {
      latestSubByTenant.set(s.tenant_id, {
        plan: s.plan,
        status: s.status,
        created_at: s.created_at ?? "",
      });
    }
  }

  const rows: TenantRow[] = (tenants ?? []).map((t) => {
    const sub = latestSubByTenant.get(t.id);
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      region: t.region,
      created_at: t.created_at ?? "",
      plan: sub?.plan ?? null,
      subStatus: sub?.status ?? null,
      subCreatedAt: sub?.created_at ?? null,
    };
  });

  return { rows, error: null };
}

export type ProfileAdminRow = {
  id: string;
  full_name: string | null;
  global_role: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
};

export async function fetchProfilesForAdminList(): Promise<{
  rows: ProfileAdminRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, global_role, tenant_id, created_at")
    .not("tenant_id", "is", null)
    .neq("global_role", "superadmin")
    .order("created_at", { ascending: false });

  if (error) return { rows: [], error: error.message };

  const tenantIds = [
    ...new Set((data ?? []).map((p) => p.tenant_id).filter(Boolean)),
  ] as string[];
  let tenantMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name")
      .in("id", tenantIds);
    tenantMap = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  }

  const rows: ProfileAdminRow[] = (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    global_role: p.global_role,
    tenant_id: p.tenant_id,
    tenant_name: p.tenant_id ? tenantMap.get(p.tenant_id) ?? null : null,
  }));

  return { rows, error: null };
}

export type AdminAssignmentRow = {
  source: "profile" | "provisioned";
  id: string;
  full_name: string | null;
  global_role: string | null;
  tenant_id: string;
  tenant_name: string | null;
  admin_email: string | null;
  status: "active" | "pending_invite";
  sort_at: string;
};

/**
 * Linked profiles (tenant_id set) plus tenants that recorded an admin at creation but have no
 * linked profile yet. Uses the service role after verifying superadmin so RLS / is_superadmin()
 * cannot hide rows from the dashboard.
 */
export async function fetchAdminsForSuperadmin(): Promise<{
  rows: AdminAssignmentRow[];
  error: string | null;
}> {
  const ctx = await getUserContext();
  if (!ctx || ctx.globalRole !== "superadmin") {
    return { rows: [], error: null };
  }

  let sr: ReturnType<typeof createServiceRoleClient>;
  try {
    sr = createServiceRoleClient();
  } catch {
    return {
      rows: [],
      error:
        "SUPABASE_SERVICE_ROLE_KEY is missing in web/.env.local — required to list hotel admins and hotels. Add the service_role secret from Supabase → Settings → API.",
    };
  }

  const { data: profiles, error: pErr } = await sr
    .from("profiles")
    .select("id, full_name, global_role, tenant_id, created_at")
    .not("tenant_id", "is", null)
    .neq("global_role", "superadmin")
    .order("created_at", { ascending: false });

  if (pErr) return { rows: [], error: pErr.message };

  const { data: tenants, error: tErr } = await sr
    .from("tenants")
    .select("id, name, initial_admin_email, initial_admin_name, created_at")
    .order("created_at", { ascending: false });

  if (tErr) {
    return {
      rows: [],
      error:
        tErr.message +
        (tErr.message.includes("column") || tErr.message.includes("schema cache")
          ? " — Run the latest Supabase migrations (tenant initial_admin columns)."
          : ""),
    };
  }

  const tenantNameMap = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  const tenantIdsWithProfile = new Set(
    (profiles ?? []).map((p) => p.tenant_id).filter(Boolean) as string[],
  );

  const rows: AdminAssignmentRow[] = [];

  for (const p of profiles ?? []) {
    if (!p.tenant_id) continue;
    rows.push({
      source: "profile",
      id: p.id,
      full_name: p.full_name,
      global_role: p.global_role,
      tenant_id: p.tenant_id,
      tenant_name: tenantNameMap.get(p.tenant_id) ?? null,
      admin_email: null,
      status: "active",
      sort_at: p.created_at ?? "",
    });
  }

  for (const t of tenants ?? []) {
    if (!t.initial_admin_email) continue;
    if (tenantIdsWithProfile.has(t.id)) continue;
    rows.push({
      source: "provisioned",
      id: `provisioned:${t.id}`,
      full_name: t.initial_admin_name,
      global_role: "hotel_admin",
      tenant_id: t.id,
      tenant_name: t.name,
      admin_email: t.initial_admin_email,
      status: "pending_invite",
      sort_at: t.created_at ?? "",
    });
  }

  await Promise.all(
    rows
      .filter((r) => r.source === "profile")
      .map(async (r) => {
        const { data } = await sr.auth.admin.getUserById(r.id);
        const email = data.user?.email ?? null;
        if (email) r.admin_email = email;
      }),
  );

  rows.sort((a, b) => (a.sort_at < b.sort_at ? 1 : a.sort_at > b.sort_at ? -1 : 0));

  return { rows, error: null };
}

export async function fetchSubscriptionPlansSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status");

  if (error) return { byPlan: {} as Record<string, number>, error: error.message };

  const byPlan: Record<string, number> = { basic: 0, pro: 0, advanced: 0 };
  for (const s of data ?? []) {
    if (s.status !== "active") continue;
    const p = s.plan as keyof typeof byPlan;
    if (p in byPlan) byPlan[p] += 1;
  }
  return { byPlan, error: null };
}

export type SubscriptionListRow = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  plan: string;
  status: string;
  created_at: string | null;
  current_period_end: string | null;
};

export async function fetchSubscriptionsWithTenants(): Promise<{
  rows: SubscriptionListRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: subs, error: sErr } = await supabase
    .from("subscriptions")
    .select("id, tenant_id, plan, status, created_at, current_period_end")
    .order("created_at", { ascending: false });

  if (sErr) return { rows: [], error: sErr.message };

  const tenantIds = [...new Set((subs ?? []).map((s) => s.tenant_id))];
  let nameMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name")
      .in("id", tenantIds);
    nameMap = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  }

  const rows: SubscriptionListRow[] = (subs ?? []).map((s) => ({
    id: s.id,
    tenant_id: s.tenant_id,
    tenant_name: nameMap.get(s.tenant_id) ?? null,
    plan: s.plan,
    status: s.status,
    created_at: s.created_at ?? null,
    current_period_end: s.current_period_end ?? null,
  }));

  return { rows, error: null };
}
