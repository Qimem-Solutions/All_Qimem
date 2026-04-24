import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchHotelTenantSettings } from "@/lib/queries/tenant-data";
import { HotelSettingsForms } from "@/components/hotel/hotel-settings-forms";

export default async function HotelSettingsPage() {
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
          Property settings
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Your profile has no property linked. Ask a platform admin to assign a tenant before
          changing settings.
        </p>
      </div>
    );
  }

  const { settings, error } = await fetchHotelTenantSettings(tenantId);

  if (error) {
    const isMissingCols =
      error.toLowerCase().includes("column") && error.toLowerCase().includes("does not exist");
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Property settings
        </h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Database update required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted">
            <p>Settings could not load: {error}</p>
            {isMissingCols ? (
              <p>
                Run the latest Supabase migration (e.g. <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-xs">20260425130000_tenant_hotel_settings.sql</code>
                ) so the <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-xs">tenants</code> table includes hotel settings columns and RLS for hotel
                administrators.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Property settings
        </h1>
        <p className="text-sm text-muted">Property record not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Property settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          General information, branding, contact defaults, and a shortcut to your subscription. Only
          hotel administrators can change these.
        </p>
      </div>
      <HotelSettingsForms settings={settings} />
    </div>
  );
}
