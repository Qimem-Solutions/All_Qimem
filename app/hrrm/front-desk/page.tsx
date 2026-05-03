import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { listAvailableRoomsForStay } from "@/lib/queries/hrrm-availability";
import type { PortfolioOnlineReservationRequestRow } from "@/lib/actions/hrrm-portfolio-online-requests";
import { addLocalDays, localDateIso } from "@/lib/format";
import { FrontDeskPageClient } from "@/components/hrrm/front-desk-page-client";

export default async function FrontDeskPage() {
  const ctx = await getUserContext();
  const access = ctx ? await getServiceAccessForLayout(ctx, "hrrm") : "none";
  const canManage = access === "manage";
  const canSeeHrrm = access !== "none";

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

  let onlineRequests: PortfolioOnlineReservationRequestRow[] = [];
  if (ctx?.tenantId && canSeeHrrm) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("portfolio_online_reservation_requests")
      .select(
        "id, reference_code, guest_full_name, guest_phone, room_type_name, check_in, check_out, stay_total_cents, currency, status, created_at, national_id_storage_path, payment_receipt_storage_path",
      )
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(150);
    onlineRequests = (data ?? []) as PortfolioOnlineReservationRequestRow[];
  }

  return (
    <FrontDeskPageClient
      canManage={canManage}
      defaultCheckIn={today}
      defaultCheckOut={defaultCheckOut}
      rooms={rooms}
      onlineRequests={onlineRequests}
    />
  );
}
