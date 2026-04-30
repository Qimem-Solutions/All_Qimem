/** Display amounts for superadmin billing / invoices (ETB per month). */
export const PLAN_ETB_DISPLAY: Record<string, { amount: string; name: string }> = {
  basic: { amount: "2000", name: "Basic" },
  pro: { amount: "3000", name: "Pro" },
  advanced: { amount: "4000", name: "Advanced" },
};

export function planPricingDisplay(plan: string | null) {
  if (!plan) return { amount: "—", name: "—" as string };
  const p = plan.toLowerCase();
  return PLAN_ETB_DISPLAY[p] ?? { amount: "—", name: plan };
}
