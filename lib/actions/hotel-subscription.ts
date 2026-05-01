"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createClient } from "@/lib/supabase/server";
import { toUserFacingError } from "@/lib/errors/user-facing";

const PLANS = ["basic", "pro", "advanced"] as const;
export type HotelSubscriptionPlan = (typeof PLANS)[number];

const PATHS = ["/hotel/subscription", "/hotel/dashboard"] as const;

type Ok = { ok: true } | { ok: false; error: string };

function revalidate() {
  for (const p of PATHS) revalidatePath(p);
}

/**
 * Hotel admin requests a plan change; superadmin approves in the platform console.
 * Does not modify `subscriptions` until approved.
 */
export async function requestHotelPlanChangeAction(input: {
  plan: string;
  message?: string;
}): Promise<Ok> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "hotel_admin" || !ctx.tenantId) {
    return { ok: false, error: "Only a property hotel administrator can request a plan change." };
  }

  const plan = input.plan.trim().toLowerCase();
  if (!PLANS.includes(plan as HotelSubscriptionPlan)) {
    return { ok: false, error: "Invalid plan." };
  }

  const message = (input.message ?? "").trim() || null;
  const supabase = await createClient();

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) {
    return { ok: false, error: toUserFacingError(subErr.message) };
  }
  if (!sub) {
    return {
      ok: false,
      error:
        "No subscription row found for this property. Ask a platform admin to provision billing before requesting a plan change.",
    };
  }

  const currentPlan = (sub.plan as string).toLowerCase();
  if (currentPlan === plan) {
    return { ok: false, error: "Choose a different plan than your current one, or wait for a pending request to be processed." };
  }

  const { data: existing, error: exErr } = await supabase
    .from("subscription_plan_requests")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pending")
    .maybeSingle();

  if (exErr) {
    return { ok: false, error: toUserFacingError(exErr.message) };
  }

  const payload = {
    requested_plan: plan,
    current_plan: currentPlan,
    message,
    status: "pending" as const,
  };

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from("subscription_plan_requests")
      .update({
        requested_plan: plan,
        current_plan: currentPlan,
        message,
      })
      .eq("id", existing.id)
      .eq("status", "pending");
    if (upErr) {
      return { ok: false, error: toUserFacingError(upErr.message) };
    }
  } else {
    const { error: insErr } = await supabase.from("subscription_plan_requests").insert({
      tenant_id: ctx.tenantId,
      ...payload,
    });
    if (insErr) {
      return { ok: false, error: toUserFacingError(insErr.message) };
    }
  }

  revalidatePath("/superadmin/subscriptions");
  revalidate();
  return { ok: true };
}
