import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { listAvailableRoomsForStay } from "@/lib/queries/hrrm-availability";
import { addLocalDays, localDateIso } from "@/lib/format";
import { FrontDeskPageClient } from "@/components/hrrm/front-desk-page-client";

export default async function FrontDeskPage() {
  const ctx = await getUserContext();
  const access = ctx ? await getServiceAccessForLayout(ctx, "hrrm") : "none";
  const canManage = access === "manage";

  const today = localDateIso();
  const defaultCheckOut = addLocalDays(today, 1);

  let rooms: {
    id: string;
    room_number: string;
    room_type_name: string | null;
    nightlyCents: number;
    totalCents: number;
  }[] = [];
  if (ctx?.tenantId) {
    const { rows, error } = await listAvailableRoomsForStay(ctx.tenantId, today, defaultCheckOut);
    if (!error) {
      rooms = rows.map((r) => ({
        id: r.id,
        room_number: r.room_number,
        room_type_name: r.room_type_name,
        nightlyCents: r.nightlyCents,
        totalCents: r.totalCents,
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
