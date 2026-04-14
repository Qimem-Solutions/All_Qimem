import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperadminSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Support
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Internal runbooks and escalation paths for the platform team.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          Replace with ticketing link, Slack channel, or PagerDuty integration.
        </CardContent>
      </Card>
    </div>
  );
}
