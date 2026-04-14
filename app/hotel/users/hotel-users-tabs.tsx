"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import type { TenantUserRow } from "@/lib/queries/tenant-data";
import type { DepartmentCountRow } from "@/lib/queries/tenant-data";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";

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

type TabId = "staff" | "departments";

export function HotelUsersTabs({
  users,
  departments,
  departmentError,
  bucketEntries,
  maxBucket,
}: {
  users: TenantUserRow[];
  departments: DepartmentCountRow[];
  departmentError: string | null;
  bucketEntries: [string, number][];
  maxBucket: number;
}) {
  const [tab, setTab] = useState<TabId>("staff");

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
              : "border-transparent text-zinc-500 hover:text-zinc-300",
          )}
        >
          All staff ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("departments")}
          className={cn(
            "border-b-2 pb-2 font-medium transition-colors",
            tab === "departments"
              ? "border-gold text-gold"
              : "border-transparent text-zinc-500 hover:text-zinc-300",
          )}
        >
          All departments ({departments.length})
        </button>
      </div>

      {tab === "staff" ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Platform users</CardTitle>
              <CardDescription>
                Profiles linked to Supabase Auth for this tenant, with per-suite access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-sm text-zinc-500">No users in this tenant yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wider text-zinc-500">
                        <th className="pb-3 font-medium">User identity</th>
                        <th className="pb-3 font-medium">Platform role</th>
                        <th className="pb-3 font-medium">HRMS</th>
                        <th className="pb-3 font-medium">HRRM</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Member since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border/60">
                          <td className="py-4">
                            <p className="font-medium text-white">
                              {u.full_name ?? u.id.slice(0, 8) + "…"}
                            </p>
                            <p className="text-xs font-mono text-zinc-500">{u.id}</p>
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
                          <td className="py-4">
                            <Badge tone="green">active</Badge>
                          </td>
                          <td className="py-4 text-zinc-400">{formatRelative(u.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-zinc-600">
                Showing {users.length} platform user{users.length === 1 ? "" : "s"} · Tenant-scoped
                reads (hotel admins see all profiles in their property).
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {bucketEntries.length === 0 ? (
                  <p className="text-zinc-500">No role data.</p>
                ) : (
                  bucketEntries.map(([label, n]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-zinc-400">
                        <span className="capitalize">{formatRole(label)}</span>
                        <span>
                          {n} user{n === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gold/70"
                          style={{ width: `${Math.round((n / maxBucket) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Password policy</CardTitle>
                <CardDescription>Configure in Supabase Auth settings.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" type="button" disabled>
                  Configure security
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>
              Departments for this property. Staff can be assigned when you add or edit employees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departmentError ? (
              <p className="text-sm text-red-200">{departmentError}</p>
            ) : departments.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No departments yet. Use <strong className="text-zinc-400">+ Add department</strong>{" "}
                above, then assign staff when you create them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-zinc-500">
                      <th className="pb-3 font-medium">Department</th>
                      <th className="pb-3 font-medium">Staff count</th>
                      <th className="pb-3 font-medium">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => (
                      <tr key={d.id} className="border-b border-border/60">
                        <td className="py-4 font-medium text-white">{d.name}</td>
                        <td className="py-4 text-zinc-300">{d.employee_count}</td>
                        <td className="py-4 font-mono text-xs text-zinc-500">{d.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!departmentError ? (
              <p className="mt-4 text-xs text-zinc-600">
                {departments.length} department{departments.length === 1 ? "" : "s"} · Counts are
                employees with this department in HRMS.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}
