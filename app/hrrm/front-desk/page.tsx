import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchRooms } from "@/lib/queries/tenant-data";
import { isRoomSellable } from "@/lib/queries/hrrm-availability";
import { addLocalDays, localDateIso } from "@/lib/format";
import { FrontDeskPageClient } from "@/components/hrrm/front-desk-page-client";

export default async function FrontDeskPage() {
  const ctx = await getUserContext();
  const access = ctx ? await getServiceAccessForLayout(ctx, "hrrm") : "none";
  const canManage = access === "manage";

  const today = localDateIso();
  const defaultCheckOut = addLocalDays(today, 1);

  let rooms: { id: string; room_number: string; room_type_name: string | null }[] = [];
  if (ctx?.tenantId) {
    const { rows, error } = await fetchRooms(ctx.tenantId);
    if (!error) {
      rooms = rows
        .filter((r) => isRoomSellable(r.operational_status))
        .map((r) => ({
          id: r.id,
          room_number: r.room_number,
          room_type_name: r.room_type_name,
        }));
    }
  }

  return (
    <FrontDeskPageClient
      canManage={canManage}
      defaultCheckIn={today}
      defaultCheckOut={defaultCheckOut}
      rooms={rooms}
    />
  );
}
