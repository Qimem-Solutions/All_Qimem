/**
 * Canonical origin for public marketing URLs (e.g. portfolio QR codes on `/p/{slug}`).
 *
 * - Set **`NEXT_PUBLIC_SITE_URL`** in production (e.g. `https://tete.com`) so QR codes and links
 *   always use your real domain—even if a superadmin opens Tenants from localhost or a preview host.
 * - If unset, uses **`window.location.origin`** in the browser (localhost → `http://localhost:3000`,
 *   production → `https://tete.com` when you use that host in the address bar).
 */
export function getPublicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      return new URL(normalized).origin;
    } catch {
      return raw.replace(/\/$/, "");
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}
