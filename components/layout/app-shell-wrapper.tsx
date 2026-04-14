"use client";

import { usePathname } from "next/navigation";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import type { LucideIcon } from "lucide-react";

type Props = Omit<
  React.ComponentProps<typeof AppShell>,
  "activePath" | "navItems"
> & {
  navItems: { href: string; label: string; icon: LucideIcon }[];
  readOnly?: boolean;
};

export function AppShellWrapper({
  navItems,
  readOnly,
  ...rest
}: Props) {
  const pathname = usePathname();
  const items: NavItem[] = navItems.map((n) => ({
    href: n.href,
    label: n.label,
    icon: n.icon,
  }));
  return (
    <AppShell {...rest} navItems={items} activePath={pathname} readOnly={readOnly} />
  );
}
