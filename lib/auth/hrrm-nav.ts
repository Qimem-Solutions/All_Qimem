import { hrrmSidebarNav } from "@/lib/nav/hrrm-sidebar";
import type { HrrmNavItem } from "@/components/layout/hrrm-shell";
import type { LucideIcon } from "lucide-react";

export type HrrmScope = "all" | "front_desk" | "inventory";

export type HrrmEffective = HrrmScope;

type NavSource = (typeof hrrmSidebarNav)[number];

/** Front-desk–only logins: only these routes (not reservations / concierge / staff). */
const FRONT_HREFS = new Set(["/hrrm/front-desk", "/hrrm/guests"]);

/** Inventory-only logins: sidebar and routes limited to the inventory module. */
const INVENTORY_HREFS = new Set(["/hrrm/inventory"]);

export function toHrrmShellItems(list: readonly NavSource[]): HrrmNavItem[] {
  return list.map((s) => ({ href: s.href, label: s.label, icon: s.icon as LucideIcon }));
}

export function filterHrrmNavByEffective(effective: HrrmEffective): readonly NavSource[] {
  if (effective === "all") {
    return hrrmSidebarNav;
  }
  const allow = effective === "front_desk" ? FRONT_HREFS : INVENTORY_HREFS;
  return hrrmSidebarNav.filter((n) => allow.has(n.href));
}

/**
 * @param cookieMode — from `hrrm_workstation` cookie (all | front_desk | inventory) when org scope is `all`.
 */
export function resolveEffective(
  orgScope: HrrmScope,
  cookieMode: string | undefined,
): HrrmEffective {
  if (orgScope === "front_desk" || orgScope === "inventory") {
    return orgScope;
  }
  if (cookieMode === "front_desk" || cookieMode === "inventory" || cookieMode === "all") {
    return cookieMode;
  }
  return "all";
}

/** Route prefixes only allowed when not in "all" mode. */
export function pathAllowedForEffective(pathname: string, effective: HrrmEffective): boolean {
  if (effective === "all") return true;
  const allow = effective === "front_desk" ? FRONT_HREFS : INVENTORY_HREFS;
  for (const h of allow) {
    if (pathname === h || pathname.startsWith(`${h}/`)) return true;
  }
  return false;
}

export function getDefaultRedirectFor(effective: HrrmEffective): string {
  if (effective === "front_desk") return "/hrrm/front-desk";
  if (effective === "inventory") return "/hrrm/inventory";
  return "/hrrm/dashboard";
}
