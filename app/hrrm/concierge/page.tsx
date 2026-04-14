import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, Phone, FileText, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchRecentReservationsForConcierge, fetchRooms } from "@/lib/queries/tenant-data";

export default async function ConciergePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Concierge station
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load guest and room data.
        </p>
      </div>
    );
  }

  const [{ rows: queue, error: qErr }, roomsRes] = await Promise.all([
    fetchRecentReservationsForConcierge(tenantId, 12),
    fetchRooms(tenantId),
  ]);

  const roomsMini = roomsRes.rows.slice(0, 16);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Concierge station
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upcoming reservations and room grid from Supabase.
          {qErr || roomsRes.error ? (
            <span className="ml-2 text-amber-400">{[qErr, roomsRes.error].filter(Boolean).join(" ")}</span>
          ) : null}
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="h-12 pl-10"
            placeholder="Search guests by name, confirmation, or room..."
            disabled
          />
        </div>
        <Button className="h-12 px-8" type="button" disabled>
          Search
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["Walk-in", "Express out", "Key re-code"].map((a) => (
                <button
                  key={a}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-surface/50 px-4 py-3 text-left text-sm hover:bg-white/5"
                  disabled
                >
                  {a}
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-400">
              <div className="flex justify-between">
                <span>Rooms</span>
                <span>{roomsRes.rows.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Queued reservations</span>
                <span>{queue.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming reservations</CardTitle>
            <Badge tone="gold">{queue.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.length === 0 ? (
              <p className="text-sm text-zinc-500">No reservation rows.</p>
            ) : (
              queue.map((q) => (
                <div
                  key={q.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/40 p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold">
                    {q.guest_name
                      .split(" ")
                      .map((x: string) => x[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{q.guest_name}</p>
                    <p className="text-xs text-zinc-500">
                      {q.loyalty_tier ?? "Guest"} · {q.check_in} → {q.check_out}
                    </p>
                    <Badge tone="gray" className="mt-2">
                      {q.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1 text-zinc-500">
                    <Phone className="h-4 w-4" />
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Room selection</CardTitle>
            <CardDescription>Housekeeping / operational hints from rooms.</CardDescription>
          </CardHeader>
          <CardContent>
            {roomsMini.length === 0 ? (
              <p className="text-sm text-zinc-500">No rooms.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {roomsMini.map((r) => {
                  const o = (r.operational_status ?? "").toLowerCase();
                  const busy = o === "occupied" || (r.housekeeping_status ?? "").toLowerCase() === "dirty";
                  return (
                    <div
                      key={r.id}
                      className={`flex aspect-square items-center justify-center rounded-lg border text-xs font-mono ${
                        busy
                          ? "border-red-500/40 text-red-400"
                          : "border-gold text-gold"
                      }`}
                    >
                      {r.room_number}
                    </div>
                  );
                })}
              </div>
            )}
            <Button className="mt-4 w-full" type="button" disabled>
              Assign & check-in
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
