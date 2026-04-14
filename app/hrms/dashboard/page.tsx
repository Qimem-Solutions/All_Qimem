import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  Trophy,
  Shield,
  UserPlus,
  Calendar,
  Wallet,
  FileText,
  Zap,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { fetchHrmsDashboardStats } from "@/lib/queries/tenant-data";

export default async function HrmsDashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          HRMS insights
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Link your profile to a tenant to load HRMS metrics.
        </p>
      </div>
    );
  }

  const s = await fetchHrmsDashboardStats(tenantId);
  const name = ctx.fullName ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Administrator insights
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome back, {name}. Live counts from Supabase for your property.
        </p>
        {s.error ? (
          <p className="mt-2 text-sm text-amber-400">{s.error}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-zinc-400">Total headcount</CardTitle>
            <Badge tone="green">Live</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{s.employeeCount}</p>
            <p className="mt-1 text-xs text-zinc-500">Employees table · this tenant</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Shifts today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{s.shiftsToday}</p>
            <p className="text-xs text-zinc-500">shifts.shift_date = today (local UTC date)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-zinc-400">Attendance punches today</CardTitle>
            <Megaphone className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{s.punchesToday}</p>
            <p className="mt-2 text-xs text-zinc-500">Since midnight UTC</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Internal announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">
              No announcements stored yet — add a table or CMS when you are ready.
            </p>
            <div className="flex gap-3 rounded-lg border border-border/60 bg-surface/50 p-4 opacity-60">
              <Trophy className="h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="font-medium text-white">Placeholder</p>
                <p className="text-sm text-zinc-500">Connect content to real data when available.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-border/60 bg-surface/50 p-4 opacity-60">
              <Shield className="h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="font-medium text-white">Policies</p>
                <p className="text-sm text-zinc-500">Link HR policy docs from storage or a CMS.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Shortcuts for HR operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="justify-start gap-2" type="button" disabled>
                <UserPlus className="h-4 w-4" /> New hire
              </Button>
              <Button variant="secondary" className="justify-start gap-2" type="button" disabled>
                <Calendar className="h-4 w-4" /> Leave request
              </Button>
              <Button variant="secondary" className="justify-start gap-2" type="button" disabled>
                <Wallet className="h-4 w-4" /> Run payroll
              </Button>
              <Button variant="secondary" className="justify-start gap-2" type="button" disabled>
                <FileText className="h-4 w-4" /> Audit log
              </Button>
            </div>
            <Button className="mt-4 w-full gap-2" type="button" disabled>
              <Zap className="h-4 w-4" /> System overview
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
