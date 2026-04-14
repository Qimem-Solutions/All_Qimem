"use client";

import { usePathname } from "next/navigation";
import { HrrmShell, type HrrmNavItem } from "@/components/layout/hrrm-shell";
import type { LucideIcon } from "lucide-react";

type Props = Omit<
  React.ComponentProps<typeof HrrmShell>,
  "activePath" | "sidebarItems"
> & {
  sidebarItems: { href: string; label: string; icon: LucideIcon }[];
  readOnly?: boolean;
};

export function HrrmShellWrapper({ sidebarItems, readOnly, ...rest }: Props) {
  const pathname = usePathname();
  const items: HrrmNavItem[] = sidebarItems.map((s) => ({
    href: s.href,
    label: s.label,
    icon: s.icon,
  }));
  return (
    <HrrmShell {...rest} sidebarItems={items} activePath={pathname} readOnly={readOnly} />
  );
}
