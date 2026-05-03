"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import { formatBirrCents, formatDate } from "@/lib/format";
import type { AvailabilityMatrix, AvailabilityRow } from "@/lib/queries/hrrm-availability";
import { addDaysToIso, nightsBetween } from "@/lib/hrrm-pricing";
import { searchGuestsHrrmAction, createQuickReservationAction } from "@/lib/actions/hrrm-availability";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Filter,
  Hotel,
  X,
  Search,
  TrendingUp,
} from "lucide-react";

type GuestPick = { id: string; full_name: string; phone: string | null };
type RoomDetailFilter = "all" | "available" | "occupied";

function infoLabelClass() {
  return "text-[11px] font-medium uppercase tracking-[0.14em] text-muted";
}

function getAvailabilityStatus(available: number, physical: number) {
  if (physical <= 0) return "unavailable";
  if (available <= 0) return "full";
  if (available <= Math.max(1, Math.floor(physical / 3))) return "low";
  return "open";
}

/** Cell styling that works in light and dark mode */
function occupancyTone(status: ReturnType<typeof getAvailabilityStatus>) {
  if (status === "unavailable") return "border-border bg-muted/30 text-muted";
  if (status === "full") {
    return "border-red-500/30 bg-red-500/10 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  }
  if (status === "low") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
}

export function AvailabilityPageClient({
  initial,
  startDate,
  dayCount,
  canManage,
  todayIso,
}: {
  initial: AvailabilityMatrix;
  startDate: string;
  dayCount: number;
  canManage: boolean;
  todayIso: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [matrix, setMatrix] = useState(initial);
  useEffect(() => {
    setMatrix(initial);
  }, [initial]);

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(() => new Set());
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [guestQuery, setGuestQuery] = useState("");
  const [guestHits, setGuestHits] = useState<GuestPick[]>([]);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState<GuestPick | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedGuestQueryLocked = guest != null && guestQuery.trim() === guest.full_name.trim();

  const [checkIn, setCheckIn] = useState(() => addDaysToIso(startDate, 0));
  const [checkOut, setCheckOut] = useState(() => addDaysToIso(startDate, 3));

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedNight, setSelectedNight] = useState<string | null>(null);
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);
  const [roomDetailQuery, setRoomDetailQuery] = useState("");
  const [roomDetailFilter, setRoomDetailFilter] = useState<RoomDetailFilter>("all");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const q = guestQuery.trim();
    if (q.length < 2) {
      setGuestHits([]);
      return;
    }
    if (selectedGuestQueryLocked) {
      setGuestOpen(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void (async () => {
        const res = await searchGuestsHrrmAction(q);
        if (res.ok) {
          setGuestHits(res.rows);
          setGuestOpen(true);
        }
      })();
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [guestQuery, selectedGuestQueryLocked]);

  const visibleRows = useMemo(
    () => matrix.rows.filter((r) => !hiddenTypes.has(r.roomTypeId)),
    [matrix.rows, hiddenTypes],
  );

  const setRange = useCallback(
    (start: string, days: number) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("start", start);
      p.set("days", String(days));
      router.push(`${pathname}?${p.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const selectedRow: AvailabilityRow | undefined = useMemo(
    () => matrix.rows.find((r) => r.roomTypeId === selectedTypeId),
    [matrix.rows, selectedTypeId],
  );

  const nightlyCents = selectedRow?.nightlyCents ?? 0;
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const totalCents = useMemo(() => (nights > 0 && nightlyCents > 0 ? nightlyCents * nights : 0), [nightlyCents, nights]);
  const adults = Math.min(2, selectedRow?.capacity ?? 2);

  const totalAvailableToday = useMemo(() => {
    const todayIndex = matrix.days.findIndex((day) => day.date === todayIso);
    if (todayIndex < 0) return 0;
    return visibleRows.reduce((sum, row) => sum + (row.cells[todayIndex]?.available ?? 0), 0);
  }, [matrix.days, todayIso, visibleRows]);

  const maxOccupancyPct = useMemo(() => {
    if (matrix.occupancyByDate.length === 0) return 0;
    return Math.round(Math.max(...matrix.occupancyByDate) * 100);
  }, [matrix.occupancyByDate]);

  function onCellClick(row: AvailabilityRow, date: string) {
    setSelectedTypeId(row.roomTypeId);
    setSelectedNight(date);
    setCheckIn(date);
    setCheckOut(addDaysToIso(date, 3));
    setRoomDetailQuery("");
    setRoomDetailFilter("all");
    setRoomDetailOpen(true);
  }

  const selectedCell = useMemo(
    () => selectedRow?.cells.find((cell) => cell.date === selectedNight) ?? null,
    [selectedNight, selectedRow],
  );

  const roomDetailRows = useMemo(() => {
    const q = roomDetailQuery.trim().toLowerCase();
    const rooms = selectedCell?.rooms ?? [];
    return rooms.filter((room) => {
      if (roomDetailFilter === "available" && room.occupied) return false;
      if (roomDetailFilter === "occupied" && !room.occupied) return false;
      if (q && !room.roomNumber.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roomDetailFilter, roomDetailQuery, selectedCell]);

  async function onSubmit(mode: "hold" | "confirm") {
    setFormError(null);
    if (!guest) {
      setFormError("Select a guest from search results.");
      return;
    }
    if (!selectedTypeId) {
      setFormError("Choose a room type from the grid first.");
      return;
    }
    if (nights < 1) {
      setFormError("Check-out must be at least the day after check-in.");
      return;
    }
    setSaving(true);
    const res = await createQuickReservationAction({
      guestId: guest.id,
      roomTypeId: selectedTypeId,
      checkIn,
      checkOut,
      mode,
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setGuestQuery("");
    setGuest(null);
    router.refresh();
  }

  const formatRangeLabel = () => {
    const a = new Date(`${startDate}T12:00:00.000Z`);
    const b = new Date(addDaysToIso(startDate, dayCount - 1) + "T12:00:00.000Z");
    return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  };

  if (matrix.error) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
        {matrix.error}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface-elevated p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.95fr)] xl:items-end">
          <div>
            <div className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              Availability board
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground [font-family:var(--font-outfit),system-ui,sans-serif] sm:text-3xl">
              Availability by date range and room type
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Review nightly room-type availability across the selected horizon, then move directly into a hold or booking without leaving the page.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className={infoLabelClass()}>Horizon</p>
              <p className="mt-2 text-base font-semibold text-foreground">{formatRangeLabel()}</p>
              <p className="mt-1 text-xs text-muted">{dayCount} days in view</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className={infoLabelClass()}>Visible types</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{visibleRows.length}</p>
              <p className="mt-1 text-xs text-muted">{matrix.rows.length} total room types</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className={infoLabelClass()}>Available today</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totalAvailableToday}</p>
              <p className="mt-1 text-xs text-muted">{matrix.totalPhysicalRooms} sellable rooms</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className={infoLabelClass()}>Peak occupancy</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{maxOccupancyPct}%</p>
              <p className="mt-1 text-xs text-muted">Highest nightly load in this range</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>Date range filters</CardTitle>
              <CardDescription className="mt-2">
                Shift the horizon, change the number of days, and hide room types you do not want in the matrix.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-3">
                <Button type="button" variant="secondary" className="h-9 w-9 shrink-0 p-0" aria-label="Previous week" onClick={() => setRange(addDaysToIso(startDate, -7), dayCount)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[10rem] text-center">
                  <p className={infoLabelClass()}>Current range</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{formatRangeLabel()}</p>
                </div>
                <Button type="button" variant="secondary" className="h-9 w-9 shrink-0 p-0" aria-label="Next week" onClick={() => setRange(addDaysToIso(startDate, 7), dayCount)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[10rem_6rem_auto]">
                <div>
                  <label className={infoLabelClass()}>From</label>
                  <Input type="date" className="mt-1.5" value={startDate} onChange={(e) => {
                    const v = e.target.value;
                    if (v) setRange(v, dayCount);
                  }}
                  />
                </div>
                <div>
                  <label className={infoLabelClass()}>Days</label>
                  <Input
                    type="number"
                    min={3}
                    max={14}
                    className="mt-1.5"
                    value={dayCount}
                    onChange={(e) => {
                      const n = Math.min(14, Math.max(3, parseInt(e.target.value, 10) || 7));
                      setRange(startDate, n);
                    }}
                  />
                </div>
                <div className="relative">
                  <label className={infoLabelClass()}>Room types</label>
                  <Button type="button" variant="secondary" className="mt-1.5 h-10 gap-2" onClick={() => setTypeFilterOpen((o) => !o)}>
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                  {typeFilterOpen ? (
                    <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-surface-elevated p-4 shadow-lg" role="dialog" aria-label="Filter room types">
                      <p className="mb-3 text-xs text-muted">Show or hide room types in the grid.</p>
                      <ul className="max-h-56 space-y-2 overflow-y-auto">
                        {matrix.rows.map((r) => (
                          <li key={r.roomTypeId}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-muted/50">
                              <input
                                type="checkbox"
                                className="rounded border-border"
                                checked={!hiddenTypes.has(r.roomTypeId)}
                                onChange={() => {
                                  setHiddenTypes((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(r.roomTypeId)) next.delete(r.roomTypeId);
                                    else next.add(r.roomTypeId);
                                    return next;
                                  });
                                  setPage(1);
                                }}
                              />
                              <span className="flex-1">{r.roomTypeName}</span>
                              <span className="text-xs text-muted">{r.capacity ?? "—"} cap</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Availability grid</p>
                  <p className="text-xs text-muted">Click any cell to see room type details.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-800 dark:text-emerald-200">
                    Ready
                  </span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-900 dark:text-amber-100">
                    Low
                  </span>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-800 dark:text-red-200">
                    Full
                  </span>
                </div>
              </div>

              {visibleRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted">
                  No room types to show. Adjust the filters or add room types in inventory.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[900px] text-center text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-muted">
                        <th className="sticky left-0 z-10 bg-surface-elevated px-4 py-4 text-left text-[10px] font-medium uppercase tracking-[0.14em]">
                          Room type
                        </th>
                        {matrix.days.map((d) => {
                          const isToday = d.date === todayIso;
                          return (
                            <th key={d.date} className={cn("px-1 py-4 text-[10px] font-medium uppercase tracking-[0.14em]", isToday && "bg-gold/15 text-gold")}>
                              {d.label}
                            </th>
                          );
                        })}
                        
                      </tr>
                    </thead>
                    <tbody>
                      {/** paginate visible rows */}
                      {(() => {
                        const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
                        const pageSafe = Math.min(Math.max(1, page), totalPages);
                        const offset = (pageSafe - 1) * pageSize;
                        const pagedRows = visibleRows.slice(offset, offset + pageSize);
                        return pagedRows.map((row) => (
                        <tr key={row.roomTypeId} className="border-b border-border last:border-b-0">
                          <td className="sticky left-0 z-10 bg-background px-4 py-4 text-left shadow-[2px_0_8px_-4px_rgba(0,0,0,0.08)] dark:bg-background dark:shadow-[2px_0_8px_-4px_rgba(0,0,0,0.4)]">
                            <p className="text-sm font-medium text-foreground">{row.roomTypeName}</p>
                            <p className="mt-1 text-[11px] text-muted">
                              {row.capacity != null ? `${row.capacity} guests` : "No cap"} ·{" "}
                              {row.nightlyCents ? formatBirrCents(row.nightlyCents) : "No price"}
                            </p>
                          </td>
                          {row.cells.map((cell) => {
                            const status = getAvailabilityStatus(cell.available, cell.physical);
                            const isSelected = selectedTypeId === row.roomTypeId && selectedNight === cell.date;
                            return (
                              <td key={cell.date} className={cn("px-1 py-3", cell.date === todayIso && "bg-gold/5")}>
                                <button
                                  type="button"
                                  className={cn(
                                    "w-full rounded-xl border px-2 py-3 text-left transition hover:bg-muted/40",
                                    occupancyTone(status),
                                    isSelected && "ring-2 ring-gold ring-offset-2 ring-offset-background",
                                  )}
                                  onClick={() => onCellClick(row, cell.date)}
                                  title="Click to select this room type and date"
                                >
                                  <span className="block text-[11px] font-medium">
                                    {cell.available}/{cell.physical}
                                  </span>
                                  <span className="mt-1 block text-[10px] opacity-90">{cell.priceCents > 0 ? formatBirrCents(cell.priceCents) : "—"}</span>
                                  <span className="mt-1 block text-[10px] opacity-90">
                                    {status === "full" ? "Full" : status === "low" ? "Low" : status === "open" ? "Open" : "N/A"}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
              {visibleRows.length > 0 ? (
                <ListPagination
                  itemLabel="room types"
                  totalItems={matrix.rows.length}
                  filteredItems={visibleRows.length}
                  page={Math.min(Math.max(1, page), Math.max(1, Math.ceil(visibleRows.length / pageSize)))}
                  pageSize={pageSize}
                  totalPages={Math.max(1, Math.ceil(visibleRows.length / pageSize))}
                  onPageChange={setPage}
                  onPageSizeChange={(next) => {
                    setPageSize(next);
                    setPage(1);
                  }}
                />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-gold" />
            Average daily rate
          </CardTitle>
          <CardDescription>Weighted by room count per type and the current room type pricing.</CardDescription>
        </CardHeader>
        <CardContent>
          {matrix.adrCents != null && matrix.adrCents > 0 ? (
            <>
              <p className="text-3xl font-semibold text-foreground">{formatBirrCents(matrix.adrCents)}</p>
              <div className="mt-5 space-y-2 text-sm text-muted">
                {matrix.rows.slice(0, 6).map((r) => (
                  <div key={r.roomTypeId} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <span className="truncate pr-2 text-foreground">{r.roomTypeName}</span>
                    <span className="tabular-nums text-foreground">{r.nightlyCents ? formatBirrCents(r.nightlyCents) : "—"}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted">
              Add room type prices in Rates &amp; pricing to see ADR here.
            </div>
          )}
        </CardContent>
      </Card>

      {roomDetailOpen && selectedRow && selectedCell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gold">
                  <Hotel className="h-3.5 w-3.5" />
                  Room detail
                </div>
                <h2 className="mt-3 text-xl font-semibold text-foreground">{selectedRow.roomTypeName}</h2>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(selectedCell.date)} · {selectedCell.available} available / {selectedCell.physical} total rooms
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                aria-label="Close room detail"
                onClick={() => setRoomDetailOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-b border-border px-6 py-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    className="pl-10"
                    placeholder="Search room number"
                    value={roomDetailQuery}
                    onChange={(e) => setRoomDetailQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["all", "available", "occupied"] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      variant={roomDetailFilter === filter ? "primary" : "secondary"}
                      className="capitalize"
                      onClick={() => setRoomDetailFilter(filter)}
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 overflow-y-auto p-6 md:grid-cols-2">
              {roomDetailRows.length === 0 ? (
                <div className="md:col-span-2 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted">
                  No rooms match the current filter.
                </div>
              ) : (
                roomDetailRows.map((room) => (
                  <div
                    key={room.id}
                    className={cn(
                      "rounded-xl border px-4 py-4",
                      room.occupied ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">{room.roomNumber}</p>
                        <p className="mt-1 text-xs text-muted">
                          {room.occupied ? `Blocked by ${room.reservationStatus?.replaceAll("_", " ") ?? "reservation"}` : "Free for this night"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          room.occupied
                            ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
                        )}
                      >
                        <CircleDot className="h-3 w-3" />
                        {room.occupied ? "Occupied" : "Available"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
