import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchSubscriptionPlansSummary,
  fetchSubscriptionsWithTenants,
} from "@/lib/queries/superadmin";
import { fetchPendingPlanChangeRequestsForSuperadmin } from "@/lib/queries/plan-change-requests";
import { SuperadminPendingPlanRequests } from "@/components/superadmin/superadmin-pending-plan-requests";
import { formatDate } from "@/lib/format";

const productPlans = [
  {
    name: "Basic",
    keys: ["HRRM core", "HRMS directory"],
    price: "Configure in billing",
  },
  {
    name: "Pro",
    keys: ["+ Advanced rates", "+ Scheduling / attendance"],
    price: "Configure in billing",
  },
  {
    name: "Advanced",
    keys: ["+ Cross-service reporting", "+ Full API"],
    price: "Custom",
  },
];

export default async function SubscriptionsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const [{ rows: subs, error: listErr }, { byPlan, error: planErr }, { rows: pendingRequests, error: pendingErr }] =
    await Promise.all([
      fetchSubscriptionsWithTenants(),
      fetchSubscriptionPlansSummary(),
      fetchPendingPlanChangeRequestsForSuperadmin(),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Subscriptions & entitlements
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live subscription rows from Supabase; plan cards describe typical entitlements.
        </p>
      </div>

      {listErr || planErr ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
          {[listErr, planErr].filter(Boolean).join(" ")}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Plan change requests</CardTitle>
          <CardDescription>
            Hotels use <span className="font-semibold text-zinc-300">Request plan change</span> on their
            subscription page. Approve to update their row in <code className="text-xs">subscriptions</code>
            , or decline to close the request without changing billing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingErr ? (
            <p className="text-sm text-amber-200">
              {pendingErr}
              {pendingErr.toLowerCase().includes("relation") || pendingErr.includes("does not exist")
                ? " — Run the migration that creates subscription_plan_requests."
                : null}
            </p>
          ) : (
            <SuperadminPendingPlanRequests rows={pendingRequests} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {productPlans.map((p) => {
          const key = p.name.toLowerCase() as keyof typeof byPlan;
          const count =
            key === "basic" || key === "pro" || key === "advanced" ? byPlan[key] : 0;
          return (
            <Card key={p.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  <Badge tone="gold">{count} active</Badge>
                </div>
                <CardDescription>Typical entitlement keys</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-zinc-400">
                  {p.keys.map((k) => (
                    <li key={k}>• {k}</li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-zinc-500">{p.price}</p>
                <Button variant="secondary" className="mt-4 w-full" type="button" disabled>
                  Assign plan
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription records</CardTitle>
          <CardDescription>All rows in `subscriptions`.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {subs.length === 0 && !listErr ? (
            <p className="text-sm text-zinc-500">No subscription rows yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-zinc-500">
                  <th className="pb-3 font-medium">Tenant</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Period end</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-3 font-medium text-white">{s.tenant_name ?? s.tenant_id}</td>
                    <td className="py-3 capitalize">{s.plan}</td>
                    <td className="py-3">
                      <Badge tone={s.status === "active" ? "green" : "gray"}>{s.status}</Badge>
                    </td>
                    <td className="py-3 text-zinc-400">{formatDate(s.current_period_end)}</td>
                    <td className="py-3 text-zinc-500">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
