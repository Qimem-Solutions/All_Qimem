import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarRange, Download } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchReservationStats, fetchReservationsWithGuests } from "@/lib/queries/tenant-data";
import { formatMoneyCents } from "@/lib/format";

function statusTone(s: string) {
  const x = s.toLowerCase();
  if (x === "confirmed") return "green";
  if (x === "canceled" || x === "cancelled") return "red";
  if (x === "checked_in" || x === "in-house" || x === "in_house") return "gold";
  return "gray";
}

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

  const { rows, error } = await fetchReservationsWithGuests(tenantId);
  const stats = await fetchReservationStats(tenantId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Reservations ledger
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Guest itineraries, room blocks, and balances from Supabase.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Card className="border-gold/20 px-4 py-3">
            <p className="text-[10px] uppercase text-zinc-500">Today&apos;s check-ins</p>
            <p className="text-xl font-semibold text-white">{stats.checkInsToday}</p>
          </Card>
          <Card className="border-gold/20 px-4 py-3">
            <p className="text-[10px] uppercase text-zinc-500">Total active (non-canceled)</p>
            <p className="text-xl font-semibold text-gold">{stats.activeBookings}</p>
          </Card>
        </div>
      </div>

      {error || stats.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {[error, stats.error].filter(Boolean).join(" ")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <span className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-gold-foreground">
          All bookings ({rows.length})
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" className="gap-2" type="button" disabled>
            <CalendarRange className="h-4 w-4" /> Date range
          </Button>
          <Button variant="secondary" className="gap-2" type="button" disabled>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
            <CardDescription>Latest {rows.length} reservations (limit 100 in query).</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {rows.length === 0 && !error ? (
              <p className="text-sm text-zinc-500">No reservations yet.</p>
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-3">Guest / ID</th>
                    <th className="pb-3">Room</th>
                    <th className="pb-3">Dates</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-4">
                        <p className="font-medium text-white">{row.guest_name}</p>
                        <p className="font-mono text-xs text-zinc-500">{row.confirmation_code ?? row.id}</p>
                      </td>
                      <td className="py-4 text-zinc-400">{row.room_number}</td>
                      <td className="py-4 text-zinc-400">
                        {row.check_in} → {row.check_out}
                      </td>
                      <td className="py-4">
                        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                      </td>
                      <td className="py-4 text-right font-medium text-gold">
                        {formatMoneyCents(row.balance_cents)}
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
            <CardTitle className="text-base">Selection</CardTitle>
            <CardDescription>Detail pane can bind to a selected row in a future iteration.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-zinc-400">
            <p>
              Use the table for a quick read of balances; folio detail can join charges when modeled.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
