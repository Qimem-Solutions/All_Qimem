import { createClient } from "@/lib/supabase/server";
import { normalizePrimaryBrandHex } from "@/lib/theme/tenant-brand-color";

export type TenantLoginBranding = {
  name: string;
  logoUrl: string | null;
  /** Normalized `#rrggbb` when tenant configured a primary brand color. */
  primaryBrandColor: string | null;
};

/** Reserved first labels on multi-part hosts — not treated as tenant slugs. */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "login", "api", "cdn", "staging"]);

/**
 * Derive tenant slug from Host when using `{slug}.example.com` (or `{slug}.localhost`).
 */
export function tenantSlugFromHost(host: string): string | null {
  const hostname = host.split(":")[0]?.toLowerCase()?.trim() ?? "";
  if (!hostname) return null;
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0];
  if (!first || RESERVED_SUBDOMAINS.has(first)) return null;
  if (parts[parts.length - 1] === "localhost" && parts.length >= 2) {
    return first;
  }
  if (parts.length >= 3) {
    return first;
  }
  return null;
}

/**
 * Load branding for the login screen (anon-safe RPC; bypasses tenants RLS).
 */
export async function fetchTenantBrandingBySlug(
  slug: string | null | undefined,
): Promise<TenantLoginBranding | null> {
  const trimmed = slug?.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tenant_branding_by_slug", {
    p_slug: trimmed,
  });

  if (error || data == null) return null;

  const o = data as Record<string, unknown>;
  const name = o.name;
  if (typeof name !== "string" || !name.trim()) return null;
  const logo = o.logo_url;
  const rawColor = o.primary_brand_color;
  let primaryBrandColor: string | null = null;
  if (typeof rawColor === "string" && rawColor.trim()) {
    primaryBrandColor = normalizePrimaryBrandHex(rawColor.trim());
  }
  return {
    name: name.trim(),
    logoUrl: typeof logo === "string" && logo.trim().length > 0 ? logo.trim() : null,
    primaryBrandColor,
  };
}
