import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchAvailabilityMatrix } from "@/lib/queries/hrrm-availability";
import { AvailabilityPageClient } from "@/components/hrrm/availability-page-client";

function LoadingFallback() {
  return <p className="text-sm text-muted">Loading availability…</p>;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; days?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Availability &amp; inventory
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Assign a tenant to load availability.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const todayIso = new Date().toISOString().slice(0, 10);
  const start =
    typeof sp.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.start) ? sp.start : todayIso;
  const dayCount = (() => {
    if (typeof sp.days !== "string") return 7;
    const n = parseInt(sp.days, 10);
    if (Number.isNaN(n)) return 7;
    return Math.min(14, Math.max(3, n));
  })();

  const matrix = await fetchAvailabilityMatrix(ctx.tenantId, start, dayCount);
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  const canManage = access === "manage";

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AvailabilityPageClient
        initial={matrix}
        startDate={start}
        dayCount={dayCount}
        canManage={canManage}
        todayIso={todayIso}
      />
    </Suspense>
  );
}
