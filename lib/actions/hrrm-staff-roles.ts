"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/queries/context";
import type { HrrmScope } from "@/lib/auth/hrrm-nav";

type Ok = { ok: true } | { ok: false; error: string };

async function requireHotelAdmin() {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false as const, error: "Not signed in." };
  }
  if (ctx.globalRole !== "hotel_admin") {
    return { ok: false as const, error: "Only a hotel administrator can change staff HRRM roles." };
  }
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false as const, error: "Service role is not configured in .env.local." };
  }
  return { ok: true as const, admin, tenantId: ctx.tenantId };
}

export async function updateUserHrrmScopeAction(input: {
  userId: string;
  hrrmScope: HrrmScope;
}): Promise<Ok> {
  const g = await requireHotelAdmin();
  if (!g.ok) return g;
  if (g.tenantId == null) return { ok: false, error: "No tenant context." };
  const { error } = await g.admin
    .from("user_roles")
    .update({ hrrm_scope: input.hrrmScope === "all" ? null : input.hrrmScope })
    .eq("user_id", input.userId)
    .eq("tenant_id", g.tenantId)
    .eq("service", "hrrm");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hrrm/staff");
  revalidatePath("/hrrm/reservations");
  revalidatePath("/hrrm", "layout");
  return { ok: true };
}
