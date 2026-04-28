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
import { syncOvernightOccupiedRoomsToDirty } from "@/lib/queries/hrrm-housekeeping";

function roomCellClass(hk: string | null, op: string | null) {
  const o = (op ?? "").toLowerCase();
  if (o === "out_of_order" || o === "maintenance" || o === "ooo" || o === "inactive") {
    return "bg-red-500/15 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  }
  if (o === "occupied") return "bg-sky-500/15 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
  const h = (hk ?? "clean").toLowerCase();
  if (h === "dirty") return "bg-gold/15 text-gold dark:bg-gold/10 dark:text-gold";
  return "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
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
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Operational overview
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
          Assign a tenant to load HRRM data.
        </p>
      </div>
    );
  }

  const todayIso = localDateIso();

  await syncOvernightOccupiedRoomsToDirty(tenantId);

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
      <section className="rounded-xl border border-border bg-surface-elevated p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.95fr)] xl:items-end">
          <div>
            <div className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              HRRM dashboard
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground [font-family:var(--font-outfit),system-ui,sans-serif] sm:text-3xl">
              Real-time hotel operations overview
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              {todayLabel}. Live arrivals, departures, room readiness, payment exposure, and a seven-day availability view.
            </p>
            {errors.length > 0 ? (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
                {errors.join(" ")}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Rooms today", String(counts.roomCount), `${availableRooms} available now`],
              ["Occupancy", `${todayOccupancyPct}%`, `${occupiedRooms} rooms occupied`],
              ["In house", String(inHouse.length), "Guests currently staying"],
              ["Pending payment", String(pendingPayments.length), "Active reservations unpaid"],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-xl border border-border bg-background p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted">{hint}</p>
              </div>
            ))}
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
          <Card key={String(title)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-foreground">{value}</p>
              <p className="mt-2 text-xs text-muted">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming arrivals</CardTitle>
            <CardDescription>The next reservations expected to arrive, ordered by check-in date.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingArrivals.length === 0 ? (
              <p className="text-sm text-muted">No upcoming arrivals.</p>
            ) : (
              <div className="space-y-3">
                {upcomingArrivals.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{r.guest_name}</p>
                      <p className="mt-1 text-sm text-muted">
                        Room {r.room_number} · {formatDate(r.check_in)} to {formatDate(r.check_out)}
                      </p>
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

        <Card>
          <CardHeader>
            <CardTitle>Room readiness</CardTitle>
            <CardDescription>Operational and housekeeping view from the rooms table.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Clean rooms</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{cleanRooms}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Out of order</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{housekeepingAgg.outOfOrder}</p>
              </div>
            </div>
            {roomsRes.rows.length === 0 ? (
              <p className="text-sm text-muted">No rooms configured.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {roomsRes.rows.map((r) => (
                  <div
                    key={r.id}
                    title={`${r.room_number} · ${r.housekeeping_status ?? ""} · ${r.operational_status ?? ""}`}
                    className={`flex aspect-square items-center justify-center rounded-lg border border-border/60 text-[10px] font-mono ${roomCellClass(
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
        <Card>
          <CardHeader>
            <CardTitle>Latest reservations</CardTitle>
            <CardDescription>Most recently created reservations, with stay and payment state.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReservations.length === 0 ? (
              <p className="text-sm text-muted">No reservations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
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
                      <tr key={r.id} className="border-b border-border/80">
                        <td className="py-3 pr-2 font-medium text-foreground">{r.guest_name}</td>
                        <td className="py-3 pr-2 text-foreground/90">{r.room_number}</td>
                        <td className="py-3 pr-2">
                          <Badge tone={statusTone(r.status)}>{formatStatusLabel(r.status)}</Badge>
                        </td>
                        <td className="py-3 pr-2">
                          <Badge tone={(r.payment_status ?? "").toLowerCase() === "paid" ? "green" : "gold"}>
                            {formatStatusLabel(r.payment_status)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2 text-muted">
                          {formatDate(r.check_in)} → {formatDate(r.check_out)}
                        </td>
                        <td className="py-3 text-foreground">{formatBirrCents(r.balance_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>7-day occupancy</CardTitle>
              <CardDescription>Availability-driven occupancy from the live room inventory.</CardDescription>
            </CardHeader>
            <CardContent>
              {availability.occupancyByDate.length === 0 ? (
                <p className="text-sm text-muted">No availability forecast yet.</p>
              ) : (
                <div className="flex h-36 items-end gap-2">
                  {availability.occupancyByDate.map((pct, index) => (
                    <div key={availability.days[index]!.date} className="group flex flex-1 flex-col items-center">
                      <div
                        className={`w-full rounded-t-md ${availability.days[index]!.date === todayIso ? "bg-gold" : "bg-muted"}`}
                        style={{ height: `${Math.max(8, Math.round(pct * 100))}%` }}
                      />
                      <span className="mt-2 text-[10px] text-muted">{Math.round(pct * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate and actions</CardTitle>
              <CardDescription>Quick signals and links to main HRRM tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Average daily rate</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {availability.adrCents != null ? formatBirrCents(availability.adrCents) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted">Weighted from room type pricing and inventory.</p>
              </div>
              <div className="grid gap-2">
                <Link
                  href="/hrrm/front-desk"
                  className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/50"
                >
                  Open front desk
                </Link>
                <Link
                  href="/hrrm/availability"
                  className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/50"
                >
                  Open availability board
                </Link>
                <Link
                  href="/hrrm/housekeeping"
                  className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/50"
                >
                  Open housekeeping
                </Link>
                <Link
                  href="/hrrm/reservations"
                  className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/50"
                >
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
