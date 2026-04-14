import { getUserContext } from "@/lib/queries/context";
import { HotelShell } from "@/components/layout/hotel-shell";
import { StaffModuleShell } from "@/components/layout/staff-module-shell";

export default async function HotelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (ctx?.globalRole === "hotel_admin") {
    return <HotelShell>{children}</HotelShell>;
  }
  return <StaffModuleShell>{children}</StaffModuleShell>;
}
