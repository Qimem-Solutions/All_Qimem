import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import {
  fetchHrmsReportsAnalytics,
  fetchTenantDepartmentsForSelect,
  fetchTenantUsersForHotel,
} from "@/lib/queries/tenant-data";
import { AddDepartmentButton } from "@/components/hrms/add-department-button";
import { CreateStaffButton } from "@/components/hrms/create-staff-button";
import { HotelUsersTabs } from "./hotel-users-tabs";

export default async function HotelUsersPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "hotel_admin") {
    redirect("/hotel/dashboard");
  }
  const tenantId = ctx.tenantId;
  const canManageStaff = ctx.globalRole === "hotel_admin";

  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          User & access management
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Your profile has no tenant. Link a property to load users.
        </p>
      </div>
    );
  }

  const [{ rows: users, error }, { rows: departmentsForSelect, error: deptSelectErr }, analytics] =
    await Promise.all([
      fetchTenantUsersForHotel(tenantId),
      fetchTenantDepartmentsForSelect(tenantId),
      fetchHrmsReportsAnalytics(tenantId),
    ]);
  const deptCountsRes = {
    rows: analytics.departments,
    error: analytics.error,
  };

  const roleBuckets: Record<string, number> = {};
  for (const u of users) {
    const key = u.global_role ?? "user";
    roleBuckets[key] = (roleBuckets[key] ?? 0) + 1;
  }
  const bucketEntries = Object.entries(roleBuckets).sort((a, b) => b[1] - a[1]);
  const maxBucket = Math.max(1, ...bucketEntries.map(([, n]) => n));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            User & access management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Staff logins use <strong className="text-zinc-400">profiles</strong> (tenant) +{" "}
            <strong className="text-zinc-400">employees</strong> +{" "}
            <strong className="text-zinc-400">user_roles</strong> for HRMS/HRRM (none / view /
            manage). Add departments first, then assign staff to a department when you create them.
          </p>
        </div>
        {canManageStaff ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AddDepartmentButton />
            <CreateStaffButton departments={deptSelectErr ? [] : departmentsForSelect} />
          </div>
        ) : (
          <Button type="button" disabled variant="outline">
            + Add staff (hotel admin only)
          </Button>
        )}
      </div>

      {deptSelectErr ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Could not load departments for the staff form: {deptSelectErr}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <HotelUsersTabs
        users={users}
        departments={deptCountsRes.rows}
        departmentError={deptCountsRes.error}
        bucketEntries={bucketEntries}
        maxBucket={maxBucket}
        departmentsForSelect={deptSelectErr ? [] : departmentsForSelect}
        currentUserId={ctx.userId}
      />
    </div>
  );
}
