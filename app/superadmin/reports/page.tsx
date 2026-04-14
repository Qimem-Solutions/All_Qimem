import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SuperadminReportsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Aggregated reports
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Analytical rollups — avoid heavy cross-tenant OLTP queries in production.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">CSV</Button>
          <Button>Export PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy trend</CardTitle>
            <CardDescription>Derived from HRRM aggregates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end justify-between gap-2">
              {[40, 55, 48, 62, 71, 68, 75, 80].map((h, i) => (
                <div
                  key={i}
                  className="w-full rounded-t bg-gold/30"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-zinc-500">Last 8 rolling weeks (illustrative).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Headcount by region</CardTitle>
            <CardDescription>HRMS directory aggregates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              ["MEA", "6.2k"],
              ["EU", "7.8k"],
              ["AMER", "4.4k"],
            ].map(([r, v]) => (
              <div key={r} className="flex justify-between border-b border-border/50 py-2">
                <span className="text-zinc-400">{r}</span>
                <span className="font-medium text-white">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
