import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchRoomTypes, fetchRoomsInventory } from "@/lib/queries/hrrm-inventory";
import { HrrmInventoryPageClient } from "@/components/hrrm/inventory-page-client";

export default async function InventoryPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Property inventory
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to your profile to load inventory.
        </p>
      </div>
    );
  }

  const [access, roomBlock, typeBlock] = await Promise.all([
    getServiceAccessForLayout(ctx, "hrrm"),
    fetchRoomsInventory(tenantId),
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
    />
  );
}
