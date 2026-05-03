import { createClient } from "@/lib/supabase/server";
import { normalizePrimaryBrandHex } from "@/lib/theme/tenant-brand-color";
import type { JobRequisitionRow } from "@/lib/queries/hrms-extended";

function parseGalleryUrlsRpc(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/** Public marketing portfolio (RPC `tenant_public_portfolio_by_slug`). */
export type PublicTenantPortfolio = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  logo_url: string | null;
  primaryBrandColor: string | null;
  contact_phone: string | null;
  reservations_email: string | null;
  region: string | null;
  mailing_address: string | null;
  social_linkedin_url: string | null;
  social_instagram_url: string | null;
  social_facebook_url: string | null;
  public_footer_tagline: string | null;
  /** Default guest check-in time from hotel settings (e.g. 15:00). */
  default_check_in_time: string | null;
  /** Default guest check-out time from hotel settings (e.g. 11:00). */
  default_check_out_time: string | null;
};

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

/**
 * Load portfolio fields for the public `/p/{slug}` page (anon-safe RPC).
 */
export async function fetchPublicPortfolioBySlug(rawSlug: string): Promise<PublicTenantPortfolio | null> {
  const trimmed = rawSlug?.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tenant_public_portfolio_by_slug", {
    p_slug: trimmed,
  });

  if (error || data == null) return null;

  const o = data as Record<string, unknown>;
  const name = o.name;
  const id = o.id;
  const slug = o.slug;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof id !== "string" || !id) return null;
  if (typeof slug !== "string" || !slug.trim()) return null;

  const rawColor = o.primary_brand_color;
  let primaryBrandColor: string | null = null;
  if (typeof rawColor === "string" && rawColor.trim()) {
    primaryBrandColor = normalizePrimaryBrandHex(rawColor.trim());
  }

  return {
    id,
    name: name.trim(),
    slug: slug.trim(),
    description: typeof o.description === "string" ? o.description : null,
    cover_image_url: typeof o.cover_image_url === "string" ? o.cover_image_url : null,
    gallery_urls: parseGalleryUrlsRpc(o.gallery_urls),
    logo_url: typeof o.logo_url === "string" && o.logo_url.trim() ? o.logo_url.trim() : null,
    primaryBrandColor,
    contact_phone: typeof o.contact_phone === "string" ? o.contact_phone : null,
    reservations_email: typeof o.reservations_email === "string" ? o.reservations_email : null,
    region: typeof o.region === "string" ? o.region : null,
    mailing_address: typeof o.mailing_address === "string" ? o.mailing_address : null,
    social_linkedin_url: typeof o.social_linkedin_url === "string" ? o.social_linkedin_url : null,
    social_instagram_url: typeof o.social_instagram_url === "string" ? o.social_instagram_url : null,
    social_facebook_url: typeof o.social_facebook_url === "string" ? o.social_facebook_url : null,
    public_footer_tagline:
      typeof o.public_footer_tagline === "string" ? o.public_footer_tagline : null,
    default_check_in_time:
      typeof o.default_check_in_time === "string" ? o.default_check_in_time : null,
    default_check_out_time:
      typeof o.default_check_out_time === "string" ? o.default_check_out_time : null,
  };
}

function parseOpenJobsRpc(raw: unknown): JobRequisitionRow[] {
  if (!Array.isArray(raw)) return [];
  const out: JobRequisitionRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = o.id;
    const title = o.title;
    if (typeof id !== "string" || typeof title !== "string") continue;
    let createdAt: string | null = null;
    if (typeof o.created_at === "string") createdAt = o.created_at;
    else if (o.created_at != null) createdAt = String(o.created_at);
    out.push({
      id,
      department_id: null,
      title,
      status: "open",
      description: typeof o.description === "string" ? o.description : null,
      created_at: createdAt,
      department_name: typeof o.department_name === "string" ? o.department_name : null,
    });
  }
  return out;
}

/** Open job postings for public `/p/{slug}` (anon RPC). */
export async function fetchOpenJobsPublicBySlug(slug: string): Promise<{
  rows: JobRequisitionRow[];
  error: string | null;
}> {
  const trimmed = slug?.trim();
  if (!trimmed) return { rows: [], error: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tenant_open_jobs_by_slug", { p_slug: trimmed });
  if (error) return { rows: [], error: error.message };
  return { rows: parseOpenJobsRpc(data), error: null };
}
