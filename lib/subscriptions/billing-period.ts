/**
 * Default billing period end: subscription row `created_at` + 30 calendar days (UTC).
 * Keeps app inserts aligned with SQL `created_at + interval '30 days'`.
 */
export function subscriptionPeriodEndFromCreatedAt(createdAt: Date): string {
  const d = new Date(createdAt.getTime());
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString();
}

/** Use at insert time when `created_at` will be ~now(). */
export function subscriptionPeriodEndFromNow(): string {
  return subscriptionPeriodEndFromCreatedAt(new Date());
}

/** UTC calendar month containing `iso` as YYYY-MM-01 (for `subscription_billing_events.service_month`). */
export function billingServiceMonthFromPeriodEndIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    const y = fallback.getUTCFullYear();
    const m = fallback.getUTCMonth() + 1;
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}
