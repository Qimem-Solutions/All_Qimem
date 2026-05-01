import Link from "next/link";
import { redirect } from "next/navigation";
import { localDateIso } from "@/lib/format";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchReservationStats, fetchReservationsWithGuests } from "@/lib/queries/tenant-data";
import { fetchHrrmStaffList } from "@/lib/queries/hrrm-staff";
import { ReservationsLedgerClient } from "@/components/hrrm/reservations-ledger-client";

export default async function ReservationsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Reservations ledger
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load reservations.
        </p>
      </div>
    );
  }

  const todayIso = localDateIso();
  const [access, { rows, error: loadError }, stats, staff] = await Promise.all([
    getServiceAccessForLayout(ctx, "hrrm"),
    fetchReservationsWithGuests(tenantId),
    fetchReservationStats(tenantId),
    fetchHrrmStaffList(tenantId),
  ]);
  const canManage = access === "manage";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated/40 px-4 py-3 text-sm">
        <p className="text-zinc-400">
          <span className="font-medium text-foreground">{staff.rows.length}</span> HRRM staff on this property
          {staff.error ? ` (${staff.error})` : ""}.
        </p>
        <Link href="/hrrm/staff" className="font-medium text-gold hover:underline">
          Open Staffs →
        </Link>
      </div>
    <ReservationsLedgerClient
      rows={rows}
      loadError={loadError}
      todayIso={todayIso}
      canManage={canManage}
      stats={{
        checkInsToday: stats.checkInsToday,
        departuresToday: stats.departuresToday,
        activeBookings: stats.activeBookings,
        error: stats.error,
      }}
    />
    </>
  );
}
