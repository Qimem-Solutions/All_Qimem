import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export default function FrontDeskPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Front desk
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Property operations snapshot — deep workflows live under Concierge and Dashboard.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Concierge station</CardTitle>
            <CardDescription>Guest search, queue, and room assignment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/hrrm/concierge">
              <Button className="w-full gap-2">
                Open concierge <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operational overview</CardTitle>
            <CardDescription>KPIs, arrivals, heatmap.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/hrrm/dashboard">
              <Button variant="secondary" className="w-full gap-2">
                Open dashboard <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
