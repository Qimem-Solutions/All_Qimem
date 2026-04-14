import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchRatePlans } from "@/lib/queries/tenant-data";
import { formatMoneyCents } from "@/lib/format";

export default async function RatesPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Rate plans & pricing
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load rate plans.
        </p>
      </div>
    );
  }

  const { rows: plans, error } = await fetchRatePlans(tenantId);
  const active = plans.filter((p) => p.is_active).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Rate plans & pricing
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rows from rate_plans for this property.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" disabled>
            Export matrix
          </Button>
          <Button type="button" disabled>
            + Create rate plan
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rate plans</CardTitle>
              <Badge tone="green">
                {active} active{plans.length !== active ? ` · ${plans.length - active} inactive` : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {plans.length === 0 && !error ? (
              <p className="text-sm text-zinc-500">No rate plans yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Policy</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Base price</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-4">
                        <p className="font-medium text-white">{p.name}</p>
                      </td>
                      <td className="py-4 text-zinc-400">{p.policy ?? "—"}</td>
                      <td className="py-4">
                        <Badge tone={p.is_active ? "green" : "gray"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-4 text-right text-lg font-semibold text-gold">
                        {formatMoneyCents(p.base_amount_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Channel distribution</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-500">
              Connect OTA / channel mix when you store it.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-zinc-500">Plans</p>
                <p className="text-lg font-semibold text-gold">{plans.length}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Active</p>
                <p className="text-lg font-semibold text-white">{active}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Seasonal overrides</h2>
          <button type="button" className="text-xs text-gold hover:underline" disabled>
            Manage calendar
          </button>
        </div>
        <p className="text-sm text-zinc-500">Overrides are not modeled in the schema yet.</p>
      </div>
    </div>
  );
}
