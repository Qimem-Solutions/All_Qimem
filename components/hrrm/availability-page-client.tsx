"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBirrCents } from "@/lib/format";
import type { AvailabilityMatrix, AvailabilityRow } from "@/lib/queries/hrrm-availability";
import { addDaysToIso, nightsBetween } from "@/lib/hrrm-pricing";
import { searchGuestsHrrmAction, createQuickReservationAction } from "@/lib/actions/hrrm-availability";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

type GuestPick = { id: string; full_name: string; phone: string | null };

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

  const [guestQuery, setGuestQuery] = useState("");
  const [guestHits, setGuestHits] = useState<GuestPick[]>([]);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState<GuestPick | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [checkIn, setCheckIn] = useState(() => addDaysToIso(startDate, 0));
  const [checkOut, setCheckOut] = useState(() => addDaysToIso(startDate, 3));

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedNight, setSelectedNight] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const q = guestQuery.trim();
    if (q.length < 2) {
      setGuestHits([]);
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
  }, [guestQuery]);

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

  function onCellClick(row: AvailabilityRow, date: string) {
    setSelectedTypeId(row.roomTypeId);
    setSelectedNight(date);
    setCheckIn(date);
    setCheckOut(addDaysToIso(date, 3));
  }

  async function onSubmit(mode: "hold" | "confirm") {
    setFormError(null);
    if (!guest) {
      setFormError("Select a guest from search results.");
      return;
    }
    if (!selectedTypeId) {
      setFormError("Choose a room type from the grid (click a cell).");
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
      <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
        {matrix.error}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Availability & inventory
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Nightly availability by room type for the selected horizon.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              className="h-9 w-9 shrink-0 p-0"
              aria-label="Previous week"
              onClick={() => setRange(addDaysToIso(startDate, -7), dayCount)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-center text-xs text-zinc-500">Horizon</p>
              <p className="whitespace-nowrap text-sm font-medium text-white">{formatRangeLabel()}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9 w-9 shrink-0 p-0"
              aria-label="Next week"
              onClick={() => setRange(addDaysToIso(startDate, 7), dayCount)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] text-zinc-500">From</label>
                <Input
                  type="date"
                  className="h-9 w-[9.5rem] text-sm"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setRange(v, dayCount);
                  }}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-zinc-500">Days</label>
                <Input
                  type="number"
                  min={3}
                  max={14}
                  className="h-9 w-16 text-sm"
                  value={dayCount}
                  onChange={(e) => {
                    const n = Math.min(14, Math.max(3, parseInt(e.target.value, 10) || 7));
                    setRange(startDate, n);
                  }}
                />
              </div>
            </div>
            <div className="relative">
              <Button type="button" variant="secondary" className="gap-2" onClick={() => setTypeFilterOpen((o) => !o)}>
                <Filter className="h-4 w-4" /> Room types
              </Button>
              {typeFilterOpen ? (
                <div
                  className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface-elevated p-3 text-left shadow-lg"
                  role="dialog"
                  aria-label="Filter room types"
                >
                  <p className="mb-2 text-xs text-zinc-500">Show or hide types in the grid.</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {initial.rows.map((r) => (
                      <li key={r.roomTypeId}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={!hiddenTypes.has(r.roomTypeId)}
                            onChange={() => {
                              setHiddenTypes((prev) => {
                                const n = new Set(prev);
                                if (n.has(r.roomTypeId)) n.delete(r.roomTypeId);
                                else n.add(r.roomTypeId);
                                return n;
                              });
                            }}
                          />
                          {r.roomTypeName}
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

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-x-auto xl:col-span-2">
          <CardHeader>
            <CardTitle>Inventory grid</CardTitle>
            <CardDescription>Green = rooms left · Red = sold out · price is nightly from the room type.</CardDescription>
          </CardHeader>
          <CardContent>
            {visibleRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No room types to show. Adjust filters or add room types in Inventory.</p>
            ) : (
              <table className="w-full min-w-[720px] text-center text-xs">
                <thead>
                  <tr className="border-b border-border text-zinc-500">
                    <th className="pb-3 text-left">Room type</th>
                    {matrix.days.map((d) => {
                      const isToday = d.date === todayIso;
                      return (
                        <th
                          key={d.date}
                          className={cn("px-0.5 pb-3", isToday && "rounded-t bg-gold/15 text-gold")}
                        >
                          {d.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.roomTypeId} className="border-b border-border/40">
                      <td className="py-3 text-left font-medium text-white">{row.roomTypeName}</td>
                      {row.cells.map((cell) => {
                        const sold = cell.physical > 0 && cell.available === 0;
                        const isSel = selectedTypeId === row.roomTypeId && selectedNight === cell.date;
                        return (
                          <td
                            key={cell.date}
                            className={cn(
                              "cursor-pointer px-0.5 py-3 transition-colors",
                              cell.date === todayIso && "bg-gold/10",
                              isSel && "ring-1 ring-gold/60",
                              sold ? "text-red-400" : "text-emerald-400",
                            )}
                            onClick={() => onCellClick(row, cell.date)}
                            title="Set quick reservation to this type and first night"
                          >
                            {cell.priceCents > 0 ? (
                              <span>
                                {formatBirrCents(cell.priceCents)} · {cell.available}
                              </span>
                            ) : (
                              <span className="text-zinc-500">— · {cell.available}</span>
                            )}
                            {sold ? <span className="block text-[9px] text-red-400/80">Full</span> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick reservation</CardTitle>
            <CardDescription>Hold or confirm from availability. Requires HRRM manage access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {formError ? <p className="text-sm text-red-400">{formError}</p> : null}
            <div className="relative">
              <label className="mb-1 block text-xs text-zinc-500">Guest lookup</label>
              <Input
                placeholder="Name, phone, or guest ID"
                value={guestQuery}
                onChange={(e) => {
                  setGuestQuery(e.target.value);
                  if (!e.target.value.trim()) setGuest(null);
                }}
                onFocus={() => guestHits.length > 0 && setGuestOpen(true)}
              />
              {guest && (
                <p className="mt-1 text-xs text-gold">
                  Selected: {guest.full_name}
                  {guest.phone ? ` · ${guest.phone}` : ""}
                </p>
              )}
              {guestOpen && guestHits.length > 0 ? (
                <ul
                  className="absolute left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-surface-elevated py-1 text-left text-sm shadow-md"
                  role="listbox"
                >
                  {guestHits.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-foreground hover:bg-foreground/5"
                        onClick={() => {
                          setGuest(g);
                          setGuestQuery(g.full_name);
                          setGuestOpen(false);
                        }}
                      >
                        {g.full_name}
                        {g.phone ? <span className="ml-1 text-zinc-500">({g.phone})</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Check-in</label>
                <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Check-out</label>
                <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface/50 p-3 text-sm">
              <p className="font-medium text-white">
                {selectedRow ? selectedRow.roomTypeName : "Select a room type"}
              </p>
              <p className="text-xs text-zinc-500">
                {nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "—"} · {adults} adult{adults === 1 ? "" : "s"}{" "}
                (capacity cap)
              </p>
            </div>
            {selectedRow && totalCents > 0 ? (
              <div className="space-y-1 text-sm text-zinc-400">
                <div className="flex justify-between">
                  <span>Nightly price</span>
                  <span>{formatBirrCents(nightlyCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nights</span>
                  <span>{nights}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold text-gold">
                  <span>Total</span>
                  <span>{formatBirrCents(totalCents)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Choose a room type with a price and a valid date range to see the total.</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                type="button"
                disabled={!canManage || saving}
                onClick={() => void onSubmit("hold")}
              >
                Draft hold
              </Button>
              <Button className="flex-1" type="button" disabled={!canManage || saving} onClick={() => void onSubmit("confirm")}>
                {saving ? "Saving…" : "Confirm booking"}
              </Button>
            </div>
            {!canManage ? (
              <p className="text-xs text-amber-200/80">View-only: ask an administrator for manage access to create reservations.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy forecast</CardTitle>
            <CardDescription>Booked room-nights ÷ total sellable rooms for each night in view.</CardDescription>
          </CardHeader>
          <CardContent>
            {matrix.occupancyByDate.length === 0 ? (
              <p className="text-sm text-zinc-500">No data.</p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {matrix.occupancyByDate.map((pct, i) => (
                  <div
                    key={matrix.days[i]!.date}
                    className="group relative flex flex-1 flex-col items-center"
                  >
                    <div
                      className={cn(
                        "w-full rounded-t",
                        matrix.days[i]!.date === todayIso ? "bg-gold/80" : "bg-zinc-700/60",
                      )}
                      style={{ height: `${Math.max(4, Math.round(pct * 100))}%` }}
                    />
                    <span className="mt-1 max-w-full truncate text-[9px] text-zinc-500 group-hover:opacity-100 sm:opacity-0">
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average daily rate (hint)</CardTitle>
            <CardDescription>Weighted by room count per type and current room type pricing.</CardDescription>
          </CardHeader>
          <CardContent>
            {matrix.adrCents != null && matrix.adrCents > 0 ? (
              <>
                <p className="text-3xl font-semibold text-white">{formatBirrCents(matrix.adrCents)}</p>
                <div className="mt-4 space-y-2 text-sm text-zinc-400">
                  {matrix.rows.slice(0, 6).map((r) => (
                    <div key={r.roomTypeId} className="flex justify-between">
                      <span className="truncate pr-2">{r.roomTypeName}</span>
                      <span>
                        {r.nightlyCents ? formatBirrCents(r.nightlyCents) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Add room type prices in Rates &amp; pricing to see ADR here.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
