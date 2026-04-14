import { redirect } from "next/navigation";
import { HrrmLayoutShell } from "@/components/layout/hrrm-layout-shell";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";

export default async function HrrmLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  if (access === "none") {
    redirect(
      "/hotel/dashboard?notice=" +
        encodeURIComponent("No access to HRRM. Ask your hotel admin to grant access."),
    );
  }
  return <HrrmLayoutShell readOnly={access === "view"}>{children}</HrrmLayoutShell>;
}
