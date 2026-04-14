import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchHrrmDashboardCounts,
  fetchReservationStats,
  fetchRooms,
  fetchReservationsWithGuests,
} from "@/lib/queries/tenant-data";

function roomCellClass(hk: string | null, op: string | null) {
  const o = (op ?? "").toLowerCase();
  if (o === "out_of_order" || o === "maintenance" || o === "ooo")
    return "bg-red-950/60 text-red-300";
  const h = (hk ?? "clean").toLowerCase();
  if (h === "dirty") return "bg-zinc-700/50 text-zinc-400";
  if (h === "occupied" || o === "occupied") return "bg-gold/30 text-gold";
  return "bg-zinc-700/50 text-zinc-400";
}

export default async function HrrmDashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Operational overview
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load HRRM data.
        </p>
      </div>
    );
  }

  const [counts, resStats, roomsRes, resList] = await Promise.all([
    fetchHrrmDashboardCounts(tenantId),
    fetchReservationStats(tenantId),
    fetchRooms(tenantId),
    fetchReservationsWithGuests(tenantId),
  ]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const occPct =
    counts.roomCount > 0
      ? `${Math.min(100, Math.round((counts.activeReservationCount / counts.roomCount) * 100))}%`
      : "—";

  const arrivalsPreview = resList.rows.slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Operational overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {today} · Rooms: {counts.roomCount} · Reservations: {counts.activeReservationCount} ·
            Guests: {counts.guestCount}
            {(counts.error || resStats.error || roomsRes.error || resList.error) && (
              <span className="ml-2 text-amber-400">
                {[counts.error, resStats.error, roomsRes.error, resList.error].filter(Boolean).join(" ")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" type="button" disabled>
            Filter view
          </Button>
          <Button variant="secondary" type="button" disabled>
            Daily report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Check-ins today", String(resStats.checkInsToday), "check_in = today"],
          ["Check-outs today", String(resStats.departuresToday), "check_out = today"],
          ["Reservation load (non-canceled)", String(resStats.activeBookings), "All statuses except canceled"],
          ["Guests (profiles)", String(counts.guestCount), "guests table"],
        ].map(([title, val, sub]) => (
          <Card key={title as string}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {title}
              </CardTitle>
              <Badge tone="gold">Live</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{val}</p>
              <p className="mt-2 text-xs text-zinc-500">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest reservations</CardTitle>
          </CardHeader>
          <CardContent>
            {arrivalsPreview.length === 0 ? (
              <p className="text-sm text-zinc-500">No reservations yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-zinc-500">
                    <th className="pb-2">Guest</th>
                    <th className="pb-2">Room</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Stay</th>
                  </tr>
                </thead>
                <tbody>
                  {arrivalsPreview.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-3 font-medium text-white">{r.guest_name}</td>
                      <td className="py-3 text-zinc-400">{r.room_number}</td>
                      <td className="py-3">
                        <Badge tone="gray">{r.status}</Badge>
                      </td>
                      <td className="py-3 font-mono text-xs">
                        {r.check_in} → {r.check_out}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">At a glance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>
              Approx. occupancy vs rooms: <span className="text-white">{occPct}</span> (reservations /
              rooms, heuristic)
            </p>
            <p className="text-xs text-zinc-600">
              Refine with room-night inventory when you connect availability logic.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Room grid</CardTitle>
          <CardDescription>
            Housekeeping / operational status from the rooms table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roomsRes.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No rooms configured.</p>
          ) : (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {roomsRes.rows.map((r) => (
                <div
                  key={r.id}
                  title={`${r.room_number} · ${r.housekeeping_status ?? ""} · ${r.operational_status ?? ""}`}
                  className={`flex aspect-square items-center justify-center rounded text-[10px] font-mono ${roomCellClass(
                    r.housekeeping_status,
                    r.operational_status,
                  )}`}
                >
                  {r.room_number}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
