import { redirect } from "next/navigation";
import { HrrmRatesPage } from "@/components/hrrm/rates-page";
import { getUserContext } from "@/lib/queries/context";
import { fetchRoomsInventory, fetchRoomTypes, type RoomTypeRow } from "@/lib/queries/hrrm-inventory";

export default async function RatesPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Rates & pricing
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load pricing.
        </p>
      </div>
    );
  }

  const [{ rows: roomTypes, error: roomTypeError }, { rows: rooms, error: roomError }] = await Promise.all([
    fetchRoomTypes(tenantId),
    fetchRoomsInventory(tenantId),
  ]);

  const roomTypeById = new Map<string, RoomTypeRow>(roomTypes.map((type) => [type.id, type]));
  const roomPriceRows = rooms.map((room) => {
    const type = room.room_type_id ? roomTypeById.get(room.room_type_id) ?? null : null;
    return {
      ...room,
      type,
      basePrice: type?.price ?? null,
    };
  });

  return (
    <HrrmRatesPage
      roomTypes={roomTypes}
      roomPriceRows={roomPriceRows}
      roomTypeError={roomTypeError}
      roomError={roomError}
    />
  );
}
