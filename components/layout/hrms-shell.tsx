"use client";

import Link from "next/link";
import { House } from "lucide-react";
import { AppShellWrapper, type AppShellNavInput } from "@/components/layout/app-shell-wrapper";
import { hrmsNav } from "@/lib/nav/hrms";
import { cn } from "@/lib/utils";

export function HrmsShell({
  children,
  readOnly,
  userBlock,
  showBackToHome,
  tenantName,
  propertyTag,
}: {
  children: React.ReactNode;
  readOnly?: boolean;
  userBlock: { name: string; role: string };
  /** Hotel admins return to portfolio; module-only staff do not see this control. */
  showBackToHome: boolean;
  /** Property / hotel display name (e.g. from tenants.name). */
  tenantName: string;
  /** Short uppercase tag for the header bar (same pattern as hotel admin shell). */
  propertyTag: string;
}) {
  const headerRight = showBackToHome ? (
    <Link
      href="/hotel/dashboard"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-transparent px-3 py-1.5 text-xs font-medium text-gold transition-colors",
        "hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
      )}
    >
      <House className="h-4 w-4" aria-hidden />
      Back to Home
    </Link>
  ) : undefined;

  return (
    <AppShellWrapper
      brand={{
        title: `${tenantName} HR`,
        subtitle: "HR Administration",
      }}
      navItems={hrmsNav as unknown as AppShellNavInput}
      propertyTag={propertyTag}
      userBlock={userBlock}
      readOnly={readOnly}
      headerRight={headerRight}
    >
      {children}
    </AppShellWrapper>
  );
}
