"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/queries/context";
import { createClient } from "@/lib/supabase/server";

const PLANS = ["basic", "pro", "advanced"] as const;
export type HotelSubscriptionPlan = (typeof PLANS)[number];

const PATHS = ["/hotel/subscription", "/hotel/dashboard"] as const;

type Ok = { ok: true } | { ok: false; error: string };

function revalidate() {
  for (const p of PATHS) revalidatePath(p);
}

export async function updateHotelSubscriptionPlanAction(input: {
  plan: string;
}): Promise<Ok> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "hotel_admin" || !ctx.tenantId) {
    return { ok: false, error: "Only a property hotel administrator can change the subscription." };
  }

  const plan = input.plan.trim().toLowerCase();
  if (!PLANS.includes(plan as HotelSubscriptionPlan)) {
    return { ok: false, error: "Invalid plan." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ plan })
    .eq("tenant_id", ctx.tenantId)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return {
      ok: false,
      error: "No subscription row found for this property. Ask a platform admin to set up billing first.",
    };
  }

  revalidate();
  return { ok: true };
}
