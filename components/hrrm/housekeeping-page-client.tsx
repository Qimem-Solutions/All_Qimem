"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setRoomHousekeepingStatusAction } from "@/lib/actions/hrrm-inventory";
import { cn } from "@/lib/utils";
import { BedDouble, BrushCleaning, CheckCheck, Search, Sparkles } from "lucide-react";

type RoomRow = {
  id: string;
  room_number: string;
  floor: string | null;
  building: string | null;
  housekeeping_status: string | null;
  operational_status: string | null;
  room_type_id: string | null;
  room_type_name: string | null;
};

type Props = {
  rooms: RoomRow[];
  canManage: boolean;
  totals: {
    total: number;
    clean: number;
    dirty: number;
    outOfOrder: number;
  };
};

function hkLabel(status: string | null | undefined) {
  return (status ?? "clean").toLowerCase() === "dirty" ? "Dirty" : "Clean";
}

function hkChipClass(status: string | null | undefined) {
  return (status ?? "clean").toLowerCase() === "dirty"
    ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
}

function opChipClass(status: string | null | undefined) {
  const normalized = (status ?? "available").toLowerCase();
  if (normalized === "occupied") return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  if (normalized === "out_of_order" || normalized === "inactive") return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  if (normalized === "maintenance") return "border-violet-400/20 bg-violet-400/10 text-violet-100";
  return "border-white/10 bg-white/[0.05] text-zinc-200";
}

export function HousekeepingPageClient({ rooms, canManage, totals }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "dirty" | "clean">("all");
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleRooms = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rooms.filter((room) => {
      const housekeeping = (room.housekeeping_status ?? "clean").toLowerCase();
      if (filter !== "all" && housekeeping !== filter) return false;
      if (!term) return true;
      const blob = [room.room_number, room.floor ?? "", room.building ?? "", room.room_type_name ?? "", housekeeping, room.operational_status ?? ""]
        .join(" ")
        .toLowerCase();
      return blob.includes(term);
    });
  }, [filter, query, rooms]);

  function updateHousekeeping(roomId: string, nextStatus: "clean" | "dirty") {
    if (!canManage) return;
    setPendingRoomId(roomId);
    setActionErr(null);
    startTransition(async () => {
      const result = await setRoomHousekeepingStatusAction({ id: roomId, housekeepingStatus: nextStatus });
      if (!result.ok) {
        setActionErr(result.error);
        setPendingRoomId(null);
        return;
      }
      setPendingRoomId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_25%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.9))] px-6 py-6 shadow-[0_28px_90px_-45px_rgba(15,23,42,0.95)]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.95fr)] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-teal-100/90">
              <BrushCleaning className="h-3.5 w-3.5" />
              Housekeeping Board
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
              Cleaning status for every room
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              Track what needs attention, mark rooms clean or dirty, and keep the floor team aligned with current room operations.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Total rooms", value: totals.total, note: "Visible to housekeeping", icon: BedDouble },
              { label: "Clean", value: totals.clean, note: "Ready from HK side", icon: CheckCheck },
              { label: "Dirty", value: totals.dirty, note: "Needs housekeeping", icon: BrushCleaning },
              { label: "Out of order", value: totals.outOfOrder, note: "Unavailable rooms", icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                    <Icon className="h-4 w-4 text-white/70" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.note}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-[30px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.92))] shadow-[0_28px_90px_-45px_rgba(15,23,42,0.92)]">
        <CardHeader className="border-b border-white/10 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-white">Room cleaning board</CardTitle>
              <CardDescription className="mt-2 text-zinc-400">
                Search rooms and update housekeeping status directly from this page.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  className="border-white/10 bg-slate-950/40 pl-10"
                  placeholder="Search room, floor, or type..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {(["all", "dirty", "clean"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="secondary"
                    className={cn(
                      "rounded-2xl border border-white/10 bg-white/[0.04] capitalize hover:bg-white/[0.08]",
                      filter === option && "border-teal-300/25 bg-teal-300/10 text-teal-100",
                    )}
                    onClick={() => setFilter(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {actionErr ? <p className="rounded-2xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{actionErr}</p> : null}
          {!canManage ? (
            <p className="rounded-2xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
              View-only. Ask for HRRM manage access to update room cleaning status.
            </p>
          ) : null}

          {visibleRooms.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              No rooms match this filter.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleRooms.map((room) => {
                const busy = isPending && pendingRoomId === room.id;
                return (
                  <div
                    key={room.id}
                    className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.45))] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{room.room_number}</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {room.room_type_name ?? "No room type"}{room.floor ? ` · Floor ${room.floor}` : ""}{room.building ? ` · ${room.building}` : ""}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-200">
                        <BedDouble className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-medium", hkChipClass(room.housekeeping_status))}>
                        {hkLabel(room.housekeeping_status)}
                      </span>
                      <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-medium capitalize", opChipClass(room.operational_status))}>
                        {(room.operational_status ?? "available").replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/25 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Housekeeping action</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className={cn(
                            "rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                            (room.housekeeping_status ?? "clean").toLowerCase() === "clean" && "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
                          )}
                          disabled={!canManage || busy}
                          onClick={() => updateHousekeeping(room.id, "clean")}
                        >
                          {busy && pendingRoomId === room.id ? "Saving..." : "Mark clean"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className={cn(
                            "rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                            (room.housekeeping_status ?? "clean").toLowerCase() === "dirty" && "border-amber-300/25 bg-amber-300/10 text-amber-100",
                          )}
                          disabled={!canManage || busy}
                          onClick={() => updateHousekeeping(room.id, "dirty")}
                        >
                          {busy && pendingRoomId === room.id ? "Saving..." : "Mark dirty"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
