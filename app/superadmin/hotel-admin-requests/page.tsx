import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserContext } from "@/lib/queries/context";
import { fetchPendingHotelAdminProfileChangeRequestsForSuperadmin } from "@/lib/queries/hotel-admin-profile-requests";
import { SuperadminHotelAdminProfileRequests } from "@/components/superadmin/superadmin-hotel-admin-profile-requests";
import { toUserFacingError } from "@/lib/errors/user-facing";

export default async function HotelAdminProfileRequestsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const { rows, error } = await fetchPendingHotelAdminProfileChangeRequestsForSuperadmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Hotel administrator requests
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          When a hotel administrator edits their own profile from{" "}
          <span className="font-semibold text-zinc-300">Users</span>, changes stay pending until you
          approve. Declining leaves their account unchanged.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending profile updates</CardTitle>
          <CardDescription>
            Approving applies name, HRMS/HRRM access, and linked employee fields exactly as requested.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-amber-200">{toUserFacingError(error)}</p>
          ) : (
            <SuperadminHotelAdminProfileRequests rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
