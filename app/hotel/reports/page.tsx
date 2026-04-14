import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";

export default async function HotelReportsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "hotel_admin") {
    redirect("/hotel/dashboard");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
        Hotel reports
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Tenant-scoped KPIs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          Wire this view to Supabase views or edge functions for occupancy, ADR, and HR
          compliance — entitlement-gated for Advanced tier.
        </CardContent>
      </Card>
    </div>
  );
}
