import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Filter, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchRooms } from "@/lib/queries/tenant-data";

function statusLabel(hk: string | null, op: string | null) {
  const o = (op ?? "").toLowerCase();
  if (o === "out_of_order" || o === "maintenance" || o === "ooo") return "Out of order";
  const h = (hk ?? "clean").toLowerCase();
  if (h === "dirty") return "Dirty";
  if (h === "clean") return "Clean";
  return hk ?? op ?? "—";
}

function statusDotClass(hk: string | null, op: string | null) {
  const o = (op ?? "").toLowerCase();
  if (o === "out_of_order" || o === "maintenance" || o === "ooo") return "bg-red-500";
  const h = (hk ?? "clean").toLowerCase();
  if (h === "dirty") return "bg-blue-500";
  return "bg-emerald-500";
}

export default async function InventoryPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Room management
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load rooms.
        </p>
      </div>
    );
  }

  const { rows: rooms, error } = await fetchRooms(tenantId);

  const hkCounts: Record<string, number> = {};
  let ooo = 0;
  for (const r of rooms) {
    const h = (r.housekeeping_status ?? "unknown").toLowerCase();
    hkCounts[h] = (hkCounts[h] ?? 0) + 1;
    const o = (r.operational_status ?? "").toLowerCase();
    if (o === "out_of_order" || o === "maintenance" || o === "ooo") ooo += 1;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs text-zinc-500">Inventory · Physical rooms</p>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Room management
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <span className="rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-gold-foreground">
              Grid view
            </span>
            <span className="px-3 py-1.5 text-xs text-zinc-500">List view</span>
          </div>
          <Button variant="secondary" className="gap-2" type="button" disabled>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input placeholder="Search room, type, or floor..." className="max-w-md flex-1" disabled />
          <Button variant="secondary" size="md" type="button" disabled>
            Floor: All
          </Button>
          <Button variant="secondary" className="h-10 w-10 shrink-0 p-0" type="button" disabled>
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rooms.map((r) => (
          <Card key={r.id} className="relative overflow-hidden transition-colors">
            <span
              className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${statusDotClass(
                r.housekeeping_status,
                r.operational_status,
              )}`}
            />
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl text-white">{r.room_number}</CardTitle>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                {r.floor ?? "—"} · {r.building ?? "—"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded border border-border px-2 py-1 text-center text-xs text-zinc-300">
                {r.room_type_name ?? "Room type"}
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {statusLabel(r.housekeeping_status, r.operational_status)}
              </p>
            </CardContent>
          </Card>
        ))}
        <button
          type="button"
          className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 bg-gold/5 text-gold transition-colors hover:bg-gold/10"
          disabled
        >
          <Plus className="mb-2 h-10 w-10" />
          <span className="text-sm font-medium">Add physical room</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />{" "}
            {hkCounts.clean ?? 0} clean / available
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> {hkCounts.dirty ?? 0} dirty
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {ooo} out of order
          </span>
        </div>
        <span>
          {rooms.length} room{rooms.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
