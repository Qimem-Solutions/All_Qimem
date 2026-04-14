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

export function tenantDisplayId(uuid: string): string {
  return `T-${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
