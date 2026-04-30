/**
 * Maps Supabase/Postgres and other technical failures to copy suitable for hotel staff and admins.
 * Use for anything shown in modals, forms, and banners—not for server logs.
 */

export const GENERIC_USER_ERROR =
  "Something went wrong. Please try again. If it keeps happening, contact your administrator.";

const TECH_RE =
  /postgres|postgrest|\bpgrst\b|relation\b|schema cache|\bmigration\b|violates\s+\w+\s+constraint|foreign\s+key|duplicate\s+key|\brpc\b|\bsql\b|notify\s+pgrst|column\s+.*does\s+not\s+exist|could\s+not\s+find.*column/i;

function looksLikeUuid(s: string): boolean {
  return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(s);
}

function hasTechnicalJargon(s: string): boolean {
  return TECH_RE.test(s) || looksLikeUuid(s);
}

export function toUserFacingError(
  raw: string | null | undefined,
  opts?: { fallback?: string },
): string {
  const msg = String(raw ?? "").trim();
  const fallback = opts?.fallback ?? GENERIC_USER_ERROR;
  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  if (
    lower.includes("supabase_service_role_key") ||
    msg.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    (lower.includes("service role") && lower.includes("missing"))
  ) {
    return "This action isn’t available because the server isn’t fully configured. Please contact your platform administrator.";
  }

  if (
    lower.includes("invalid login credentials") ||
    lower === "invalid credentials" ||
    (lower.includes("jwt") && lower.includes("expired"))
  ) {
    return "Your session expired or those sign-in details weren’t accepted. Please sign in again.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }

  if (
    lower.includes("duplicate") ||
    lower.includes("unique constraint") ||
    lower.includes("already exists") ||
    lower.includes("already taken")
  ) {
    if (lower.includes("slug") || lower.includes("subdomain") || lower.includes("domain")) {
      return "That property address is already in use. Choose another.";
    }
    return "That value is already in use. Try something different.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("new row violates row-level security policy") ||
    lower.includes("rls")
  ) {
    return "You don’t have permission to do that.";
  }

  if (
    lower.includes("does not exist") ||
    /\brelation\b/.test(lower) ||
    lower.includes("schema cache") ||
    (lower.includes("column") && lower.includes("does not exist"))
  ) {
    return "This feature isn’t ready or needs an update on the server. Please contact your administrator.";
  }

  if (lower.includes("foreign key") || lower.includes("still referenced") || lower.includes("referenced from")) {
    return "That can’t be removed because other records still depend on it.";
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("network error") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkrequest failed")
  ) {
    return "We couldn’t reach the server. Check your connection and try again.";
  }

  if (
    lower.includes("jwt expired") ||
    lower.includes("refresh token") ||
    lower.includes("invalid_grant")
  ) {
    return "Your session could not be refreshed. Please sign out and sign in again.";
  }

  // Short, already-human messages from our app
  if (msg.length <= 180 && !hasTechnicalJargon(msg)) {
    return msg;
  }

  return fallback;
}
