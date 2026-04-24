import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchRoomHousekeepingAggregate, fetchRooms } from "@/lib/queries/tenant-data";
import { HousekeepingPageClient } from "@/components/hrrm/housekeeping-page-client";
import { syncOvernightOccupiedRoomsToDirty } from "@/lib/queries/hrrm-housekeeping";

export default async function HousekeepingPage() {
  const ctx = await getUserContext();
  if (!ctx?.tenantId) redirect("/login");

  const tenantId = ctx.tenantId;
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  const canManage = access === "manage";

  await syncOvernightOccupiedRoomsToDirty(tenantId);

  const [{ rows, error }, agg] = await Promise.all([
    fetchRooms(tenantId),
    fetchRoomHousekeepingAggregate(tenantId),
  ]);

  if (error || agg.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Housekeeping
        </h1>
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {[error, agg.error].filter(Boolean).join(" ")}
        </p>
      </div>
    );
  }

  return (
    <HousekeepingPageClient
      rooms={rows}
      canManage={canManage}
      totals={{
        total: agg.total,
        clean: agg.byHousekeeping.clean ?? 0,
        dirty: agg.byHousekeeping.dirty ?? 0,
        outOfOrder: agg.outOfOrder,
      }}
    />
  );
}
