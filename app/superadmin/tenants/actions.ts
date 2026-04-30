"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/queries/context";
import { normalizePrimaryBrandHex } from "@/lib/theme/tenant-brand-color";
import {
  billingServiceMonthFromPeriodEndIso,
  subscriptionPeriodEndFromNow,
} from "@/lib/subscriptions/billing-period";

export type CreateTenantResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

const MAX_COVER_BYTES = 3 * 1024 * 1024;
const COVER_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function rollbackTenant(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string) {
  await supabase.from("tenants").delete().eq("id", tenantId);
}

/**
 * Inserts a tenant row plus default subscription and entitlements.
 * Optional cover image: uploaded to the `tenant-covers` Storage bucket and URL stored on the tenant.
 * Pass fields via FormData: name, slug, region?, description?, coverImage?, logoImage?, primaryBrandColor? (#RRGGBB).
 * Hotel admins are created separately from Superadmin → Admins → Create admin.
 */
export async function createTenantAction(formData: FormData): Promise<CreateTenantResult> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can create tenants." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const regionRaw = String(formData.get("region") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return { ok: false, error: "Hotel name is required." };
  }
  if (!slug || slug.length < 2) {
    return { ok: false, error: "A valid subdomain (slug) of at least 2 characters is required." };
  }

  const fileEntry = formData.get("coverImage");
  const coverFile = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  if (coverFile) {
    if (coverFile.size > MAX_COVER_BYTES) {
      return { ok: false, error: "Hotel image must be 3MB or smaller." };
    }
    if (!Object.keys(COVER_MIME).includes(coverFile.type)) {
      return { ok: false, error: "Hotel image must be JPEG, PNG, WebP, or GIF." };
    }
  }

  const logoEntry = formData.get("logoImage");
  const logoFile = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
  if (logoFile) {
    if (logoFile.size > MAX_COVER_BYTES) {
      return { ok: false, error: "Logo must be 3MB or smaller." };
    }
    if (!Object.keys(COVER_MIME).includes(logoFile.type)) {
      return { ok: false, error: "Logo must be JPEG, PNG, WebP, or GIF." };
    }
  }

  const primaryBrandRaw = String(formData.get("primaryBrandColor") ?? "").trim();
  let primary_brand_color: string | null = null;
  if (primaryBrandRaw) {
    const parsed = normalizePrimaryBrandHex(primaryBrandRaw);
    if (!parsed) {
      return { ok: false, error: "Primary brand color must be a valid #RRGGBB hex value." };
    }
    primary_brand_color = parsed;
  }

  const supabase = await createClient();

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name,
      slug,
      region: regionRaw || null,
      description: description || null,
      primary_brand_color,
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

  const periodEnd = subscriptionPeriodEndFromNow();
  const { data: subRow, error: subErr } = await supabase
    .from("subscriptions")
    .insert({
      tenant_id: tenantId,
      plan: "basic",
      status: "active",
      current_period_end: periodEnd,
    })
    .select("id, tenant_id, current_period_end, plan")
    .single();

  if (subErr || !subRow) {
    await rollbackTenant(supabase, tenantId);
    return { ok: false, error: subErr?.message ?? "Subscription insert failed." };
  }

  const { error: billErr } = await supabase.from("subscription_billing_events").insert({
    tenant_id: tenantId,
    subscription_id: subRow.id as string,
    service_month: billingServiceMonthFromPeriodEndIso(subRow.current_period_end as string),
    plan: subRow.plan as string,
    source: "initial",
  });

  if (billErr) {
    await rollbackTenant(supabase, tenantId);
    return {
      ok: false,
      error:
        billErr.message +
        (billErr.message.includes("relation") || billErr.message.includes("does not exist")
          ? " Run migration subscription_billing_events."
          : ""),
    };
  }

  const { error: entErr } = await supabase.from("tenant_entitlements").insert({
    tenant_id: tenantId,
    keys: [],
  });

  if (entErr) {
    await rollbackTenant(supabase, tenantId);
    return { ok: false, error: entErr.message };
  }

  if (coverFile) {
    const ext = COVER_MIME[coverFile.type] ?? "jpg";
    const path = `${tenantId}/cover.${ext}`;
    const buf = new Uint8Array(await coverFile.arrayBuffer());
    const { error: upErr } = await supabase.storage.from("tenant-covers").upload(path, buf, {
      contentType: coverFile.type,
      upsert: true,
    });
    if (upErr) {
      await rollbackTenant(supabase, tenantId);
      return { ok: false, error: `Image upload failed: ${upErr.message}` };
    }
    const { data: pub } = supabase.storage.from("tenant-covers").getPublicUrl(path);
    const { error: urlErr } = await supabase
      .from("tenants")
      .update({ cover_image_url: pub.publicUrl })
      .eq("id", tenantId);
    if (urlErr) {
      await rollbackTenant(supabase, tenantId);
      return { ok: false, error: urlErr.message };
    }
  }

  if (logoFile) {
    const ext = COVER_MIME[logoFile.type] ?? "png";
    const path = `${tenantId}/logo.${ext}`;
    const buf = new Uint8Array(await logoFile.arrayBuffer());
    const { error: logoUpErr } = await supabase.storage.from("tenant-covers").upload(path, buf, {
      contentType: logoFile.type,
      upsert: true,
    });
    if (logoUpErr) {
      await rollbackTenant(supabase, tenantId);
      return { ok: false, error: `Logo upload failed: ${logoUpErr.message}` };
    }
    const { data: logoPub } = supabase.storage.from("tenant-covers").getPublicUrl(path);
    const { error: logoUrlErr } = await supabase
      .from("tenants")
      .update({ logo_url: logoPub.publicUrl })
      .eq("id", tenantId);
    if (logoUrlErr) {
      await rollbackTenant(supabase, tenantId);
      return { ok: false, error: logoUrlErr.message };
    }
  }

  revalidatePath("/superadmin/tenants");
  revalidatePath("/superadmin/dashboard");
  revalidatePath("/superadmin/subscriptions");
  revalidatePath("/superadmin/billing");
  revalidatePath("/superadmin/admins");

  return { ok: true, tenantId };
}

type ActionOk = { ok: true } | { ok: false; error: string };

function revalidateTenantAdmin() {
  revalidatePath("/superadmin/tenants");
  revalidatePath("/superadmin/dashboard");
  revalidatePath("/superadmin/subscriptions");
  revalidatePath("/superadmin/admins");
}

/**
 * Update tenant fields and optionally replace the cover image (superadmin only).
 * FormData: tenantId, name, slug, region?, description?, coverImage? (File)
 */
export async function updateTenantAction(formData: FormData): Promise<ActionOk> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can update tenants." };
  }

  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const regionRaw = String(formData.get("region") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!tenantId) {
    return { ok: false, error: "Missing tenant." };
  }
  if (!name) {
    return { ok: false, error: "Hotel name is required." };
  }
  if (!slug || slug.length < 2) {
    return { ok: false, error: "A valid subdomain (slug) of at least 2 characters is required." };
  }

  const fileEntry = formData.get("coverImage");
  const coverFile = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  if (coverFile) {
    if (coverFile.size > MAX_COVER_BYTES) {
      return { ok: false, error: "Hotel image must be 3MB or smaller." };
    }
    if (!Object.keys(COVER_MIME).includes(coverFile.type)) {
      return { ok: false, error: "Hotel image must be JPEG, PNG, WebP, or GIF." };
    }
  }

  const supabase = await createClient();

  const { error: updErr } = await supabase
    .from("tenants")
    .update({
      name,
      slug,
      region: regionRaw || null,
      description: description || null,
    })
    .eq("id", tenantId);

  if (updErr) {
    if (updErr.message.includes("duplicate") || updErr.message.includes("unique")) {
      return { ok: false, error: `The subdomain "${slug}" is already taken.` };
    }
    return { ok: false, error: updErr.message };
  }

  if (coverFile) {
    const ext = COVER_MIME[coverFile.type] ?? "jpg";
    const path = `${tenantId}/cover.${ext}`;
    const buf = new Uint8Array(await coverFile.arrayBuffer());
    const { error: upErr } = await supabase.storage.from("tenant-covers").upload(path, buf, {
      contentType: coverFile.type,
      upsert: true,
    });
    if (upErr) {
      return { ok: false, error: `Image upload failed: ${upErr.message}` };
    }
    const { data: pub } = supabase.storage.from("tenant-covers").getPublicUrl(path);
    const { error: urlErr } = await supabase
      .from("tenants")
      .update({ cover_image_url: pub.publicUrl })
      .eq("id", tenantId);
    if (urlErr) {
      return { ok: false, error: urlErr.message };
    }
  }

  revalidateTenantAdmin();
  return { ok: true };
}

export async function setTenantSubscriptionStatusAction(input: {
  tenantId: string;
  status: "active" | "inactive";
}): Promise<ActionOk> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can change subscription status." };
  }
  if (!input.tenantId) {
    return { ok: false, error: "Missing tenant." };
  }

  const supabase = await createClient();
  const { data: rows, error: selErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .limit(1);
  if (selErr) {
    return { ok: false, error: selErr.message };
  }
  if (!rows?.length) {
    return { ok: false, error: "This property has no subscription row. Create or link billing first." };
  }

  const { error: upErr } = await supabase
    .from("subscriptions")
    .update({ status: input.status })
    .eq("tenant_id", input.tenantId);
  if (upErr) {
    return { ok: false, error: upErr.message };
  }
  revalidateTenantAdmin();
  return { ok: true };
}

/**
 * Unlinks all profiles and deletes the tenant. Cascades remove tenant-scoped data (employees,
 * departments, subscriptions, entitlements, etc. where FKs allow).
 */
export async function deleteTenantAction(tenantId: string): Promise<ActionOk> {
  const ctx = await getUserContext();
  if (!ctx?.userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ctx.globalRole !== "superadmin") {
    return { ok: false, error: "Only a platform superadmin can delete tenants." };
  }
  if (!tenantId) {
    return { ok: false, error: "Missing tenant." };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      error:
        "Server missing SUPABASE_SERVICE_ROLE_KEY (required to unlink staff profiles when deleting a tenant).",
    };
  }

  const { count: nProfiles, error: cErr } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (cErr) {
    return { ok: false, error: cErr.message };
  }
  if ((nProfiles ?? 0) > 0) {
    const { error: uErr } = await admin
      .from("profiles")
      .update({ tenant_id: null })
      .eq("tenant_id", tenantId);
    if (uErr) {
      return { ok: false, error: uErr.message };
    }
  }

  const { data: inBucket } = await admin.storage.from("tenant-covers").list(tenantId);
  if (inBucket?.length) {
    const paths = inBucket.map((f) => `${tenantId}/${f.name}`);
    await admin.storage.from("tenant-covers").remove(paths);
  }

  const { error: dErr } = await admin.from("tenants").delete().eq("id", tenantId);
  if (dErr) {
    return { ok: false, error: dErr.message };
  }
  revalidateTenantAdmin();
  return { ok: true };
}
