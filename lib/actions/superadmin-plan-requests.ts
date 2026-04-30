"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createClient } from "@/lib/supabase/server";
import { toUserFacingError } from "@/lib/errors/user-facing";

type Result = { ok: true; message: string } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/superadmin/subscriptions");
  revalidatePath("/superadmin/billing");
  revalidatePath("/hotel/subscription");
  revalidatePath("/hotel/dashboard");
}

export async function approvePlanChangeRequestAction(requestId: string): Promise<Result> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Not authorized." };
  }
  if (!requestId) {
    return { ok: false, error: "Missing request." };
  }

  const supabase = await createClient();
  const { data: req, error: fetchErr } = await supabase
    .from("subscription_plan_requests")
    .select("id, tenant_id, requested_plan, status")
    .eq("id", requestId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: toUserFacingError(fetchErr.message) };
  }
  if (!req) {
    return { ok: false, error: "Request not found or already resolved." };
  }

  const tenantId = String((req as { tenant_id: string }).tenant_id);
  const newPlan = String((req as { requested_plan: string }).requested_plan);

  const { data: subRows, error: subErr } = await supabase
    .from("subscriptions")
    .update({ plan: newPlan })
    .eq("tenant_id", tenantId)
    .select("id");

  if (subErr) {
    return { ok: false, error: toUserFacingError(subErr.message) };
  }
  if (!subRows?.length) {
    return {
      ok: false,
      error: "No subscription row for that tenant. Create billing before approving.",
    };
  }

  const now = new Date().toISOString();
  const { error: reqErr } = await supabase
    .from("subscription_plan_requests")
    .update({
      status: "approved",
      resolved_at: now,
      resolved_by: ctx.userId,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (reqErr) {
    return { ok: false, error: toUserFacingError(reqErr.message) };
  }

  revalidateAll();
  return { ok: true, message: "Plan change approved and applied." };
}

export async function rejectPlanChangeRequestAction(requestId: string): Promise<Result> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Not authorized." };
  }
  if (!requestId) {
    return { ok: false, error: "Missing request." };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("subscription_plan_requests")
    .update({
      status: "rejected",
      resolved_at: now,
      resolved_by: ctx.userId,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) {
    return { ok: false, error: toUserFacingError(error.message) };
  }
  if (!data?.length) {
    return { ok: false, error: "Request not found or already resolved." };
  }

  revalidateAll();
  return { ok: true, message: "Request rejected." };
}
