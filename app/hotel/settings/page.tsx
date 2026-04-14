import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchTenantName } from "@/lib/queries/tenant-data";

export default async function HotelSettingsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "hotel_admin") {
    redirect("/hotel/dashboard");
  }
  const tenantId = ctx.tenantId;
  const { name } = tenantId ? await fetchTenantName(tenantId) : { name: null };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
        Property settings
      </h1>
      {!tenantId ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          No tenant linked — settings cannot load property name.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="max-w-md">
          <label className="mb-2 block text-xs text-zinc-400">Display name</label>
          <Input defaultValue={name ?? ""} readOnly placeholder="Tenant name from database" />
        </CardContent>
      </Card>
    </div>
  );
}
