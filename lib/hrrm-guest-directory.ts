import { formatMoneyCents } from "@/lib/format";

/** Shared guest directory row (used by server queries and client UI; no server-only imports). */

export type GuestStaySummary = {
  /** The reservation used for the displayed stay (for checkout / recheck). */
  reservationId: string | null;
  roomId: string | null;
  roomNumber: string | null;
  checkIn: string | null;
  checkOut: string | null;
  /** Number of nights (checkout − checkin). */
  nights: number | null;
  /** Human-friendly stay phase for the “best” reservation shown. */
  label: string;
  rawStatus: string | null;
};

export type GuestDirectoryRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string | null;
  age: number | null;
  party_size: number | null;
  registration_payment_cents: number | null;
  payment_method: string | null;
  /** The stay we show for this row (in-house preferred, else upcoming, else most recent past). */
  stay: GuestStaySummary | null;
};

export function formatGuestRowPayment(r: GuestDirectoryRow): string {
  if (r.registration_payment_cents == null) return "—";
  return formatMoneyCents(r.registration_payment_cents);
}
