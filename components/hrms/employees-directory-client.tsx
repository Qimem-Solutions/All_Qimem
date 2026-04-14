"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HrmsLinkButton } from "@/components/hrms/hrms-link-button";
import { EmployeeRowActions } from "@/components/hrms/employee-row-actions";
import { AddDepartmentButton } from "@/components/hrms/add-department-button";
import { CreateStaffButton } from "@/components/hrms/create-staff-button";
import { formatDate } from "@/lib/format";

export type EmployeeRow = {
  id: string;
  kind: "employee" | "account";
  employee_code: string | null;
  full_name: string;
  email: string | null;
  job_title: string | null;
  status: string;
  hire_date: string | null;
  department_id: string | null;
  department_name: string | null;
};

function StatusBadge({ s, kind }: { s: string; kind: "employee" | "account" }) {
  if (kind === "account") return <Badge tone="green">Account</Badge>;
  const x = s.toLowerCase();
  if (x === "active") return <Badge tone="gold">Active</Badge>;
  if (x === "pending" || x === "probation") return <Badge tone="orange">Pending</Badge>;
  if (x === "leave" || x === "on_leave") return <Badge tone="red">On leave</Badge>;
  if (x === "terminated" || x === "inactive") return <Badge tone="gray">Inactive</Badge>;
  return <Badge tone="gray">{s}</Badge>;
}

type Props = {
  tenantId: string;
  rows: EmployeeRow[];
  error: string | null;
  /** All departments for this tenant — drives the filter (not only departments present on rows). */
  allDepartments: { id: string; name: string }[];
  /** HRMS manage: show add department + add staff (no redirect to hotel module picker). */
  canManageStaff: boolean;
  departmentsForStaffForm: { id: string; name: string }[];
  departmentFormError: string | null;
};

export function EmployeesDirectoryClient({
  tenantId,
  rows,
  error,
  allDepartments,
  canManageStaff,
  departmentsForStaffForm,
  departmentFormError,
}: Props) {
  const [q, setQ] = useState("");
  /** "" = all, "__none__" = no department / account-only, else department name */
  const [dept, setDept] = useState<string>("");

  const departmentFilterNames = useMemo(() => {
    return [...allDepartments.map((d) => d.name)].sort((a, b) => a.localeCompare(b));
  }, [allDepartments]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept === "__none__") {
        if (r.kind === "account") return true;
        if (!r.department_name) return true;
        return false;
      }
      if (dept && (r.department_name ?? "") !== dept) return false;
      if (!needle) return true;
      const hay = `${r.full_name} ${r.employee_code ?? ""} ${r.email ?? ""} ${r.id} ${r.kind}`
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, dept]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Employee directory
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Everyone on this property: employee records and tenant login accounts. Filter by department
            or search below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-pressed={showAdvanced}
          >
            {showAdvanced ? "Hide filters" : "Advanced filters"}
          </Button>
          {canManageStaff ? (
            <>
              <AddDepartmentButton />
              <CreateStaffButton departments={departmentsForStaffForm} />
            </>
          ) : (
            <HrmsLinkButton href="/hotel/dashboard" variant="primary">
              Property admin & access
            </HrmsLinkButton>
          )}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {departmentFormError && canManageStaff ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Could not load departments for the staff form: {departmentFormError}
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Staff roster</CardTitle>
            <CardDescription>
              {filtered.length === rows.length
                ? "Sorted by name."
                : `Showing ${filtered.length} of ${rows.length} people.`}
            </CardDescription>
          </div>
          <div className="flex w-full max-w-lg flex-wrap gap-2">
            <Input
              placeholder="Search name, code, email, or ID..."
              className="min-w-[160px] flex-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search employees"
            />
            <select
              className="h-10 min-w-[140px] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="">All departments</option>
              <option value="__none__">Unassigned / account only</option>
              {departmentFilterNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {showAdvanced ? (
            <p className="mb-4 rounded-lg border border-border bg-surface/40 px-3 py-2 text-xs text-zinc-400">
              Filters combine: department (including unassigned), search. Clear to reset.
            </p>
          ) : null}
          {filtered.length === 0 && !error ? (
            <p className="text-sm text-zinc-500">
              {rows.length === 0
                ? "No people loaded for this property. If you seeded demo data, confirm your profile’s tenant matches that property (or run the seed for your slug). You can also add staff and departments above when you have HRMS manage access."
                : "No rows match your filters. Try All departments or clear search."}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Title & department</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Join date</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr id={`emp-${r.id}`} key={r.id} className="border-b border-border/60 scroll-mt-24">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold">
                          {r.full_name
                            .split(" ")
                            .map((x: string) => x[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{r.full_name}</p>
                          <p className="text-xs text-zinc-500">
                            {r.kind === "account"
                              ? "Login only"
                              : r.employee_code ?? r.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <p className="text-white">{r.job_title ?? "—"}</p>
                      <p className="text-xs text-gold">{r.department_name ?? "—"}</p>
                    </td>
                    <td className="py-4">
                      <StatusBadge s={r.status} kind={r.kind} />
                    </td>
                    <td className="py-4 text-zinc-400">
                      {r.hire_date ? formatDate(r.hire_date) : "—"}
                    </td>
                    <td className="py-4 text-right">
                      {canManageStaff && r.kind === "employee" ? (
                        <EmployeeRowActions row={r} tenantId={tenantId} departments={allDepartments} />
                      ) : (
                        <span className="text-xs text-zinc-600">
                          {r.kind === "account" ? "Account" : "View only"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-xs text-zinc-600">
            Showing {filtered.length} {filtered.length === 1 ? "person" : "people"}
            {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
