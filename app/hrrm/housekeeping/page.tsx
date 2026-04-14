import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchRoomHousekeepingAggregate, fetchRooms } from "@/lib/queries/tenant-data";

export default async function HousekeepingPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Housekeeping & room status
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load room status.
        </p>
      </div>
    );
  }

  const [{ rows: rooms, error: rErr }, agg] = await Promise.all([
    fetchRooms(tenantId),
    fetchRoomHousekeepingAggregate(tenantId),
  ]);

  const clean = agg.byHousekeeping.clean ?? 0;
  const dirty = agg.byHousekeeping.dirty ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Housekeeping & room status
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Live room rows for this property.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">Live</Badge>
          <span className="text-xs text-zinc-500">Shift: configure in workforce</span>
        </div>
      </div>

      {rErr || agg.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {[rErr, agg.error].filter(Boolean).join(" ")}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total rooms", String(agg.total)],
          ["Clean (HK)", String(clean)],
          ["Dirty (HK)", String(dirty)],
          ["Out of order", String(agg.outOfOrder)],
        ].map(([a, b]) => (
          <Card key={a as string}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {a}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">{b}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        <span className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-gold-foreground">
          All floors
        </span>
        <div className="ml-auto flex gap-2">
          <Input placeholder="Search room..." className="h-9 max-w-xs" disabled />
          <Button variant="secondary" className="h-9 w-9 p-0" type="button" disabled>
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {rooms.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{r.room_number}</CardTitle>
              <Badge tone="gold" className="w-fit text-[9px]">
                {(r.housekeeping_status ?? "—") + " · " + (r.operational_status ?? "—")}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">{r.floor ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team on duty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Assign staff to rooms when you add housekeeping assignments to the schema.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick update</CardTitle>
              <CardDescription>Set room status from the floor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input defaultValue="" placeholder="Room number" disabled />
              <div className="flex flex-wrap gap-2">
                {["Clean", "Dirty", "Inspected", "O.O.O"].map((s) => (
                  <Button key={s} variant="secondary" size="sm" type="button" disabled>
                    {s}
                  </Button>
                ))}
              </div>
              <Button className="w-full" type="button" disabled>
                Update status
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
