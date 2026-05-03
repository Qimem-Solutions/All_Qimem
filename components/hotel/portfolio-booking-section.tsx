"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CalendarRange, Loader2, Search } from "lucide-react";
import {
  fetchPublicBookingQuoteAction,
  type PublicBookingQuoteOk,
  type PublicBookingQuoteRoomType,
} from "@/lib/actions/public-portfolio-booking";
import { submitPortfolioOnlineBookingAction } from "@/lib/actions/portfolio-online-booking";
import { PORTFOLIO_PAYMENT_ACCOUNTS } from "@/lib/constants/portfolio-payments";
import { addLocalDays, formatMoneyCentsWithCurrency, localDateIso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function errorMessage(code: string): string {
  switch (code) {
    case "invalid_dates":
      return "Choose a check-out date after check-in.";
    case "past_check_in":
      return "Check-in cannot be in the past.";
    case "tenant_not_found":
      return "This property could not be loaded.";
    case "invalid_slug":
      return "Invalid property.";
    default:
      return code.length > 120 ? "Something went wrong. Try again." : code;
  }
}

function BookingModalPortal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10080] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-booking-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="portfolio-booking-modal-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function PortfolioBookingSection({
  tenantId,
  portfolioSlug,
}: {
  tenantId: string;
  portfolioSlug: string;
}) {
  const today = useMemo(() => localDateIso(), []);
  const defaults = useMemo(
    () => ({ checkIn: today, checkOut: addLocalDays(today, 1) }),
    [today],
  );

  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [quote, setQuote] = useState<PublicBookingQuoteOk | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [reserveTarget, setReserveTarget] = useState<PublicBookingQuoteRoomType | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [reserveErr, setReserveErr] = useState<string | null>(null);
  const [reserveSubmitting, startReserveSubmit] = useTransition();

  const [successInfo, setSuccessInfo] = useState<{
    referenceCode: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const res = await fetchPublicBookingQuoteAction(portfolioSlug, defaults.checkIn, defaults.checkOut);
      if (cancelled) return;
      if (!res.ok) {
        setFetchError(errorMessage(res.error));
        return;
      }
      setQuote(res);
    });
    return () => {
      cancelled = true;
    };
  }, [portfolioSlug, defaults.checkIn, defaults.checkOut, startTransition]);

  const runSearch = useCallback(() => {
    setFetchError(null);
    startTransition(async () => {
      const res = await fetchPublicBookingQuoteAction(portfolioSlug, checkIn, checkOut);
      if (!res.ok) {
        setQuote(null);
        setFetchError(errorMessage(res.error));
        return;
      }
      setQuote(res);
    });
  }, [portfolioSlug, checkIn, checkOut]);

  const closeReserveModal = useCallback(() => {
    setReserveTarget(null);
    setFullName("");
    setPhone("");
    setIdFile(null);
    setReceiptFile(null);
    setReserveErr(null);
  }, []);

  const openReserve = useCallback((row: PublicBookingQuoteRoomType) => {
    setReserveErr(null);
    setFullName("");
    setPhone("");
    setIdFile(null);
    setReceiptFile(null);
    setReserveTarget(row);
  }, []);

  const onReserveSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!reserveTarget || !quote) return;
      setReserveErr(null);
      startReserveSubmit(async () => {
        const fd = new FormData();
        fd.set("tenantId", tenantId);
        fd.set("portfolioSlug", portfolioSlug);
        fd.set("room_type_id", reserveTarget.room_type_id);
        fd.set("check_in", quote.check_in);
        fd.set("check_out", quote.check_out);
        fd.set("full_name", fullName.trim());
        fd.set("guest_phone", phone.trim());
        if (idFile) fd.set("national_id_image", idFile);
        if (receiptFile) fd.set("payment_receipt", receiptFile);
        const r = await submitPortfolioOnlineBookingAction(fd);
        if (!r.ok) {
          setReserveErr(r.error);
          return;
        }
        closeReserveModal();
        setSuccessInfo({
          referenceCode: r.referenceCode,
          checkIn: quote.check_in,
          checkOut: quote.check_out,
        });
      });
    },
    [
      reserveTarget,
      quote,
      tenantId,
      portfolioSlug,
      fullName,
      phone,
      idFile,
      receiptFile,
      closeReserveModal,
    ],
  );

  const availableRoomTypes = quote?.room_types.filter((r) => r.available_count > 0) ?? [];

  return (
    <section
      id="portfolio-booking"
      className="scroll-mt-[72px] border-y border-gold/25 bg-gradient-to-b from-zinc-950 to-black"
      aria-labelledby="portfolio-booking-heading"
    >
      <BookingModalPortal
        open={reserveTarget != null}
        title={reserveTarget ? `Reserve · ${reserveTarget.name}` : ""}
        onClose={() => {
          if (!reserveSubmitting) closeReserveModal();
        }}
      >
        {reserveTarget && quote ? (
          <form onSubmit={onReserveSubmit} className="space-y-4">
            <p className="text-sm text-zinc-400">
              <span className="tabular-nums text-zinc-200">{quote.check_in}</span>
              <span className="text-zinc-600"> → </span>
              <span className="tabular-nums text-zinc-200">{quote.check_out}</span>
              <span className="text-zinc-600"> · </span>
              {quote.nights} night{quote.nights === 1 ? "" : "s"}
            </p>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Full name
              </label>
              <Input
                required
                className="mt-1.5 border-white/15 bg-white/[0.06] text-white"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={reserveSubmitting}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Phone number
              </label>
              <Input
                required
                type="tel"
                className="mt-1.5 border-white/15 bg-white/[0.06] text-white"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={reserveSubmitting}
                autoComplete="tel"
                placeholder="+251 …"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                National ID (photo)
              </label>
              <input
                required
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1.5 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
                disabled={reserveSubmitting}
                onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Payment details</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                <li>
                  <span className="text-zinc-500">{PORTFOLIO_PAYMENT_ACCOUNTS.cbe.label}</span> —{" "}
                  <span className="font-mono tabular-nums">{PORTFOLIO_PAYMENT_ACCOUNTS.cbe.accountNumber}</span>
                </li>
                <li>
                  <span className="text-zinc-500">{PORTFOLIO_PAYMENT_ACCOUNTS.telebirr.label}</span> —{" "}
                  <span className="font-mono tabular-nums">{PORTFOLIO_PAYMENT_ACCOUNTS.telebirr.number}</span>
                </li>
              </ul>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Payment receipt (image or PDF)
              </label>
              <input
                required
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1.5 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
                disabled={reserveSubmitting}
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {reserveErr ? (
              <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {reserveErr}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="submit"
                disabled={reserveSubmitting}
                className="rounded-xl bg-gold font-semibold text-black hover:bg-gold/90"
              >
                {reserveSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  "Reserve"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
                disabled={reserveSubmitting}
                onClick={closeReserveModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </BookingModalPortal>

      <BookingModalPortal
        open={successInfo != null}
        title="Request submitted"
        onClose={() => setSuccessInfo(null)}
      >
        {successInfo ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              Your reservation request is saved. Please visit the front desk with your reference and payment proof.
            </p>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-emerald-400/90">Reference</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white">{successInfo.referenceCode}</p>
            </div>
            <p className="text-sm text-zinc-400">
              Stay:{" "}
              <span className="tabular-nums text-zinc-200">{successInfo.checkIn}</span>
              <span className="text-zinc-600"> → </span>
              <span className="tabular-nums text-zinc-200">{successInfo.checkOut}</span>
            </p>
            <Button
              type="button"
              className="w-full rounded-xl bg-gold font-semibold text-black hover:bg-gold/90"
              onClick={() => setSuccessInfo(null)}
            >
              OK — I&apos;ll go to the front desk
            </Button>
          </div>
        ) : null}
      </BookingModalPortal>

      <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-5 md:py-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/35 bg-gold/10">
              <CalendarRange className="h-5 w-5 text-gold" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <h2
                id="portfolio-booking-heading"
                className="text-sm font-semibold uppercase tracking-[0.2em] text-gold"
              >
                Check availability
              </h2>
              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                Select dates to see room types with space left. Submit a reservation request with ID and payment receipt;
                the front desk confirms it.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner shadow-black/40 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Check-in
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => setCheckIn(e.target.value)}
                className={cn(
                  "mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5",
                  "text-sm text-white outline-none transition-colors",
                  "focus:border-gold/50 focus:ring-2 focus:ring-gold/20",
                )}
              />
            </label>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Check-out
              <input
                type="date"
                value={checkOut}
                min={addLocalDays(checkIn, 1)}
                onChange={(e) => setCheckOut(e.target.value)}
                className={cn(
                  "mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5",
                  "text-sm text-white outline-none transition-colors",
                  "focus:border-gold/50 focus:ring-2 focus:ring-gold/20",
                )}
              />
            </label>
          </div>
          <Button
            type="button"
            onClick={runSearch}
            disabled={pending}
            className={cn(
              "h-11 shrink-0 rounded-xl bg-gold px-6 font-semibold text-black shadow-lg shadow-gold/10",
              "hover:bg-gold/90 disabled:opacity-60",
            )}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-2">{pending ? "Searching…" : "Search"}</span>
          </Button>
        </div>

        {fetchError ? (
          <p className="mt-4 rounded-lg border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {fetchError}
          </p>
        ) : null}

        {quote && quote.room_types.length === 0 ? (
          <p className="mt-6 text-center text-sm text-zinc-500">
            No room categories are configured for this property yet.
          </p>
        ) : null}

        {quote && quote.room_types.length > 0 && availableRoomTypes.length === 0 ? (
          <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-4 text-center text-sm text-amber-100/90">
            No rooms are available for these dates. Try different dates or contact the property.
          </p>
        ) : null}

        {quote && availableRoomTypes.length > 0 ? (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
              <p className="text-sm text-zinc-400">
                <span className="font-medium text-zinc-200">{quote.nights}</span> night
                {quote.nights === 1 ? "" : "s"}
                <span className="text-zinc-600"> · </span>
                <span className="tabular-nums text-zinc-300">{quote.check_in}</span>
                <span className="text-zinc-600"> → </span>
                <span className="tabular-nums text-zinc-300">{quote.check_out}</span>
              </p>
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                Showing categories with availability only
              </p>
            </div>

            <ul className="grid gap-4 md:grid-cols-2">
              {availableRoomTypes.map((row) => (
                <li
                  key={row.room_type_id}
                  className={cn(
                    "rounded-2xl border bg-white/[0.03] p-5 transition-colors",
                    "border-emerald-500/20",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white">{row.name}</h3>
                      {row.capacity != null ? (
                        <p className="mt-1 text-xs text-zinc-500">Up to {row.capacity} guests</p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                      {row.available_count} left
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-white/5 pt-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Per night</p>
                      <p className="text-lg font-semibold tabular-nums text-white">
                        {formatMoneyCentsWithCurrency(row.nightly_cents, quote.currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Stay total (1 room)</p>
                      <p className="text-lg font-semibold tabular-nums text-gold">
                        {formatMoneyCentsWithCurrency(row.stay_total_one_room_cents, quote.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10",
                      )}
                      onClick={() => openReserve(row)}
                    >
                      Reservations
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function scrollToPortfolioBooking() {
  if (typeof document === "undefined") return;
  document.getElementById("portfolio-booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
