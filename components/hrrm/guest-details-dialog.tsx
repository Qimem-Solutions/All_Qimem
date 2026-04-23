"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { formatGuestRowPayment, type GuestDirectoryRow } from "@/lib/hrrm-guest-directory";
import {
  checkoutGuestStayAction,
  getGuestHrrmDetailAction,
  recheckGuestStayAction,
} from "@/lib/actions/hrrm-guest-stay";
import { LogIn, LogOut, X } from "lucide-react";

function formatStayStatus(r: { stay: GuestDirectoryRow["stay"] }): string {
  if (!r.stay) return "—";
  if (r.stay.rawStatus && r.stay.label !== r.stay.rawStatus) {
    return `${r.stay.label} (${r.stay.rawStatus})`;
  }
  return r.stay.label;
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
};

export function GuestDetailsDialog({ open, onClose, initialRow, loadGuestId, canManage, columns }: Props) {
  const router = useRouter();
  const [row, setRow] = useState<GuestDirectoryRow | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setRow(null);
      setLoadErr(null);
      setActionErr(null);
      return;
    }
    if (initialRow) {
      setRow(initialRow);
      setLoadErr(null);
      return;
    }
    if (loadGuestId) {
      setFetching(true);
      setRow(null);
      setLoadErr(null);
      void (async () => {
        const r = await getGuestHrrmDetailAction(loadGuestId);
        setFetching(false);
        if (r.ok) {
          setRow(r.row);
        } else {
          setLoadErr(r.error);
        }
      })();
    } else {
      setRow(null);
    }
  }, [open, initialRow, loadGuestId]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  const toShow = row ?? initialRow;
  const resId = toShow?.stay?.reservationId ?? null;
  const showCheckout = canManage && resId && toShow?.stay?.label === "In house";
  const showRecheck = canManage && resId && toShow?.stay?.label === "Checked out";

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
    onClose();
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
    onClose();
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
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-surface-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="guest-details-title" className="text-lg font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
            Guest details
          </h2>
          <Button type="button" variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {fetching && !toShow ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : loadErr ? (
          <p className="mt-4 text-sm text-red-400">{loadErr}</p>
        ) : toShow ? (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Name</p>
              <p className="font-medium text-foreground">{toShow.full_name}</p>
              <p className="font-mono text-[10px] text-zinc-500">{toShow.id}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Phone</p>
              <p className="text-zinc-300">{toShow.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Registered</p>
              <p className="text-zinc-300">{toShow.created_at ? formatDate(toShow.created_at) : "—"}</p>
            </div>
            {columns === "full" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-zinc-500">Age</p>
                  <p className="text-zinc-300">{toShow.age ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Party</p>
                  <p className="text-zinc-300">{toShow.party_size ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Registration payment</p>
                  <p className="text-gold">{formatGuestRowPayment(toShow)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Method</p>
                  <p className="text-zinc-300">{toShow.payment_method ?? "—"}</p>
                </div>
              </div>
            ) : null}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-zinc-500">Current stay (ledger)</p>
              {toShow.stay ? (
                <ul className="mt-1 space-y-1 text-zinc-300">
                  <li>Status: {formatStayStatus(toShow)}</li>
                  <li>Room: {toShow.stay.roomNumber ?? "—"}</li>
                  <li>Check-in: {toShow.stay.checkIn ? formatDate(toShow.stay.checkIn) : "—"}</li>
                  <li>Check-out: {toShow.stay.checkOut ? formatDate(toShow.stay.checkOut) : "—"}</li>
                  <li>Nights: {toShow.stay.nights != null ? toShow.stay.nights : "—"}</li>
                </ul>
              ) : (
                <p className="text-zinc-500">No reservation for this guest yet.</p>
              )}
            </div>

            {actionErr ? <p className="text-sm text-red-400">{actionErr}</p> : null}

            <div className="flex flex-col gap-2 pt-1">
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
        ) : (
          <p className="mt-4 text-sm text-zinc-500">No guest selected.</p>
        )}
      </div>
    </div>
  );
}
