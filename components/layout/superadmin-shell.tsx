"use client";

import { AppShellWrapper, type AppShellNavInput } from "@/components/layout/app-shell-wrapper";
import { superadminNav } from "@/lib/nav/superadmin";

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShellWrapper
      brand={{ title: "All Qimem", subtitle: "Superadmin portal" }}
      navItems={superadminNav as unknown as AppShellNavInput}
      propertyTag="SUPERADMIN"
      searchPlaceholder="Search hotels, regions, or plans..."
      showAppsShortcut
      userBlock={{ name: "Admin Sarah", role: "Global Controller" }}
    >
      {children}
    </AppShellWrapper>
  );
}
