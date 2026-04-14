import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperadminBillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Billing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Invoices, payment methods, and platform billing — connect to your provider.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Wire Stripe or your billing backend; this shell matches the Superadmin navigation.
        </CardContent>
      </Card>
    </div>
  );
}
