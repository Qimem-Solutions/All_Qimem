"use client";

import Link from "next/link";
import { Headphones, Settings } from "lucide-react";
import { AppShellWrapper } from "@/components/layout/app-shell-wrapper";
import { superadminNav } from "@/lib/nav/superadmin";

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShellWrapper
      brand={{ title: "All Qimem", subtitle: "Superadmin portal" }}
      navItems={[...superadminNav]}
      propertyTag="SUPERADMIN"
      searchPlaceholder="Search hotels, regions, or plans..."
      showAppsShortcut
      userBlock={{ name: "Admin Sarah", role: "Global Controller" }}
      footerNav={
        <div className="space-y-0.5 px-3 pb-2">
          <Link
            href="/superadmin/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
          >
            <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Settings
          </Link>
          <Link
            href="/superadmin/support"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
          >
            <Headphones className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Support
          </Link>
        </div>
      }
    >
      {children}
    </AppShellWrapper>
  );
}
