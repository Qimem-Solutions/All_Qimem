import { createServiceRoleClient } from "@/lib/supabase/admin";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export async function suspendTenantUsersForSubscriptionExpiry(
  sr: ServiceClient,
  tenantId: string,
): Promise<void> {
  const { data: profiles } = await sr
    .from("profiles")
    .select("id, global_role")
    .eq("tenant_id", tenantId);

  for (const p of profiles ?? []) {
    if (p.global_role === "superadmin") continue;
    await sr.auth.admin.updateUserById(p.id, { ban_duration: "876000h" }).catch(() => undefined);
  }
}

export async function reactivateTenantUsersAfterSubscriptionRenewal(
  sr: ServiceClient,
  tenantId: string,
): Promise<void> {
  const { data: profiles } = await sr
    .from("profiles")
    .select("id, global_role")
    .eq("tenant_id", tenantId);

  for (const p of profiles ?? []) {
    if (p.global_role === "superadmin") continue;
    await sr.auth.admin.updateUserById(p.id, { ban_duration: "none" }).catch(() => undefined);
  }
}

/** Latest subscription row for tenant: if active and period end passed, mark inactive and ban users. */
export async function enforceExpiredSubscriptionForTenant(tenantId: string): Promise<void> {
  let sr: ServiceClient;
  try {
    sr = createServiceRoleClient();
  } catch {
    return;
  }

  const { data: sub } = await sr
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.current_period_end) return;
  if (sub.status !== "active") return;
  const endMs = new Date(sub.current_period_end).getTime();
  if (Number.isNaN(endMs) || endMs > Date.now()) return;

  await sr.from("subscriptions").update({ status: "inactive" }).eq("id", sub.id);
  await suspendTenantUsersForSubscriptionExpiry(sr, tenantId);
}

/** Superadmin subscriptions page: expire every overdue active subscription (requires service role). */
export async function sweepAllExpiredSubscriptions(): Promise<number> {
  let sr: ServiceClient;
  try {
    sr = createServiceRoleClient();
  } catch {
    return 0;
  }

  const nowIso = new Date().toISOString();
  const { data: subs } = await sr
    .from("subscriptions")
    .select("id, tenant_id, status, current_period_end")
    .eq("status", "active")
    .not("current_period_end", "is", null)
    .lt("current_period_end", nowIso);

  let n = 0;
  for (const s of subs ?? []) {
    await sr.from("subscriptions").update({ status: "inactive" }).eq("id", s.id);
    await suspendTenantUsersForSubscriptionExpiry(sr, s.tenant_id);
    n++;
  }
  return n;
}
