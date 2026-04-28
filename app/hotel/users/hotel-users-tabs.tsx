"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import type { TenantUserWithEmployee } from "@/lib/queries/tenant-data";
import type { DepartmentCountRow } from "@/lib/queries/tenant-data";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";
import { HotelDepartmentRowActions } from "@/components/hotel/hotel-department-row-actions";
import { HotelStaffRowActions } from "@/components/hotel/hotel-staff-row-actions";

function formatRole(role: string | null) {
  if (!role) return "user";
  return role.replace(/_/g, " ");
}

function accessTone(a: ServiceAccessLevel) {
  if (a === "manage") return "gold" as const;
  if (a === "view") return "orange" as const;
  return "gray" as const;
}

function accessLabel(a: ServiceAccessLevel) {
  if (a === "manage") return "Manage";
  if (a === "view") return "View";
  return "None";
}

function staffStatusBadge(u: TenantUserWithEmployee) {
  if (u.employee) {
    const s = (u.employee.status ?? "active").toLowerCase();
    if (s === "active" || s === "probation" || s === "pending")
      return <Badge tone="green">{(u.employee.status ?? "active").replace(/_/g, " ")}</Badge>;
    if (s === "inactive" || s === "terminated")
      return <Badge tone="gray">{(u.employee.status ?? "inactive").replace(/_/g, " ")}</Badge>;
    if (s === "on_leave") return <Badge tone="orange">on leave</Badge>;
    return <Badge tone="gray">{u.employee.status}</Badge>;
  }
  return <Badge tone="gray">no HR record</Badge>;
}

type TabId = "staff" | "departments";

export function HotelUsersTabs({
  users,
  departments,
  departmentError,
  bucketEntries,
  maxBucket,
  departmentsForSelect,
  currentUserId,
}: {
  users: TenantUserWithEmployee[];
  departments: DepartmentCountRow[];
  departmentError: string | null;
  bucketEntries: [string, number][];
  maxBucket: number;
  departmentsForSelect: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<TabId>("staff");
  const staffTotal = users.length;
  const withHrRecord = users.filter((u) => u.employee).length;

  return (
    <>
      <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-sm">
        <button
          type="button"
          onClick={() => setTab("staff")}
          className={cn(
            "border-b-2 pb-2 font-medium transition-colors",
            tab === "staff"
              ? "border-gold text-gold"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          All staff ({staffTotal})
        </button>
        <button
          type="button"
          onClick={() => setTab("departments")}
          className={cn(
            "border-b-2 pb-2 font-medium transition-colors",
            tab === "departments"
              ? "border-gold text-gold"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          All departments ({departments.length})
        </button>
      </div>

      {tab === "staff" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle>Platform users</CardTitle>
                  <CardDescription>
                    Profiles linked to Supabase Auth for this tenant, with per-suite access.
                  </CardDescription>
                </div>
                {staffTotal > 0 ? (
                  <div
                    className="flex shrink-0 flex-col items-start gap-1 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 sm:items-end"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      All staff
                    </span>
                    <span className="text-3xl font-semibold tabular-nums leading-none text-gold">
                      {staffTotal}
                    </span>
                    {withHrRecord < staffTotal ? (
                      <span className="text-[11px] text-muted">
                        {withHrRecord} with HR record · {staffTotal - withHrRecord} without
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted">Listed in the table below</span>
                    )}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-sm text-muted">No users in this tenant yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <p className="mb-4 text-sm text-muted">
                    Staff list —{" "}
                    <strong className="font-semibold tabular-nums text-foreground">{staffTotal}</strong>{" "}
                    <span className="text-foreground/90">
                      account{staffTotal === 1 ? "" : "s"}
                    </span>{" "}
                    total
                  </p>
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                        <th className="pb-3 font-medium">User identity</th>
                        <th className="pb-3 font-medium">Platform role</th>
                        <th className="pb-3 font-medium">HRMS</th>
                        <th className="pb-3 font-medium">HRRM</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Member since</th>
                        <th className="pb-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border/60">
                          <td className="py-4">
                            <p className="font-medium text-foreground">
                              {u.full_name ?? u.id.slice(0, 8) + "…"}
                            </p>
                            <p className="text-xs font-mono text-muted">{u.id}</p>
                          </td>
                          <td className="py-4">
                            <Badge
                              tone={
                                u.global_role === "hotel_admin"
                                  ? "gold"
                                  : u.global_role === "superadmin"
                                    ? "red"
                                    : "gray"
                              }
                            >
                              {(u.global_role ?? "user").toUpperCase().replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="py-4">
                            <Badge tone={accessTone(u.hrms_access)}>{accessLabel(u.hrms_access)}</Badge>
                          </td>
                          <td className="py-4">
                            <Badge tone={accessTone(u.hrrm_access)}>{accessLabel(u.hrrm_access)}</Badge>
                          </td>
                          <td className="py-4">{staffStatusBadge(u)}</td>
                          <td className="py-4 text-muted">{formatRelative(u.created_at)}</td>
                          <td className="py-4 text-right">
                            <HotelStaffRowActions
                              user={u}
                              departments={departmentsForSelect}
                              currentUserId={currentUserId}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-muted">
                Showing all {staffTotal} staff account{staffTotal === 1 ? "" : "s"} · Tenant-scoped
                reads (hotel admins see all profiles in their property).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Role distribution</CardTitle>
              <CardDescription>Users in this property by global platform role.</CardDescription>
            </CardHeader>
            <CardContent>
              {bucketEntries.length === 0 ? (
                <p className="text-sm text-muted">No role data.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {bucketEntries.map(([label, n]) => (
                    <div key={label} className="min-w-0">
                      <div className="mb-1.5 flex justify-between text-sm text-muted">
                        <span className="truncate font-medium capitalize text-foreground">
                          {formatRole(label)}
                        </span>
                        <span className="shrink-0 pl-2">
                          {n} user{n === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                        <div
                          className="h-full min-w-0 rounded-full bg-gold/70"
                          style={{ width: `${Math.round((n / maxBucket) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>
              HR employee totals include people without a login.{" "}
              <strong className="font-medium text-foreground/90">With login</strong> counts rows linked to a Supabase
              user — those align with who can appear under{" "}
              <strong className="font-medium text-foreground/90">All staff</strong> (platform users).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departmentError ? (
              <p className="text-sm text-red-700 dark:text-red-200">{departmentError}</p>
            ) : departments.length === 0 ? (
              <p className="text-sm text-muted">
                No departments yet. Use <strong className="text-foreground">+ Add department</strong>{" "}
                above, then assign staff when you create them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                      <th className="pb-3 font-medium">Department</th>
                      <th className="pb-3 font-medium">Visibility</th>
                      <th className="pb-3 font-medium">HR employees</th>
                      <th className="pb-3 font-medium">With login</th>
                      <th className="pb-3 font-medium">ID</th>
                      <th className="pb-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => (
                      <tr key={d.id} className="border-b border-border/60">
                        <td className="py-4 font-medium text-foreground">
                          <span className="inline-flex items-center gap-2">
                            {d.name}
                            {d.is_active === false ? (
                              <Badge tone="gray">Inactive</Badge>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-4 text-muted">
                          {d.is_active === false
                            ? "Hidden from new assignments"
                            : "Active in pickers"}
                        </td>
                        <td className="py-4 tabular-nums text-foreground/90">{d.employee_count}</td>
                        <td className="py-4 tabular-nums text-gold/90">{d.linked_login_count}</td>
                        <td className="py-4 font-mono text-xs text-muted">{d.id}</td>
                        <td className="py-4 text-right">
                          <HotelDepartmentRowActions department={d} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!departmentError ? (
              <p className="mt-4 text-xs text-muted">
                {departments.length} department{departments.length === 1 ? "" : "s"} · HR employees =
                all workforce rows in HRMS; With login = linked to an Auth user (same pool as the staff tab).
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}
