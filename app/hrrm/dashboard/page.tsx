import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchHrrmDashboardCounts,
  fetchReservationStats,
  fetchReservationsWithGuests,
  fetchRoomHousekeepingAggregate,
  fetchRooms,
} from "@/lib/queries/tenant-data";
import { fetchAvailabilityMatrix, isFinishedReservation } from "@/lib/queries/hrrm-availability";
import { formatBirrCents, formatDate, localDateIso } from "@/lib/format";

function roomCellClass(hk: string | null, op: string | null) {
  const o = (op ?? "").toLowerCase();
  if (o === "out_of_order" || o === "maintenance" || o === "ooo" || o === "inactive") {
    return "bg-red-950/60 text-red-300";
  }
  if (o === "occupied") return "bg-sky-500/20 text-sky-100";
  const h = (hk ?? "clean").toLowerCase();
  if (h === "dirty") return "bg-amber-400/20 text-amber-100";
  return "bg-emerald-500/20 text-emerald-100";
}

function statusTone(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "checked_in") return "green" as const;
  if (normalized === "pending") return "gold" as const;
  if (normalized === "checked_out" || normalized === "completed" || normalized === "departed") return "gray" as const;
  if (normalized === "canceled" || normalized === "cancelled") return "red" as const;
  return "gray" as const;
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) return "—";
  return status.replaceAll("_", " ");
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

  const todayIso = localDateIso();

  const [counts, resStats, roomsRes, resList, housekeepingAgg, availability] = await Promise.all([
    fetchHrrmDashboardCounts(tenantId),
    fetchReservationStats(tenantId),
    fetchRooms(tenantId),
    fetchReservationsWithGuests(tenantId),
    fetchRoomHousekeepingAggregate(tenantId),
    fetchAvailabilityMatrix(tenantId, todayIso, 7),
  ]);

  const errors = [counts.error, resStats.error, roomsRes.error, resList.error, housekeepingAgg.error, availability.error].filter(Boolean);

  const todayLabel = new Date(`${todayIso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const occupiedRooms = roomsRes.rows.filter((r) => (r.operational_status ?? "").toLowerCase() === "occupied").length;
  const availableRooms = roomsRes.rows.filter((r) => (r.operational_status ?? "available").toLowerCase() === "available").length;
  const dirtyRooms = housekeepingAgg.byHousekeeping.dirty ?? 0;
  const cleanRooms = housekeepingAgg.byHousekeeping.clean ?? 0;

  const activeReservations = resList.rows.filter((r) => !isFinishedReservation(r.status));
  const inHouse = activeReservations.filter((r) => {
    const status = (r.status ?? "").toLowerCase();
    if (status === "checked_in") return true;
    return r.check_in <= todayIso && todayIso < r.check_out;
  });
  const arrivalsToday = activeReservations.filter((r) => r.check_in === todayIso);
  const departuresToday = activeReservations.filter((r) => r.check_out === todayIso);
  const pendingPayments = activeReservations.filter((r) => (r.payment_status ?? "").toLowerCase() === "pending");
  const upcomingArrivals = activeReservations
    .filter((r) => r.check_in >= todayIso)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .slice(0, 6);
  const recentReservations = resList.rows.slice(0, 8);

  const todayOccupancyPct = availability.occupancyByDate[0] != null ? Math.round(availability.occupancyByDate[0] * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.9))] px-6 py-6 shadow-[0_28px_90px_-45px_rgba(15,23,42,0.95)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.95fr)] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-teal-100/90">
              HRRM Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
              Real-time hotel operations overview
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              {todayLabel}. See live arrivals, departures, room readiness, payment exposure, and the next seven days of availability from the same dashboard.
            </p>
            {errors.length > 0 ? (
              <p className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                {errors.join(" ")}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Rooms today</p>
              <p className="mt-3 text-2xl font-semibold text-white">{counts.roomCount}</p>
              <p className="mt-1 text-xs text-zinc-400">{availableRooms} available now</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Occupancy</p>
              <p className="mt-3 text-2xl font-semibold text-white">{todayOccupancyPct}%</p>
              <p className="mt-1 text-xs text-zinc-400">{occupiedRooms} rooms marked occupied</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">In house</p>
              <p className="mt-3 text-2xl font-semibold text-white">{inHouse.length}</p>
              <p className="mt-1 text-xs text-zinc-400">Guests currently staying</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Pending payment</p>
              <p className="mt-3 text-2xl font-semibold text-white">{pendingPayments.length}</p>
              <p className="mt-1 text-xs text-zinc-400">Active reservations not yet paid</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Arrivals today", arrivalsToday.length, "Guests expected to check in today"],
          ["Departures today", departuresToday.length, "Guests expected to leave today"],
          ["Dirty rooms", dirtyRooms, "Need housekeeping attention"],
          ["Guest profiles", counts.guestCount, "Saved in the guest directory"],
        ].map(([title, value, note]) => (
          <Card key={String(title)} className="rounded-[24px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.92))]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{value}</p>
              <p className="mt-2 text-xs text-zinc-500">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.92))]">
          <CardHeader>
            <CardTitle className="text-white">Upcoming arrivals</CardTitle>
            <CardDescription className="text-zinc-400">The next reservations expected to arrive, ordered by check-in date.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingArrivals.length === 0 ? (
              <p className="text-sm text-zinc-500">No upcoming arrivals.</p>
            ) : (
              <div className="space-y-3">
                {upcomingArrivals.map((r) => (
                  <div key={r.id} className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{r.guest_name}</p>
                      <p className="mt-1 text-sm text-zinc-400">Room {r.room_number} · {formatDate(r.check_in)} to {formatDate(r.check_out)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(r.status)}>{formatStatusLabel(r.status)}</Badge>
                      <Badge tone={(r.payment_status ?? "").toLowerCase() === "paid" ? "green" : "gold"}>
                        {formatStatusLabel(r.payment_status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.92))]">
          <CardHeader>
            <CardTitle className="text-white">Room readiness</CardTitle>
            <CardDescription className="text-zinc-400">Operational and housekeeping view from the rooms table.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Clean rooms</p>
                <p className="mt-2 text-2xl font-semibold text-white">{cleanRooms}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Out of order</p>
                <p className="mt-2 text-2xl font-semibold text-white">{housekeepingAgg.outOfOrder}</p>
              </div>
            </div>
            {roomsRes.rows.length === 0 ? (
              <p className="text-sm text-zinc-500">No rooms configured.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {roomsRes.rows.map((r) => (
                  <div
                    key={r.id}
                    title={`${r.room_number} · ${r.housekeeping_status ?? ""} · ${r.operational_status ?? ""}`}
                    className={`flex aspect-square items-center justify-center rounded-xl text-[10px] font-mono ${roomCellClass(
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.92))]">
          <CardHeader>
            <CardTitle className="text-white">Latest reservations</CardTitle>
            <CardDescription className="text-zinc-400">Most recently created reservations, with live stay and payment state.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReservations.length === 0 ? (
              <p className="text-sm text-zinc-500">No reservations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      <th className="pb-3 pr-2">Guest</th>
                      <th className="pb-3 pr-2">Room</th>
                      <th className="pb-3 pr-2">Status</th>
                      <th className="pb-3 pr-2">Payment</th>
                      <th className="pb-3 pr-2">Stay</th>
                      <th className="pb-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReservations.map((r) => (
                      <tr key={r.id} className="border-b border-white/10">
                        <td className="py-3 pr-2 font-medium text-white">{r.guest_name}</td>
                        <td className="py-3 pr-2 text-zinc-300">{r.room_number}</td>
                        <td className="py-3 pr-2">
                          <Badge tone={statusTone(r.status)}>{formatStatusLabel(r.status)}</Badge>
                        </td>
                        <td className="py-3 pr-2">
                          <Badge tone={(r.payment_status ?? "").toLowerCase() === "paid" ? "green" : "gold"}>
                            {formatStatusLabel(r.payment_status)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2 text-zinc-400">
                          {formatDate(r.check_in)} → {formatDate(r.check_out)}
                        </td>
                        <td className="py-3 text-zinc-200">{formatBirrCents(r.balance_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.92))]">
            <CardHeader>
              <CardTitle className="text-white">7-day occupancy</CardTitle>
              <CardDescription className="text-zinc-400">Availability-driven occupancy forecast from the live room inventory.</CardDescription>
            </CardHeader>
            <CardContent>
              {availability.occupancyByDate.length === 0 ? (
                <p className="text-sm text-zinc-500">No availability forecast yet.</p>
              ) : (
                <div className="flex h-36 items-end gap-2">
                  {availability.occupancyByDate.map((pct, index) => (
                    <div key={availability.days[index]!.date} className="group flex flex-1 flex-col items-center">
                      <div
                        className={`w-full rounded-t-xl ${availability.days[index]!.date === todayIso ? "bg-gold/80" : "bg-zinc-700/70"}`}
                        style={{ height: `${Math.max(8, Math.round(pct * 100))}%` }}
                      />
                      <span className="mt-2 text-[10px] text-zinc-500">{Math.round(pct * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.92))]">
            <CardHeader>
              <CardTitle className="text-white">Rate and actions</CardTitle>
              <CardDescription className="text-zinc-400">A few quick signals and direct paths to the main HRRM tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Average daily rate</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {availability.adrCents != null ? formatBirrCents(availability.adrCents) : "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Weighted from current room type pricing and room counts.</p>
              </div>
              <div className="grid gap-2">
                <Link href="/hrrm/front-desk" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.06]">
                  Open front desk
                </Link>
                <Link href="/hrrm/availability" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.06]">
                  Open availability board
                </Link>
                <Link href="/hrrm/housekeeping" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.06]">
                  Open housekeeping
                </Link>
                <Link href="/hrrm/reservations" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.06]">
                  Open reservations ledger
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
