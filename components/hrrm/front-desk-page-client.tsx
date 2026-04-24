"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchGuestsHrrmAction } from "@/lib/actions/hrrm-availability";
import { getFrontDeskAvailableRoomsAction, registerGuestAtFrontDeskAction } from "@/lib/actions/hrrm-guests";
import { formatBirrCents, formatDate } from "@/lib/format";
import type { GuestDirectoryRow } from "@/lib/hrrm-guest-directory";
import { nightsBetween } from "@/lib/hrrm-pricing";
import { GuestDetailsDialog } from "@/components/hrrm/guest-details-dialog";
import { Search, UserPlus } from "lucide-react";

type GuestHit = { id: string; full_name: string; phone: string | null };

type RoomOption = {
  id: string;
  room_number: string;
  room_type_name: string | null;
  nightlyCents: number;
  totalCents: number;
};

function roomOptionLabel(room: RoomOption) {
  const parts = [room.room_number];
  if (room.room_type_name) parts.push(room.room_type_name);
  if (room.nightlyCents > 0) parts.push(formatBirrCents(room.nightlyCents));
  return parts.join(" · ");
}

export function FrontDeskPageClient({
  canManage,
  defaultCheckIn,
  defaultCheckOut,
  rooms,
}: {
  canManage: boolean;
  defaultCheckIn: string;
  defaultCheckOut: string;
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GuestHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestId = useRef(0);
  const [existingGuestId, setExistingGuestId] = useState<string | null>(null);

  const [regName, setRegName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [roomOptions, setRoomOptions] = useState(rooms);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsErr, setRoomsErr] = useState<string | null>(null);
  const [roomId, setRoomId] = useState("");
  const [age, setAge] = useState("");
  const [party, setParty] = useState("1");
  const [nationalId, setNationalId] = useState("");
  const [paymentDollars, setPaymentDollars] = useState("");
  const [reservationStatus, setReservationStatus] = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [payMethod, setPayMethod] = useState("cash");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<GuestHit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const applyGuestToForm = useCallback((guest: GuestDirectoryRow) => {
    setExistingGuestId(guest.id);
    setRegName(guest.full_name);
    setPhone(guest.phone ?? "");
    setAge(guest.age != null ? String(guest.age) : "");
    setParty(guest.party_size != null ? String(guest.party_size) : "1");
    setNationalId(guest.national_id_number ?? "");
    setPaymentDollars(
      guest.registration_payment_cents != null ? (guest.registration_payment_cents / 100).toFixed(2) : "",
    );
    setPayMethod(guest.payment_method ?? "cash");
    setFormErr(null);
    setFormNotice("Returning guest loaded. Adjust the details if needed, then reserve again on the same profile.");
  }, []);

  const clearExistingGuest = useCallback(() => {
    setExistingGuestId(null);
    setFormNotice(null);
  }, []);

  useEffect(() => {
    setRoomOptions(rooms);
  }, [rooms]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      searchRequestId.current += 1;
      setHits([]);
      setSearchErr(null);
      setSearchOpen(false);
      setSearchLoading(false);
      return;
    }
    if (t.current) clearTimeout(t.current);
    const myId = ++searchRequestId.current;
    t.current = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        setSearchErr(null);
        const r = await searchGuestsHrrmAction(term);
        if (myId !== searchRequestId.current) return;
        setSearchLoading(false);
        if (r.ok) {
          setHits(r.rows);
          setSearchOpen(true);
        } else {
          setHits([]);
          setSearchOpen(false);
          setSearchErr(r.error);
        }
      })();
    }, 350);
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, [q]);

  useEffect(() => {
    if (!canManage) {
      setRoomsErr(null);
      setRoomsLoading(false);
      return;
    }

    const validRange = Boolean(checkIn && checkOut && checkIn < checkOut);
    if (!validRange) {
      setRoomOptions([]);
      setRoomsErr(checkIn && checkOut ? "Check-out must be after check-in." : null);
      setRoomsLoading(false);
      return;
    }

    let active = true;
    setRoomsLoading(true);
    setRoomsErr(null);

    void (async () => {
      const result = await getFrontDeskAvailableRoomsAction(checkIn, checkOut);
      if (!active) return;
      setRoomsLoading(false);
      if (!result.ok) {
        setRoomOptions([]);
        setRoomsErr(result.error);
        return;
      }
      setRoomOptions(result.rows);
    })();

    return () => {
      active = false;
    };
  }, [canManage, checkIn, checkOut]);

  useEffect(() => {
    if (!roomId) {
      setPaymentDollars("");
      return;
    }
    if (!roomOptions.some((room) => room.id === roomId)) {
      setRoomId("");
      setPaymentDollars("");
    }
  }, [roomId, roomOptions]);

  const selectedRoom = roomOptions.find((room) => room.id === roomId) ?? null;
  const stayNights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  useEffect(() => {
    if (!selectedRoom) return;
    setPaymentDollars((selectedRoom.totalCents / 100).toFixed(2));
  }, [selectedRoom, checkIn, checkOut]);

  const onRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canManage) return;
      setFormErr(null);
      setFormNotice(null);
      setSaving(true);
      const fd = new FormData();
      if (existingGuestId) fd.set("guest_id", existingGuestId);
      fd.set("full_name", regName);
      fd.set("phone", phone);
      fd.set("check_in", checkIn);
      fd.set("check_out", checkOut);
      fd.set("room_id", roomId);
      fd.set("age", age);
      fd.set("party_size", party);
      fd.set("national_id_number", nationalId);
      fd.set("payment_dollars", paymentDollars);
      fd.set("reservation_status", reservationStatus);
      fd.set("payment_status", paymentStatus);
      fd.set("payment_method", payMethod);
      if (idFile) fd.set("national_id_image", idFile);
      const r = await registerGuestAtFrontDeskAction(fd);
      setSaving(false);
      if (!r.ok) {
        setFormErr(r.error);
        return;
      }
      if (r.profileLimited) {
        setFormNotice(
          "Guest was saved with name only. Extended columns (age, party, ID, payment) are missing on the database. Run supabase/migrations/20260429120000_ensure_guests_extended_columns.sql in the Supabase SQL Editor (date prefix 20260429, not 202404), then register again to capture the full profile.",
        );
      } else if (r.idImageNotSaved) {
        setFormNotice(
          "Guest was saved, but the ID image could not be linked (national_id_image_path missing or cache stale). Re-upload after running 20260429120000_ensure_guests_extended_columns.sql in the Supabase SQL Editor.",
        );
      } else {
        setFormNotice(null);
      }
      setRegName("");
      setPhone("");
      setExistingGuestId(null);
      setCheckIn(defaultCheckIn);
      setCheckOut(defaultCheckOut);
      setRoomId("");
      setAge("");
      setParty("1");
      setNationalId("");
      setPaymentDollars("");
      setReservationStatus("pending");
      setPaymentStatus("pending");
      setIdFile(null);
      setFormErr(null);
      router.refresh();
    },
    [
      age,
      canManage,
      checkIn,
      checkOut,
      defaultCheckIn,
      defaultCheckOut,
      existingGuestId,
      idFile,
      nationalId,
      party,
      payMethod,
      reservationStatus,
      paymentStatus,
      paymentDollars,
      phone,
      regName,
      roomId,
      router,
    ],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Front desk
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Register new walk-ins, or search for a guest to view details, book, or check out.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              New guest
            </CardTitle>
            <CardDescription>
              Walk-in: profile, phone, optional room &amp; stay dates, ID, and check-in payment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formErr ? <p className="mb-3 text-sm text-red-400">{formErr}</p> : null}
            {formNotice ? <p className="mb-3 text-sm text-amber-200/90">{formNotice}</p> : null}
            {existingGuestId ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm">
                <p className="text-zinc-200">
                  Editing existing guest <span className="font-mono text-xs text-zinc-400">{existingGuestId}</span>
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={clearExistingGuest} disabled={saving}>
                  New guest instead
                </Button>
              </div>
            ) : null}
            <form onSubmit={onRegister} className="space-y-3">
              <div>
                <span className="text-xs text-zinc-400">Full name</span>
                <Input
                  className="mt-1"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div>
                <span className="text-xs text-zinc-400">Phone</span>
                <Input
                  className="mt-1"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+251 …"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="rounded-md border border-border/60 bg-foreground/[0.02] p-3">
                <p className="text-xs font-medium text-zinc-400">Stay (optional)</p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  Pick a room and dates to create a reservation; leave all empty for profile-only.
                </p>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-xs text-zinc-400">Room</span>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      disabled={!canManage || roomOptions.length === 0 || roomsLoading || Boolean(roomsErr)}
                    >
                      <option value="">— No room (profile only) —</option>
                      {roomOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {roomOptionLabel(r)}
                        </option>
                      ))}
                    </select>
                    {roomsErr ? <p className="mt-1 text-xs text-red-400">{roomsErr}</p> : null}
                    {!roomsErr && roomsLoading ? <p className="mt-1 text-xs text-zinc-500">Checking room availability…</p> : null}
                    {!roomsErr && !roomsLoading && checkIn < checkOut ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {roomOptions.length} room{roomOptions.length === 1 ? "" : "s"} available for {stayNights} night
                        {stayNights === 1 ? "" : "s"}.
                      </p>
                    ) : null}
                    {selectedRoom ? (
                      <div className="mt-2 rounded-md border border-border/60 bg-surface/60 px-3 py-2 text-xs text-zinc-400">
                        <span className="text-zinc-300">Selected room price:</span> {formatBirrCents(selectedRoom.nightlyCents)} per night
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-zinc-400">Check-in</span>
                      <Input
                        className="mt-1"
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400">Check-out</span>
                      <Input
                        className="mt-1"
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-zinc-400">Age (optional)</span>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={130}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Party size</span>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={20}
                    value={party}
                    onChange={(e) => setParty(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-400">National / government ID (number)</span>
                <Input
                  className="mt-1"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div>
                <span className="text-xs text-zinc-400">National ID (image, optional — max 5MB)</span>
                <Input
                  className="mt-1"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                  disabled={!canManage}
                />
                {idFile ? <p className="mt-1 text-xs text-zinc-500">{idFile.name}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-zinc-400">Payment (birr)</span>
                  <Input
                    className="mt-1"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={paymentDollars}
                    onChange={(e) => setPaymentDollars(e.target.value)}
                    disabled={!canManage}
                  />
                  {selectedRoom ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Auto-filled only here from room price: {formatBirrCents(selectedRoom.nightlyCents)} × {stayNights} night
                      {stayNights === 1 ? "" : "s"} = {formatBirrCents(selectedRoom.totalCents)}.
                    </p>
                  ) : null}
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Reservation status</span>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                    value={reservationStatus}
                    onChange={(e) => setReservationStatus(e.target.value)}
                    disabled={!canManage || !roomId}
                  >
                    <option value="pending">Pending</option>
                    <option value="checked_in">Checked in</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Payment status</span>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    disabled={!canManage}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Method</span>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    disabled={!canManage}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!canManage || saving}>
                {saving ? "Saving…" : "Register guest"}
              </Button>
            </form>
            {!canManage ? (
              <p className="mt-2 text-xs text-amber-200/80">View-only. Ask for HRRM manage access to register guests.</p>
            ) : null}
            <p className="mt-3 text-xs text-zinc-600">
              Data is stored on the guest profile; ID images go to the private <code className="text-zinc-400">guest-id-documents</code>{" "}
              bucket. Today: {formatDate(new Date().toISOString())}
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Find guest
            </CardTitle>
            <CardDescription>Search returning guests, open details, then continue from there.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative z-0">
              <Input
                placeholder="Type at least 2 characters…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (!e.target.value.trim()) setSelected(null);
                }}
                onFocus={() => {
                  if (q.trim().length >= 2) setSearchOpen(true);
                }}
                autoComplete="off"
                name="find_guest"
                aria-autocomplete="list"
                aria-expanded={searchOpen && (hits.length > 0 || searchLoading || !!searchErr)}
              />
              {searchErr ? <p className="mt-2 text-sm text-red-400">{searchErr}</p> : null}
              {searchLoading ? <p className="mt-1 text-xs text-zinc-500">Searching…</p> : null}
              {selected ? (
                <p className="mt-2 text-sm text-gold">
                  Selected: <strong className="text-foreground">{selected.full_name}</strong>{" "}
                  <span className="font-mono text-xs text-zinc-500">{selected.id}</span>
                </p>
              ) : null}
              {searchOpen && !searchErr && !searchLoading && q.trim().length >= 2 && hits.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No guests match. Try a different name or phone.</p>
              ) : null}
              {searchOpen && hits.length > 0 ? (
                <ul
                  className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface-elevated py-1 text-sm shadow-md"
                  role="listbox"
                >
                  {hits.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-foreground/5"
                        onClick={() => {
                          setSelected(g);
                          setQ(g.full_name);
                          setSearchOpen(false);
                        }}
                        role="option"
                        aria-selected={selected?.id === g.id}
                      >
                        {g.full_name}
                        {g.phone ? <span className="ml-1 text-zinc-500">({g.phone})</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {selected ? (
              <div className="rounded-xl border border-border/70 bg-foreground/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Selected guest</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{selected.full_name}</p>
                    <p className="font-mono text-[10px] text-zinc-500">{selected.id}</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setDetailOpen(true)} className="h-9 shrink-0">
                    View details
                  </Button>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Use details to edit an active reservation, or refill the front desk form when this guest is returning.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <GuestDetailsDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        initialRow={null}
        loadGuestId={detailOpen && selected ? selected.id : null}
        canManage={canManage}
        columns="full"
        onUseForReservation={(guest) => {
          applyGuestToForm(guest);
          setDetailOpen(false);
        }}
      />
    </div>
  );
}
