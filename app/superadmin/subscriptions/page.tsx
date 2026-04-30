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
import { SuperadminSubscriptionsTable } from "@/components/superadmin/superadmin-subscriptions-table";
import { sweepAllExpiredSubscriptions } from "@/lib/subscriptions/subscription-expiry";

const productPlans = [
  {
    name: "Basic",
    keys: ["HRRM core", "HRMS directory"],
    price: "ETB 2,000 / month",
  },
  {
    name: "Pro",
    keys: ["+ Advanced rates", "+ Scheduling / attendance"],
    price: "ETB 3,000 / month",
  },
  {
    name: "Advanced",
    keys: ["+ Cross-service reporting", "+ Full API"],
    price: "ETB 4,000 / month",
  },
];

export default async function SubscriptionsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  await sweepAllExpiredSubscriptions();

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
          <CardDescription>
            When <strong>period end</strong> passes, active subscriptions are marked inactive and all
            tenant users (including hotel admins) are blocked from signing in until a superadmin uses{" "}
            <strong>Update period (+1 month)</strong> on that row. Opening this page also runs an expiry
            sweep. Changing the plan updates entitlements tier immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuperadminSubscriptionsTable rows={subs} />
        </CardContent>
      </Card>
    </div>
  );
}
