const STORAGE_KEY = "aq_superadmin_tenant_portfolio_qr_v1";

function readMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return {};
    return p as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function hasPortfolioQrFlag(tenantId: string): boolean {
  return !!readMap()[tenantId];
}

export function setPortfolioQrFlag(tenantId: string): void {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[tenantId] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
