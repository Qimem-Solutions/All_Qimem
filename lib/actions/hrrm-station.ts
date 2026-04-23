"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchUserHrrmScope } from "@/lib/auth/hrrm-station.server";
import type { HrrmScope } from "@/lib/auth/hrrm-nav";

const COOKIE = "hrrm_workstation" as const;

type Ok = { ok: true } | { ok: false; error: string };

function cookieOptions() {
  return {
    path: "/hrrm",
    maxAge: 60 * 60 * 24 * 90,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * For users with org HRRM scope "all" (e.g. hotel admin), store preferred workstation
 * (full app, front desk, or inventory) for filtered navigation.
 */
export async function setHrrmWorkstationModeAction(mode: "all" | "front_desk" | "inventory"): Promise<Ok> {
  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return { ok: false, error: "Not signed in." };
  }
  const org = await fetchUserHrrmScope(ctx.userId, ctx.tenantId, ctx.globalRole);
  if (org !== "all") {
    return { ok: false, error: "Your account has a fixed role; you cannot change workstation here." };
  }
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access === "none") {
    return { ok: false, error: "No HRRM access." };
  }
  const store = await cookies();
  store.set(COOKIE, mode, cookieOptions());
  revalidatePath("/hrrm", "layout");
  return { ok: true };
}

export async function clearHrrmWorkstationCookieAction(): Promise<Ok> {
  const store = await cookies();
  store.delete(COOKIE);
  revalidatePath("/hrrm", "layout");
  return { ok: true };
}
