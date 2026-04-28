import Link from "next/link";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { fetchTenantGuestsList } from "@/lib/queries/hrrm-guests-list";
import { redirect } from "next/navigation";
import { GuestsDirectoryClient } from "@/components/hrrm/guests-directory-client";

export default async function HrrmGuestsPage() {
  const ctx = await getUserContext();
  if (!ctx?.tenantId) redirect("/login");

  const { rows, error, columns } = await fetchTenantGuestsList(ctx.tenantId);
  const access = await getServiceAccessForLayout(ctx, "hrrm");
  const canManage = access === "manage";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
          Guests
        </h1>
        <p className="mt-1 text-sm text-muted">
          A clean guest directory with only the core profile information. Open a guest when you need the full detail view.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">{error}</p>
      ) : null}

      {columns === "basic" && !error ? (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          Showing basic guest fields only. Run the latest Supabase migration for <code className="text-muted">guests</code> to show
          age, party size, and payment on this list.
        </p>
      ) : null}

      {!error ? <GuestsDirectoryClient rows={rows} columns={columns} canManage={canManage} /> : null}

      <p className="text-sm text-muted">
        <Link href="/hrrm/front-desk" className="text-gold hover:underline">
          ← Front desk
        </Link>{" "}
        to register a walk-in and assign a room.
      </p>
    </div>
  );
}
