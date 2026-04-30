import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchSuperadminTenantsReport } from "@/lib/queries/superadmin";
import { fetchSubscriptionBillingEventsForSuperadmin } from "@/lib/queries/subscription-billing";
import { SuperadminBillingView } from "@/components/superadmin/superadmin-billing-view";

export const dynamic = "force-dynamic";

export default async function SuperadminBillingPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const [{ rows, error }, { rows: billingRows, error: billingError }] = await Promise.all([
    fetchSuperadminTenantsReport(),
    fetchSubscriptionBillingEventsForSuperadmin(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Billing
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Tenant subscriptions, invoice-style register, and payment tools.
        </p>
      </div>

      <SuperadminBillingView
        rows={rows}
        error={error}
        billingRows={billingRows}
        billingError={billingError}
      />
    </div>
  );
}
