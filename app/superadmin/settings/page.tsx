import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function GlobalSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Global settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Feature flags, integration defaults, compliance toggles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding & support</CardTitle>
          <CardDescription>Shown in invitation emails and status pages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-400">
              Support URL
            </label>
            <Input defaultValue="https://support.allqimem.com" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-400">
              Status page
            </label>
            <Input defaultValue="https://status.allqimem.com" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Platform-wide policies (MFA, session TTL).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button variant="secondary">Require MFA for Superadmin</Button>
          <Button variant="outline">Rotate signing keys</Button>
        </CardContent>
      </Card>
    </div>
  );
}
