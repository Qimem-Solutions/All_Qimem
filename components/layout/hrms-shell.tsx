"use client";

import { AppShellWrapper, type AppShellNavInput } from "@/components/layout/app-shell-wrapper";
import { hrmsNav } from "@/lib/nav/hrms";

export function HrmsShell({
  children,
  readOnly,
}: {
  children: React.ReactNode;
  readOnly?: boolean;
}) {
  return (
    <AppShellWrapper
      brand={{
        title: "Majestic HR",
        subtitle: "The Sovereign Group · HR Administration",
      }}
      navItems={hrmsNav as unknown as AppShellNavInput}
      propertyTag="Majestic Onyx"
      userBlock={{ name: "Alex Sterling", role: "General Manager" }}
      readOnly={readOnly}
    >
      {children}
    </AppShellWrapper>
  );
}
