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
import { formatDate, formatMoneyCents } from "@/lib/format";
import { employeePhotoSrc } from "@/lib/hrms/employee-photo-url";
import { cn } from "@/lib/utils";

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
  photo_url: string | null;
  monthly_salary_cents: number | null;
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

function initials(name: string) {
  return name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type ViewTab = "directory" | "users";

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
  const [viewTab, setViewTab] = useState<ViewTab>("directory");

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
          <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
            Employee directory
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
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
        <p className="rounded-lg border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {departmentFormError && canManageStaff ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          Could not load departments for the staff form: {departmentFormError}
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-surface p-1 dark:bg-[#0c0c0e]">
              <button
                type="button"
                onClick={() => setViewTab("directory")}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  viewTab === "directory"
                    ? "bg-gradient-to-r from-amber-500/90 to-amber-600/80 text-black shadow-[0_0_24px_-4px_rgba(245,158,11,0.45)]"
                    : "text-muted hover:text-foreground",
                )}
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => setViewTab("users")}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  viewTab === "users"
                    ? "bg-gradient-to-r from-amber-500/90 to-amber-600/80 text-black shadow-[0_0_24px_-4px_rgba(245,158,11,0.45)]"
                    : "text-muted hover:text-foreground",
                )}
              >
                User list
              </button>
            </div>
            <div>
              <CardTitle>Staff roster</CardTitle>
              <CardDescription>
                {filtered.length === rows.length
                  ? "Sorted by name."
                  : `Showing ${filtered.length} of ${rows.length} people.`}
              </CardDescription>
            </div>
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
            <p className="mb-4 rounded-lg border border-border bg-surface/40 px-3 py-2 text-xs text-muted">
              Filters combine: department (including unassigned), search. Clear to reset.
            </p>
          ) : null}
          {filtered.length === 0 && !error ? (
            <p className="text-sm text-muted">
              {rows.length === 0
                ? "No people loaded for this property. If you seeded demo data, confirm your profile’s tenant matches that property (or run the seed for your slug). You can also add staff and departments above when you have HRMS manage access."
                : "No rows match your filters. Try All departments or clear search."}
            </p>
          ) : viewTab === "directory" ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Title & department</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Salary / mo</th>
                  <th className="pb-3 font-medium">Join date</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const src = employeePhotoSrc(r.photo_url);
                  return (
                    <tr id={`emp-${r.id}`} key={r.id} className="border-b border-border/60 scroll-mt-24">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          {src ? (
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-2 ring-amber-500/20">
                              <img
                                src={src}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-300 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-400/80 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-300 dark:ring-zinc-700/80">
                              {initials(r.full_name)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-foreground">{r.full_name}</p>
                            <p className="text-xs text-muted">
                              {r.kind === "account"
                                ? "Login only"
                                : r.employee_code ?? r.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-foreground">{r.job_title ?? "—"}</p>
                        <p className="text-xs text-gold">{r.department_name ?? "—"}</p>
                      </td>
                      <td className="py-4">
                        <StatusBadge s={r.status} kind={r.kind} />
                      </td>
                      <td className="py-4">
                        <span className="tabular-nums text-foreground/90">
                          {formatMoneyCents(r.monthly_salary_cents)}
                        </span>
                      </td>
                      <td className="py-4 text-muted">
                        {r.hire_date ? formatDate(r.hire_date) : "—"}
                      </td>
                      <td className="py-4 text-right">
                        {canManageStaff && r.kind === "employee" ? (
                          <EmployeeRowActions row={r} tenantId={tenantId} departments={allDepartments} />
                        ) : (
                          <span className="text-xs text-muted">
                            {r.kind === "account" ? "Account" : "View only"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((r) => {
                const src = employeePhotoSrc(r.photo_url);
                return (
                  <article
                    key={r.id}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#1a1a1d] to-[#101012] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] transition-transform duration-300 hover:-translate-y-0.5 hover:border-amber-500/25 hover:shadow-[0_28px_56px_-8px_rgba(245,158,11,0.12)]"
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900">
                      {src ? (
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
                          <span className="text-4xl font-light tracking-tight text-zinc-600">
                            {initials(r.full_name)}
                          </span>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 pt-12">
                        <p className="text-lg font-semibold leading-tight text-white drop-shadow-md">
                          {r.full_name}
                        </p>
                        <p className="mt-0.5 text-sm text-zinc-300">{r.job_title ?? "—"}</p>
                        <p className="text-xs text-amber-400/90">{r.department_name ?? "—"}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge s={r.status} kind={r.kind} />
                          <span className="rounded-md bg-black/50 px-2 py-0.5 text-xs tabular-nums text-emerald-300/95 backdrop-blur-sm">
                            {formatMoneyCents(r.monthly_salary_cents)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-muted">
            Showing {filtered.length} {filtered.length === 1 ? "person" : "people"}
            {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
