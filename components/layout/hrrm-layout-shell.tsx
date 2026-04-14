"use client";

import { HrrmShellWrapper } from "@/components/layout/hrrm-shell-wrapper";
import { hrrmSidebarNav } from "@/lib/nav/hrrm-sidebar";

export function HrrmLayoutShell({
  children,
  readOnly,
}: {
  children: React.ReactNode;
  readOnly?: boolean;
}) {
  return (
    <HrrmShellWrapper
      brand={{ title: "All Qimem HRRM", subtitle: "Operational Suite" }}
      sidebarItems={[...hrrmSidebarNav]}
      readOnly={readOnly}
    >
      {children}
    </HrrmShellWrapper>
  );
}
