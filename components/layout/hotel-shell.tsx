"use client";

import { AppShellWrapper, type AppShellNavInput } from "@/components/layout/app-shell-wrapper";
import { hotelNav } from "@/lib/nav/hotel";

type Props = {
  children: React.ReactNode;
  tenantName: string;
  logoUrl: string | null;
  propertyTag: string;
  userName: string;
  userRoleLabel: string;
};

export function HotelShell({
  children,
  tenantName,
  logoUrl,
  propertyTag,
  userName,
  userRoleLabel,
}: Props) {
  return (
    <AppShellWrapper
      brand={{ title: tenantName, subtitle: "Hotel Admin", logoUrl }}
      navItems={hotelNav as unknown as AppShellNavInput}
      propertyTag={propertyTag}
      userBlock={{ name: userName, role: userRoleLabel }}
    >
      {children}
    </AppShellWrapper>
  );
}
