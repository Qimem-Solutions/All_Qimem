"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchGuestsHrrmAction } from "@/lib/actions/hrrm-availability";
import { registerGuestAtFrontDeskAction } from "@/lib/actions/hrrm-guests";
import { formatDate } from "@/lib/format";
import { GuestDetailsDialog } from "@/components/hrrm/guest-details-dialog";
import { ChevronRight, Search, UserPlus } from "lucide-react";

type GuestHit = { id: string; full_name: string; phone: string | null };

type RoomOption = { id: string; room_number: string; room_type_name: string | null };

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

  const [regName, setRegName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [roomId, setRoomId] = useState("");
  const [age, setAge] = useState("");
  const [party, setParty] = useState("1");
  const [nationalId, setNationalId] = useState("");
  const [paymentDollars, setPaymentDollars] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<GuestHit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  const onRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canManage) return;
      setFormErr(null);
      setFormNotice(null);
      setSaving(true);
      const fd = new FormData();
      fd.set("full_name", regName);
      fd.set("phone", phone);
      fd.set("check_in", checkIn);
      fd.set("check_out", checkOut);
      fd.set("room_id", roomId);
      fd.set("age", age);
      fd.set("party_size", party);
      fd.set("national_id_number", nationalId);
      fd.set("payment_dollars", paymentDollars);
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
      setCheckIn(defaultCheckIn);
      setCheckOut(defaultCheckOut);
      setRoomId("");
      setAge("");
      setParty("1");
      setNationalId("");
      setPaymentDollars("");
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
      idFile,
      nationalId,
      party,
      payMethod,
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
                      disabled={!canManage || rooms.length === 0}
                    >
                      <option value="">— No room (profile only) —</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.room_number}
                          {r.room_type_name ? ` · ${r.room_type_name}` : ""}
                        </option>
                      ))}
                    </select>
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
                  <span className="text-xs text-zinc-400">Payment (ETB)</span>
                  <Input
                    className="mt-1"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={paymentDollars}
                    onChange={(e) => setPaymentDollars(e.target.value)}
                    disabled={!canManage}
                  />
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
            <CardDescription>Search by name, phone, or guest ID.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
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
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setDetailOpen(true)} className="h-9">
                  View details
                </Button>
                <Link
                  href="/hrrm/reservations"
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-gold px-4 text-sm font-medium text-gold-foreground"
                >
                  New booking in ledger
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <p className="w-full text-xs text-zinc-500">Details shows stay, check out, or recheck in. Use the ledger for new bookings.</p>
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
      />
    </div>
  );
}
