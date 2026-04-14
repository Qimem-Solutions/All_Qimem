"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";

export type CreateTenantResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Inserts a tenant row plus default subscription and entitlements.
 * Hotel admins are created separately from Superadmin → Admins → Create admin.
 */
export async function createTenantAction(input: {
  name: string;
  slug: string;
  region?: string;
}): Promise<CreateTenantResult> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can create tenants." };
  }

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  if (!name) {
    return { ok: false, error: "Hotel name is required." };
  }
  if (!slug || slug.length < 2) {
    return { ok: false, error: "A valid subdomain (slug) of at least 2 characters is required." };
  }

  const supabase = await createClient();

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name,
      slug,
      region: input.region?.trim() || null,
    })
    .select("id")
    .single();

  if (tenantErr || !tenant) {
    const msg = tenantErr?.message ?? "Insert failed.";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return {
        ok: false,
        error: `The subdomain "${slug}" is already taken. Choose another.`,
      };
    }
    return { ok: false, error: msg };
  }

  const tenantId = tenant.id;

  const { error: subErr } = await supabase.from("subscriptions").insert({
    tenant_id: tenantId,
    plan: "basic",
    status: "active",
  });

  if (subErr) {
    await supabase.from("tenants").delete().eq("id", tenantId);
    return { ok: false, error: subErr.message };
  }

  const { error: entErr } = await supabase.from("tenant_entitlements").insert({
    tenant_id: tenantId,
    keys: [],
  });

  if (entErr) {
    await supabase.from("tenants").delete().eq("id", tenantId);
    return { ok: false, error: entErr.message };
  }

  revalidatePath("/superadmin/tenants");
  revalidatePath("/superadmin/dashboard");
  revalidatePath("/superadmin/subscriptions");
  revalidatePath("/superadmin/admins");

  return { ok: true, tenantId };
}
