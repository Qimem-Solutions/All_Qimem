"use client";

import { AppShellWrapper, type AppShellNavInput } from "@/components/layout/app-shell-wrapper";
import { hotelNav } from "@/lib/nav/hotel";

export function HotelShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShellWrapper
      brand={{ title: "All Qimem", subtitle: "Hotel Admin" }}
      navItems={hotelNav as unknown as AppShellNavInput}
      propertyTag="GRAND QIMEM"
      userBlock={{ name: "Hotel Admin", role: "Executive" }}
    >
      {children}
    </AppShellWrapper>
  );
}
