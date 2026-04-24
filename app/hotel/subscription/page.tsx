import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchTenantName, fetchTenantSubscription } from "@/lib/queries/tenant-data";
import { fetchPendingPlanRequestForTenant } from "@/lib/queries/plan-change-requests";
import { formatDate } from "@/lib/format";
import { HotelSubscriptionForm } from "@/components/hotel/hotel-subscription-form";

export default async function HotelSubscriptionPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "hotel_admin") {
    redirect("/hotel/dashboard");
  }
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Subscription
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100 dark:text-amber-100">
          Your profile has no property linked. Ask a platform admin to assign a tenant before managing
          billing.
        </p>
      </div>
    );
  }

  const [
    { name: propertyName },
    { subscription, error: subErr },
    { request: pendingRequest, error: pendingErr },
  ] = await Promise.all([
    fetchTenantName(tenantId),
    fetchTenantSubscription(tenantId),
    fetchPendingPlanRequestForTenant(tenantId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Subscription
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          View your plan and billing period. To switch tiers, submit a request — a platform superadmin
          must approve it before your subscription record is updated.
        </p>
      </div>

      {subErr ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {subErr}
        </p>
      ) : null}
      {pendingErr ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {pendingErr}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Property</CardTitle>
          <CardDescription>
            <span className="text-foreground/90">{propertyName ?? tenantId}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      {!subscription && !subErr ? (
        <Card>
          <CardHeader>
            <CardTitle>No subscription on file</CardTitle>
            <CardDescription>
              There is no row in <code className="text-xs">subscriptions</code> for this tenant yet.
              Ask a platform administrator to provision billing, or run the tenant setup flow.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {subscription ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>Status and renewal as stored for this property.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-6 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Plan</p>
                <p className="mt-1 capitalize text-foreground">{subscription.plan}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Status</p>
                <p className="mt-1">
                  <Badge tone={subscription.status === "active" ? "green" : "gray"}>
                    {subscription.status}
                  </Badge>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Current period ends
                </p>
                <p className="mt-1 text-foreground">{formatDate(subscription.current_period_end)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request a plan change</CardTitle>
              <CardDescription>
                Choose the target tier. Your request is sent to the platform team for approval. For
                invoices or payment methods, contact your account team.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-xl">
              <HotelSubscriptionForm
                initialPlan={subscription.plan}
                hasPendingRequest={Boolean(pendingRequest)}
                requestedPlanForPending={pendingRequest?.requested_plan ?? null}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
