"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import type { LucideIcon } from "lucide-react";

export type AppShellNavInput = { href: string; label: string; icon: LucideIcon }[];

type Props = Omit<
  React.ComponentProps<typeof AppShell>,
  "activePath" | "navItems"
> & {
  navItems: AppShellNavInput;
  readOnly?: boolean;
};

export function AppShellWrapper({
  navItems,
  readOnly,
  ...rest
}: Props) {
  const pathname = usePathname();
  const items: NavItem[] = useMemo(
    () =>
      navItems.map((n) => ({
        href: n.href,
        label: n.label,
        icon: n.icon,
      })),
    [navItems],
  );
  return (
    <AppShell {...rest} navItems={items} activePath={pathname} readOnly={readOnly} />
  );
}
