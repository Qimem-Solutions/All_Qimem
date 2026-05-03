/** Shown on public portfolio when guests pay before front desk confirms. */
export const PORTFOLIO_PAYMENT_ACCOUNTS = {
  cbe: { label: "CBE", accountNumber: "10000430543034035" },
  telebirr: { label: "TeleBirr", number: "0909090909" },
} as const;

export function portfolioPaymentSnapshotJson() {
  return {
    cbe_account: PORTFOLIO_PAYMENT_ACCOUNTS.cbe.accountNumber,
    cbe_label: PORTFOLIO_PAYMENT_ACCOUNTS.cbe.label,
    telebirr: PORTFOLIO_PAYMENT_ACCOUNTS.telebirr.number,
    telebirr_label: PORTFOLIO_PAYMENT_ACCOUNTS.telebirr.label,
  };
}
