"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarRange, Download, Search } from "lucide-react";
import { formatBirrCents, formatDate, formatRelative } from "@/lib/format";
import type { ReservationLedgerRow } from "@/lib/queries/tenant-data";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "active" | "arrivals" | "departures" | "canceled";

const TAB_META: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "arrivals", label: "Arrivals today" },
  { id: "departures", label: "Departures today" },
  { id: "canceled", label: "Canceled" },
];

function isCanceledStatus(s: string) {
  const x = s.toLowerCase();
  return x === "canceled" || x === "cancelled";
}

function isActiveReservationStatus(s: string) {
  const x = s.toLowerCase();
  return x === "checked_in" || x === "pending";
}

function statusTone(s: string) {
  const x = s.toLowerCase();
  if (x === "confirmed") return "green";
  if (x === "canceled" || x === "cancelled") return "red";
  if (x === "checked_in" || x === "in-house" || x === "in_house") return "gold";
  return "gray";
}

function formatStatusLabel(s: string) {
  const x = s.toLowerCase().replace(/_/g, " ");
  return x.replace(/\b\w/g, (c) => c.toUpperCase());
}

function paymentStatusTone(s: string | null) {
  const x = (s ?? "").toLowerCase();
  if (x === "paid") return "green";
  if (x === "pending") return "orange";
  return "gray";
}

function formatPaymentStatusLabel(s: string | null) {
  const x = (s ?? "unknown").toLowerCase().replace(/_/g, " ");
  return x.replace(/\b\w/g, (c) => c.toUpperCase());
}

function stayNights(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Stay overlaps [from, to] inclusive (YYYY-MM-DD). */
function stayOverlapsRange(checkIn: string, checkOut: string, from: string, to: string): boolean {
  return checkIn <= to && checkOut >= from;
}

function escapeCsvCell(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: ReservationLedgerRow[]): string {
  const header = [
    "Guest",
    "Email",
    "Phone",
    "Confirmation",
    "Room",
    "Check in",
    "Check out",
    "Status",
    "Payment Status",
    "Balance (ETB)",
    "Created",
  ];
  const lines = [header.map(escapeCsvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.guest_name,
        r.guest_email ?? "",
        r.guest_phone ?? "",
        r.confirmation_code ?? r.id,
        r.room_number,
        r.check_in,
        r.check_out,
        r.status,
        r.payment_status ?? "",
        String((r.balance_cents ?? 0) / 100),
        r.created_at,
      ]
        .map((c) => escapeCsvCell(String(c)))
        .join(","),
    );
  }
  return lines.join("\r\n");
}

function downloadCsv(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReservationsLedgerClient({
  rows: allRows,
  loadError,
  stats,
  todayIso,
}: {
  rows: ReservationLedgerRow[];
  loadError: string | null;
  stats: { checkInsToday: number; departuresToday: number; activeBookings: number; error: string | null };
  todayIso: string;
}) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [preferredSelectedId, setPreferredSelectedId] = useState<string | null>(() => allRows[0]?.id ?? null);

  const tabCounts = useMemo(() => {
    let active = 0;
    let arrivals = 0;
    let departures = 0;
    let canceled = 0;
    for (const r of allRows) {
      if (isCanceledStatus(r.status)) canceled += 1;
      if (isActiveReservationStatus(r.status)) active += 1;
      if (r.check_in === todayIso) arrivals += 1;
      if (r.check_out === todayIso) departures += 1;
    }
    return {
      all: allRows.length,
      active,
      arrivals,
      departures,
      canceled,
    };
  }, [allRows, todayIso]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (tab === "active" && !isActiveReservationStatus(r.status)) return false;
      if (tab === "canceled" && !isCanceledStatus(r.status)) return false;
      if (tab === "arrivals" && r.check_in !== todayIso) return false;
      if (tab === "departures" && r.check_out !== todayIso) return false;

      if (dateFrom && dateTo) {
        if (!stayOverlapsRange(r.check_in, r.check_out, dateFrom, dateTo)) return false;
      } else if (dateFrom) {
        if (r.check_out < dateFrom) return false;
      } else if (dateTo) {
        if (r.check_in > dateTo) return false;
      }

      if (q) {
        const pack = [r.guest_name, r.confirmation_code ?? "", r.id, r.room_number, r.guest_email ?? ""]
          .join(" ")
          .toLowerCase();
        if (!pack.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, tab, search, dateFrom, dateTo, todayIso]);

  const selectedId = useMemo(() => {
    if (filtered.length === 0) return null;
    if (preferredSelectedId && filtered.some((r) => r.id === preferredSelectedId)) return preferredSelectedId;
    return filtered[0]!.id;
  }, [filtered, preferredSelectedId]);

  const selected = useMemo(
    () => (selectedId ? filtered.find((r) => r.id === selectedId) : undefined),
    [filtered, selectedId],
  );

  const onExport = useCallback(() => {
    const name = `reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(buildCsv(filtered), name);
  }, [filtered]);

  const rangeLabel =
    dateFrom && dateTo
      ? `${dateFrom} → ${dateTo}`
      : dateFrom
        ? `From ${dateFrom}`
        : dateTo
          ? `Through ${dateTo}`
          : "All dates";

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
            <p className="text-[10px] uppercase text-zinc-500">Today&apos;s departures</p>
            <p className="text-xl font-semibold text-zinc-200">{stats.departuresToday}</p>
          </Card>
          <Card className="border-gold/20 px-4 py-3">
            <p className="text-[10px] uppercase text-zinc-500">Active (checked-in / pending)</p>
            <p className="text-xl font-semibold text-gold">{stats.activeBookings}</p>
          </Card>
        </div>
      </div>

      {loadError || stats.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {[loadError, stats.error].filter(Boolean).join(" ")}
        </p>
      ) : null}

      <div className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {TAB_META.map(({ id, label }) => {
              const n = tabCounts[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    tab === id
                      ? "bg-gold text-gold-foreground"
                      : "bg-foreground/5 text-zinc-400 hover:bg-foreground/10 hover:text-zinc-200",
                  )}
                >
                  {label} ({n})
                </button>
              );
            })}
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <div className="relative min-w-0 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                className="pl-9"
                placeholder="Search guest, confirmation, room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Filter reservations by search"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                className="gap-2"
                type="button"
                onClick={() => setRangeOpen((o) => !o)}
              >
                <CalendarRange className="h-4 w-4" /> Date range
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                type="button"
                onClick={onExport}
                disabled={filtered.length === 0}
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Range: <span className="text-zinc-300">{rangeLabel}</span>
            {dateFrom || dateTo ? (
              <button
                type="button"
                className="ml-2 text-gold hover:underline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear
              </button>
            ) : null}
          </p>
        </div>
        {rangeOpen ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated/40 p-4 sm:flex-row sm:items-end sm:gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500" htmlFor="res-from">
                Check-in on or after
              </label>
              <Input
                id="res-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full min-w-[10rem] sm:w-auto"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500" htmlFor="res-to">
                Check-out on or before
              </label>
              <Input
                id="res-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full min-w-[10rem] sm:w-auto"
              />
            </div>
            <p className="text-xs text-zinc-500 sm:max-w-sm sm:pb-2">
              With <span className="text-zinc-400">both</span> fields: show stays that overlap the range (check-in on or
              before the end date, check-out on or after the start date). If only the first field is set, only stays
              with check-out on or after that day. If only the second is set, only stays with check-in on or before that
              day.
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
            <CardDescription>
              Showing {filtered.length} of {allRows.length} loaded reservations (latest 100 from database).
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {allRows.length === 0 && !loadError ? (
              <p className="text-sm text-zinc-500">No reservations yet. Create guest stays from your PMS or seed data in Supabase.</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-zinc-500">No reservations match the current filters.</p>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-3 pr-2">Guest / ID</th>
                    <th className="pb-3 pr-2">Room</th>
                    <th className="pb-3 pr-2">Stay</th>
                    <th className="pb-3 pr-2">Status</th>
                    <th className="pb-3 pr-2">Payment</th>
                    <th className="pb-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const isSel = row.id === selectedId;
                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreferredSelectedId(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPreferredSelectedId(row.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-b border-border/50 transition-colors",
                          isSel ? "bg-gold/10" : "hover:bg-foreground/5",
                        )}
                      >
                        <td className="py-3 pr-2">
                          <p className="font-medium text-white">{row.guest_name}</p>
                          <p className="font-mono text-xs text-zinc-500">{row.confirmation_code ?? row.id}</p>
                        </td>
                        <td className="py-3 pr-2 text-zinc-400">{row.room_number}</td>
                        <td className="py-3 pr-2 text-zinc-400">
                          <span className="text-zinc-300">{formatDate(row.check_in)}</span>
                          <span className="text-zinc-600"> → </span>
                          <span className="text-zinc-300">{formatDate(row.check_out)}</span>
                        </td>
                        <td className="py-3 pr-2">
                          <Badge tone={statusTone(row.status)}>{formatStatusLabel(row.status)}</Badge>
                        </td>
                        <td className="py-3 pr-2">
                          <Badge tone={paymentStatusTone(row.payment_status)}>
                            {formatPaymentStatusLabel(row.payment_status)}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-medium text-gold">{formatBirrCents(row.balance_cents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Selection</CardTitle>
            <CardDescription>Guest, stay, and balance for the highlighted row.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {!selected ? (
              <p className="text-zinc-500">Select a reservation in the table to see details here.</p>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Guest</p>
                  <p className="text-lg font-medium text-white">{selected.guest_name}</p>
                  {selected.loyalty_tier ? (
                    <p className="text-xs text-zinc-400">Loyalty: {selected.loyalty_tier}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Contact</p>
                  <p className="text-zinc-300">{selected.guest_email ?? "—"}</p>
                  <p className="text-zinc-300">{selected.guest_phone ?? "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-zinc-500">Room</p>
                    <p className="text-foreground">{selected.room_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-zinc-500">Nights</p>
                    <p className="text-foreground">{stayNights(selected.check_in, selected.check_out)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Stay dates</p>
                  <p className="text-zinc-200">
                    {formatDate(selected.check_in)} – {formatDate(selected.check_out)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-zinc-500">Status</p>
                    <Badge tone={statusTone(selected.status)}>{formatStatusLabel(selected.status)}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase text-zinc-500">Balance</p>
                    <p className="text-lg font-semibold text-gold">{formatBirrCents(selected.balance_cents)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">Payment status</p>
                  <Badge tone={paymentStatusTone(selected.payment_status)}>
                    {formatPaymentStatusLabel(selected.payment_status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">Reference</p>
                  <p className="font-mono text-xs text-zinc-400 break-all">
                    {selected.confirmation_code ?? selected.id}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">Booked</p>
                  <p className="text-zinc-400">
                    {selected.created_at
                      ? `${formatDate(selected.created_at)} · ${formatRelative(selected.created_at)}`
                      : "—"}
                  </p>
                </div>
                <p className="rounded-md border border-border/60 bg-foreground/5 p-2 text-xs text-zinc-500">
                  Line-item folio charges are not stored yet; balance reflects the <code className="text-zinc-400">balance_cents</code> field on
                  the reservation.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
