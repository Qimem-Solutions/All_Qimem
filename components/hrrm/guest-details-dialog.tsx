"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { formatGuestRowPayment, type GuestDirectoryRow } from "@/lib/hrrm-guest-directory";
import {
  checkoutGuestStayAction,
  getGuestHrrmDetailAction,
  recheckGuestStayAction,
  updateGuestFrontDeskDetailAction,
} from "@/lib/actions/hrrm-guest-stay";
import { LogIn, LogOut, X } from "lucide-react";

function formatStayStatus(r: { stay: GuestDirectoryRow["stay"] }): string {
  if (!r.stay) return "—";
  if (r.stay.rawStatus && r.stay.label !== r.stay.rawStatus) {
    return `${r.stay.label} (${r.stay.rawStatus})`;
  }
  return r.stay.label;
}

function isCanceledStatus(s: string | null | undefined) {
  const x = (s ?? "").toLowerCase();
  return x === "canceled" || x === "cancelled";
}

function isCheckedOutStatus(s: string | null | undefined) {
  const x = (s ?? "").toLowerCase();
  return x === "checked_out" || x === "completed" || x === "departed";
}

function normalizeEditableReservationStatus(s: string | null | undefined) {
  if (isCheckedOutStatus(s)) return "checked_out";
  if (isCanceledStatus(s)) return "canceled";
  const x = (s ?? "").toLowerCase();
  if (x === "checked_in") return "checked_in";
  return "pending";
}

function canReuseGuestForReservation(s: string | null | undefined) {
  return isCheckedOutStatus(s) || isCanceledStatus(s);
}

function canCancelPendingReservation(
  reservationStatus: string | null | undefined,
  reservationPaymentStatus: string | null | undefined,
) {
  return (reservationStatus ?? "").toLowerCase() === "pending" && (reservationPaymentStatus ?? "").toLowerCase() === "pending";
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Row from the directory when available. */
  initialRow: GuestDirectoryRow | null;
  /** Load by id (e.g. from front-desk search) when `initialRow` is null. */
  loadGuestId: string | null;
  canManage: boolean;
  columns: "full" | "basic";
  onUseForReservation?: (row: GuestDirectoryRow) => void;
};

export function GuestDetailsDialog({ open, onClose, initialRow, loadGuestId, canManage, columns, onUseForReservation }: Props) {
  const router = useRouter();
  const [row, setRow] = useState<GuestDirectoryRow | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [nationalIdNumber, setNationalIdNumber] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reservationStatus, setReservationStatus] = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("pending");

  const resetLocalState = useCallback(() => {
    setRow(null);
    setLoadErr(null);
    setActionErr(null);
    setEditOpen(false);
    setFetching(false);
  }, []);

  const handleClose = useCallback(() => {
    resetLocalState();
    onClose();
  }, [onClose, resetLocalState]);

  useEffect(() => {
    if (!open || !loadGuestId) {
      return;
    }
    let active = true;
    void (async () => {
      setFetching(true);
      setLoadErr(null);
      const r = await getGuestHrrmDetailAction(loadGuestId);
      if (!active) return;
      setFetching(false);
      if (r.ok) {
        setRow(r.row);
      } else {
        setLoadErr(r.error);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, loadGuestId]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    },
    [handleClose],
  );

  const toShow = row ?? initialRow;
  const resId = toShow?.stay?.reservationId ?? null;
  const stayStatus = toShow?.stay?.rawStatus;
  const showCheckout = canManage && Boolean(resId) && stayStatus === "checked_in";
  const showRecheck = canManage && resId && toShow?.stay?.label === "Checked out";
  const canUseForReservation =
    Boolean(onUseForReservation) && (!toShow?.stay ? false : canReuseGuestForReservation(stayStatus));
  const editableReservation = canManage && Boolean(resId) && !canUseForReservation;
  const canCancelReservation = canCancelPendingReservation(stayStatus, paymentStatus);

  const openEditorWithGuest = useCallback((guest: GuestDirectoryRow) => {
    setFullName(guest.full_name);
    setPhone(guest.phone ?? "");
    setAge(guest.age != null ? String(guest.age) : "");
    setPartySize(guest.party_size != null ? String(guest.party_size) : "1");
    setNationalIdNumber(guest.national_id_number ?? "");
    setPaymentAmount(
      guest.registration_payment_cents != null ? (guest.registration_payment_cents / 100).toFixed(2) : "",
    );
    setPaymentMethod(guest.payment_method ?? "cash");
    setCheckIn(guest.stay?.checkIn ?? "");
    setCheckOut(guest.stay?.checkOut ?? "");
    setReservationStatus(normalizeEditableReservationStatus(guest.stay?.rawStatus));
    setPaymentStatus(guest.stay?.paymentStatus ?? "pending");
    setEditOpen(true);
  }, []);

  const doCheckout = async () => {
    if (!resId) return;
    setBusy(true);
    setActionErr(null);
    const r = await checkoutGuestStayAction(resId);
    setBusy(false);
    if (!r.ok) {
      setActionErr(r.error);
      return;
    }
    handleClose();
    router.refresh();
  };

  const doRecheck = async () => {
    if (!resId) return;
    setBusy(true);
    setActionErr(null);
    const r = await recheckGuestStayAction(resId);
    setBusy(false);
    if (!r.ok) {
      setActionErr(r.error);
      return;
    }
    handleClose();
    router.refresh();
  };

  const doSave = async () => {
    if (!toShow) return;
    setBusy(true);
    setActionErr(null);
    const r = await updateGuestFrontDeskDetailAction({
      guestId: toShow.id,
      fullName,
      phone,
      age,
      partySize,
      nationalIdNumber,
      paymentDollars: paymentAmount,
      paymentMethod,
      reservationId: resId,
      checkIn: resId ? checkIn : null,
      checkOut: resId ? checkOut : null,
      reservationStatus: resId ? reservationStatus : null,
      paymentStatus: resId ? paymentStatus : null,
    });
    setBusy(false);
    if (!r.ok) {
      setActionErr(r.error);
      return;
    }
    setRow(r.row);
    setEditOpen(false);
    router.refresh();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-details-title"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-label="Close"
      />
      <div
        className="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-surface-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="guest-details-title" className="text-lg font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
            Guest details
          </h2>
          <Button type="button" variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={handleClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {fetching && !toShow ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : loadErr ? (
          <p className="mt-4 text-sm text-red-400">{loadErr}</p>
        ) : toShow ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-foreground/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Guest</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{toShow.full_name}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">{toShow.id}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Phone</p>
                    <p className="mt-1 text-zinc-200">{toShow.phone ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Registered</p>
                    <p className="mt-1 text-zinc-200">{toShow.created_at ? formatDate(toShow.created_at) : "—"}</p>
                  </div>
                  {columns === "full" ? (
                    <>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">National ID</p>
                        <p className="mt-1 text-zinc-200">{toShow.national_id_number ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Registration payment</p>
                        <p className="mt-1 text-gold">{formatGuestRowPayment(toShow)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Age</p>
                        <p className="mt-1 text-zinc-200">{toShow.age ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Party / Method</p>
                        <p className="mt-1 text-zinc-200">
                          {toShow.party_size ?? "—"} / {toShow.payment_method ?? "—"}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-foreground/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Stay Snapshot</p>
                {toShow.stay ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Status</p>
                      <p className="mt-1 text-zinc-200">{formatStayStatus(toShow)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Payment</p>
                      <p className="mt-1 text-zinc-200">{toShow.stay.paymentStatus ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Room</p>
                      <p className="mt-1 text-zinc-200">{toShow.stay.roomNumber ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Nights</p>
                      <p className="mt-1 text-zinc-200">{toShow.stay.nights != null ? toShow.stay.nights : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Check-in</p>
                      <p className="mt-1 text-zinc-200">{toShow.stay.checkIn ? formatDate(toShow.stay.checkIn) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Check-out</p>
                      <p className="mt-1 text-zinc-200">{toShow.stay.checkOut ? formatDate(toShow.stay.checkOut) : "—"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">No reservation for this guest yet.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">

            {editableReservation ? (
              <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gold/80">Reservation editor</p>
                    <p className="text-xs text-zinc-400">Update a reserved or in-house booking, including dates, status, and payment state.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (editOpen) setEditOpen(false);
                      else openEditorWithGuest(toShow);
                    }}
                  >
                    {editOpen ? "Hide form" : "Edit"}
                  </Button>
                </div>
                {editOpen ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <span className="text-xs text-zinc-400">Full name</span>
                        <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} />
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400">Phone</span>
                        <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400">National ID</span>
                        <Input
                          className="mt-1"
                          value={nationalIdNumber}
                          onChange={(e) => setNationalIdNumber(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                    </div>
                    {columns === "full" ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-xs text-zinc-400">Age</span>
                            <Input className="mt-1" type="number" value={age} onChange={(e) => setAge(e.target.value)} disabled={busy} />
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400">Party size</span>
                            <Input
                              className="mt-1"
                              type="number"
                              value={partySize}
                              onChange={(e) => setPartySize(e.target.value)}
                              disabled={busy}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-xs text-zinc-400">Registration payment</span>
                            <Input
                              className="mt-1"
                              inputMode="decimal"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              disabled={busy}
                            />
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400">Method</span>
                            <select
                              className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              disabled={busy}
                            >
                              <option value="cash">Cash</option>
                              <option value="card">Card</option>
                              <option value="transfer">Transfer</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      </>
                    ) : null}
                    {resId ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-xs text-zinc-400">Check-in</span>
                            <Input className="mt-1" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} disabled={busy} />
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400">Check-out</span>
                            <Input className="mt-1" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} disabled={busy} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-xs text-zinc-400">Reservation status</span>
                            <select
                              className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                              value={reservationStatus}
                              onChange={(e) => setReservationStatus(e.target.value)}
                              disabled={busy}
                            >
                              <option value="pending">Pending</option>
                              <option value="checked_in">Checked in</option>
                              <option value="checked_out">Checked out</option>
                              {canCancelReservation ? <option value="canceled">Canceled</option> : null}
                            </select>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400">Payment status</span>
                            <select
                              className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                              value={paymentStatus}
                              onChange={(e) => setPaymentStatus(e.target.value)}
                              disabled={busy}
                            >
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                            </select>
                          </div>
                        </div>
                      </>
                    ) : null}
                    <Button type="button" className="w-full" onClick={doSave} disabled={busy}>
                      {busy ? "Saving…" : "Save updates"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300">
                    Open edit mode to adjust guest info, reservation dates, reservation status, or payment status.
                  </p>
                )}
              </div>
            ) : canManage ? (
              <div className="rounded-2xl border border-border/70 bg-foreground/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {canUseForReservation ? "Ready to reserve again" : "Reservation locked"}
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {canUseForReservation
                    ? "This guest is not holding a room right now. Reuse the saved guest profile to create a new reservation."
                    : "This guest still has a live reservation attached. Open the reservation editor to update status, payment, or stay dates instead of creating a second booking."}
                </p>
              </div>
            ) : null}

            {actionErr ? <p className="text-sm text-red-400">{actionErr}</p> : null}

            <div className="flex flex-col gap-2">
              {canUseForReservation ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    onUseForReservation(toShow);
                    handleClose();
                  }}
                >
                  Use for reservation
                </Button>
              ) : null}
              {showCheckout ? (
                <Button type="button" className="w-full gap-2" onClick={doCheckout} disabled={busy}>
                  <LogOut className="h-4 w-4" />
                  {busy ? "Working…" : "Check out"}
                </Button>
              ) : null}
              {showRecheck ? (
                <Button type="button" className="w-full gap-2" onClick={doRecheck} disabled={busy}>
                  <LogIn className="h-4 w-4" />
                  {busy ? "Working…" : "Recheck in"}
                </Button>
              ) : null}
              {canManage && resId && !showCheckout && !showRecheck && toShow.stay ? (
                <p className="text-xs text-zinc-500">
                  Check out is available when the guest is in house. Recheck in is available after a stay is checked out
                  (reopens a one-night stay from today, same room, if the room is free).
                </p>
              ) : null}
              {!canManage && (showCheckout || showRecheck) ? (
                <p className="text-xs text-amber-200/80">View only — ask for HRRM manage access to check out or recheck in.</p>
              ) : null}
            </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">No guest selected.</p>
        )}
      </div>
    </div>
  );
}
