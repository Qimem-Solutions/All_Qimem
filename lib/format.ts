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
    currency: "USD",
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
