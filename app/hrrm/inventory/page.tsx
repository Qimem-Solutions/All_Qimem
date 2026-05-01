import { redirect } from "next/navigation";
import { localDateIso } from "@/lib/format";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchRoomTypes, fetchRoomsInventory } from "@/lib/queries/hrrm-inventory";
import { HrrmInventoryPageClient } from "@/components/hrrm/inventory-page-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Property inventory
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Assign a tenant to your profile to load inventory.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const occupancyDate =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : localDateIso();
  const todayIso = localDateIso();

  const [access, roomBlock, typeBlock] = await Promise.all([
    getServiceAccessForLayout(ctx, "hrrm"),
    fetchRoomsInventory(tenantId, occupancyDate),
    fetchRoomTypes(tenantId),
  ]);
  const canManage = access === "manage";
  const loadError = [roomBlock.error, typeBlock.error].filter(Boolean).join(" ") || null;

  return (
    <HrrmInventoryPageClient
      initialRooms={roomBlock.rows}
      initialRoomTypes={typeBlock.rows}
      loadError={loadError}
      canManage={canManage}
      occupancyDate={occupancyDate}
      todayIso={todayIso}
    />
  );
}
