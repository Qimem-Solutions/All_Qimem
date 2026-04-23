import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserContext } from "@/lib/queries/context";
import { fetchHrrmStaffList } from "@/lib/queries/hrrm-staff";
import { HrrmStaffTable } from "@/components/hrrm/hrrm-staff-table";

export default async function HrrmStaffPage() {
  const ctx = await getUserContext();
  if (!ctx?.tenantId) redirect("/login");

  const { rows, error } = await fetchHrrmStaffList(ctx.tenantId);
  const canEditScope = ctx.globalRole === "hotel_admin";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          HRRM staff
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          People with HRRM access for this property. Hotel administrators can assign each person to{" "}
          <strong className="text-zinc-400">all areas</strong>, <strong className="text-zinc-400">front desk</strong>, or{" "}
          <strong className="text-zinc-400">inventory management</strong> (that user will only see that area after
          sign-in).
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            Use the sidebar <span className="text-foreground/80">Staffs</span> section to switch your own workstation
            when you have access to all areas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HrrmStaffTable rows={rows} canEditScope={canEditScope} />
        </CardContent>
      </Card>
    </div>
  );
}
