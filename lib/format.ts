/** Calendar date YYYY-MM-DD in the environment’s local timezone (for stay pickers and “today”). */
export function localDateIso(d = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addLocalDays(isoYmd: string, days: number): string {
  const [y, m, day] = isoYmd.split("-").map(Number);
  if (!y || !m || !day) return localDateIso();
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + days);
  return localDateIso(d);
}

/**
 * Guest-facing time on public portfolio: `"17:29"` → `"5:29 PM"`.
 * Expects 24-hour `HH:MM` or `H:MM` from tenant settings. Returns null if invalid.
 */
export function formatGuestTimeAmPm(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return "Just now";
    if (sec < 3600) return `${Math.floor(sec / 60)} mins ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} hrs ago`;
    return formatDate(iso);
  } catch {
    return "—";
  }
}

export function formatMoneyCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ETB",
  }).format(cents / 100);
}

export function formatBirrCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const amount = cents / 100;
  const whole = Number.isInteger(amount);
  return `${new Intl.NumberFormat("en-ET", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)} birr`;
}

export function tenantDisplayId(uuid: string): string {
  return `T-${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** Format minor units (cents) with an ISO 4217 currency code for guest-facing quotes. */
export function formatMoneyCentsWithCurrency(
  cents: number | null | undefined,
  currencyCode: string | null | undefined,
): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const raw = (currencyCode ?? "").trim().toUpperCase();
  const code = /^[A-Z]{3}$/.test(raw) ? raw : "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }
}
