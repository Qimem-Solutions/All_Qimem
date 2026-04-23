/** Shared estimate for quick reservation; amounts are in whole cents. */
export const RESORT_FEE_PER_NIGHT_CENTS = 4_000;
export const TAX_RATE = 0.1;

export function addDaysToIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00.000Z`);
  const b = new Date(`${checkOut}T12:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export function quoteFromNightlyCents(nightlyCents: number, nights: number) {
  const subtotal = nightlyCents * nights;
  const resort = RESORT_FEE_PER_NIGHT_CENTS * nights;
  const taxable = subtotal + resort;
  const tax = Math.round(taxable * TAX_RATE);
  const total = subtotal + resort + tax;
  return { subtotal, resort, tax, total, nights };
}
