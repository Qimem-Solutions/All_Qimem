"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { reactivateTenantUsersAfterSubscriptionRenewal } from "@/lib/subscriptions/subscription-expiry";
import { billingServiceMonthFromPeriodEndIso } from "@/lib/subscriptions/billing-period";
import { toUserFacingError } from "@/lib/errors/user-facing";

const PLANS = new Set(["basic", "pro", "advanced"]);

export type SubscriptionActionResult = { ok: true } | { ok: false; error: string };

function revalidateSubscriptionSurfaces() {
  revalidatePath("/superadmin/subscriptions");
  revalidatePath("/superadmin/billing");
  revalidatePath("/superadmin/dashboard");
  revalidatePath("/superadmin/tenants");
  revalidatePath("/hotel/subscription");
  revalidatePath("/hotel/dashboard");
}

export async function superadminUpdateSubscriptionPlanAction(input: {
  subscriptionId: string;
  plan: string;
}): Promise<SubscriptionActionResult> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can change subscription plans." };
  }

  const subscriptionId = input.subscriptionId.trim();
  const plan = input.plan.trim().toLowerCase();
  if (!subscriptionId) {
    return { ok: false, error: "Missing subscription." };
  }
  if (!PLANS.has(plan)) {
    return { ok: false, error: "Plan must be basic, pro, or advanced." };
  }

  let sr: ReturnType<typeof createServiceRoleClient>;
  try {
    sr = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      error:
        "This action isn’t available because the server isn’t fully configured. Please contact your platform administrator.",
    };
  }

  const { data: row, error: fetchErr } = await sr
    .from("subscriptions")
    .select("id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return {
      ok: false,
      error: fetchErr ? toUserFacingError(fetchErr.message) : "We couldn’t find that subscription.",
    };
  }

  const { error: updErr } = await sr.from("subscriptions").update({ plan }).eq("id", subscriptionId);
  if (updErr) {
    return { ok: false, error: toUserFacingError(updErr.message) };
  }

  revalidateSubscriptionSurfaces();
  return { ok: true };
}

/**
 * Extends `current_period_end` by one month from the later of (existing end, now),
 * sets status to active, and lifts Auth bans for all users on that tenant.
 */
export async function superadminExtendSubscriptionPeriodOneMonthAction(
  subscriptionId: string,
): Promise<SubscriptionActionResult> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can extend billing periods." };
  }

  const id = subscriptionId.trim();
  if (!id) {
    return { ok: false, error: "Missing subscription." };
  }

  let sr: ReturnType<typeof createServiceRoleClient>;
  try {
    sr = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      error:
        "This action isn’t available because the server isn’t fully configured. Please contact your platform administrator.",
    };
  }

  const { data: sub, error: fetchErr } = await sr
    .from("subscriptions")
    .select("id, tenant_id, current_period_end, plan")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !sub) {
    return {
      ok: false,
      error: fetchErr ? toUserFacingError(fetchErr.message) : "We couldn’t find that subscription.",
    };
  }

  const tenantId = sub.tenant_id as string;
  const now = Date.now();
  let base = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  if (Number.isNaN(base.getTime())) {
    base = new Date();
  }
  if (base.getTime() < now) {
    base = new Date();
  }

  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + 1);
  const newEndIso = newEnd.toISOString();
  const plan = String(sub.plan ?? "basic");

  const { data: billIns, error: billErr } = await sr
    .from("subscription_billing_events")
    .insert({
      tenant_id: tenantId,
      subscription_id: id,
      service_month: billingServiceMonthFromPeriodEndIso(newEndIso),
      plan,
      source: "period_extension",
    })
    .select("id")
    .single();

  if (billErr) {
    return { ok: false, error: toUserFacingError(billErr.message) };
  }

  const { error: updErr } = await sr
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: newEndIso,
    })
    .eq("id", id);

  if (updErr) {
    const bid = billIns?.id as string | undefined;
    if (bid) await sr.from("subscription_billing_events").delete().eq("id", bid);
    return { ok: false, error: toUserFacingError(updErr.message) };
  }

  await reactivateTenantUsersAfterSubscriptionRenewal(sr, tenantId);

  revalidateSubscriptionSurfaces();
  return { ok: true };
}
