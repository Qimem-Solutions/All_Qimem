import { redirect } from "next/navigation";
import { HrmsShell } from "@/components/layout/hrms-shell";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";

export default async function HrmsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const access = await getServiceAccessForLayout(ctx, "hrms");
  if (access === "none") {
    redirect(
      "/hotel/dashboard?notice=" +
        encodeURIComponent("No access to HRMS. Ask your hotel admin to grant access."),
    );
  }
  return <HrmsShell readOnly={access === "view"}>{children}</HrmsShell>;
}
