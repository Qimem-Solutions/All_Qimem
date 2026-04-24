import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchSuperadminTenantsReport } from "@/lib/queries/superadmin";
import { SuperadminBillingView } from "@/components/superadmin/superadmin-billing-view";

export const dynamic = "force-dynamic";

export default async function SuperadminBillingPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const { rows, error } = await fetchSuperadminTenantsReport();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Billing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tenant subscriptions, invoice-style register, and payment tools.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/40 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-white/5 md:p-6">
        <SuperadminBillingView rows={rows} error={error} />
      </div>
    </div>
  );
}
