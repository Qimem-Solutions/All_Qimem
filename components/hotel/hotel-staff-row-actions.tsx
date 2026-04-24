"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, UserX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deactivateHotelStaffUserAction,
  deleteHotelStaffUserAction,
  updateHotelStaffUserAction,
} from "@/lib/actions/hotel-users";
import type { TenantUserWithEmployee } from "@/lib/queries/tenant-data";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";
import { getFloatingMenuStyle } from "@/components/hotel/floating-menu-position";

const HR_LEVELS: ServiceAccessLevel[] = ["none", "view", "manage"];
const STATUS_OPTIONS = ["active", "inactive", "terminated", "probation", "on_leave", "pending"] as const;

type Props = {
  user: TenantUserWithEmployee;
  departments: { id: string; name: string }[];
  currentUserId: string;
};

function normalizeStatus(raw: string | null | undefined): (typeof STATUS_OPTIONS)[number] {
  const s = (raw ?? "active").toLowerCase();
  return (STATUS_OPTIONS as readonly string[]).includes(s)
    ? (s as (typeof STATUS_OPTIONS)[number])
    : "active";
}

function fillFormFromUser(u: TenantUserWithEmployee) {
  const base = {
    fullName: u.full_name?.trim() || "",
    hrms: u.hrms_access,
    hrrm: u.hrrm_access,
  };
  if (!u.employee) {
    return {
      ...base,
      jobTitle: "",
      employeeCode: "",
      hireDate: "",
      deptId: "",
      status: "active" as const,
      monthlySalary: "",
    };
  }
  return {
    ...base,
    jobTitle: u.employee.job_title ?? "",
    employeeCode: u.employee.employee_code ?? "",
    hireDate: u.employee.hire_date ? u.employee.hire_date.slice(0, 10) : "",
    deptId: u.employee.department_id ?? "",
    status: normalizeStatus(u.employee.status),
    monthlySalary:
      u.employee.monthly_salary_cents != null
        ? String((u.employee.monthly_salary_cents / 100).toFixed(2))
        : "",
  };
}

const menuItemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-foreground/5 dark:hover:bg-white/5";

export function HotelStaffRowActions({ user, departments, currentUserId }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user.full_name?.trim() || "");
  const [hrms, setHrms] = useState(user.hrms_access);
  const [hrrm, setHrrm] = useState(user.hrrm_access);
  const [jobTitle, setJobTitle] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [deptId, setDeptId] = useState("");
  const [status, setStatus] = useState("active");
  const [monthlySalary, setMonthlySalary] = useState("");

  const isSelf = user.id === currentUserId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | undefined>();

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuStyle(undefined);
      return;
    }
    const t = triggerRef.current;
    if (t) setMenuStyle(getFloatingMenuStyle(t));
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function place() {
      const t = triggerRef.current;
      if (!t) return;
      setMenuStyle(getFloatingMenuStyle(t));
    }
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) {
        return;
      }
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function startEdit() {
    const f = fillFormFromUser(user);
    setFullName(f.fullName);
    setHrms(f.hrms);
    setHrrm(f.hrrm);
    setJobTitle(f.jobTitle);
    setEmployeeCode(f.employeeCode);
    setHireDate(f.hireDate);
    setDeptId(f.deptId);
    setStatus(f.status);
    setMonthlySalary(f.monthlySalary);
    setError(null);
    setMenuOpen(false);
    setEditOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let monthlySalaryCents: number | null | undefined = undefined;
    if (user.employee) {
      const t = monthlySalary.trim();
      if (t.length > 0) {
        const n = Number.parseFloat(t);
        if (!Number.isFinite(n) || n < 0) {
          setLoading(false);
          setError("Enter a valid monthly salary, or clear the field to keep the current amount.");
          return;
        }
        monthlySalaryCents = Math.round(n * 100);
      } else {
        monthlySalaryCents = undefined;
      }
    }

    const res = await updateHotelStaffUserAction({
      userId: user.id,
      fullName,
      hrmsAccess: hrms,
      hrrmAccess: hrrm,
      employee: user.employee
        ? {
            id: user.employee.id,
            jobTitle: jobTitle.trim() || null,
            employeeCode: employeeCode.trim() || null,
            hireDate: hireDate.trim() || null,
            departmentId: deptId.trim() || null,
            status,
            monthlySalaryCents,
          }
        : undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditOpen(false);
    router.refresh();
  }

  async function onDeactivate() {
    if (isSelf) return;
    setMenuOpen(false);
    if (
      !confirm(
        `Deactivate ${user.full_name ?? "this user"}? Their login will be blocked and employee status set to inactive if applicable.`,
      )
    ) {
      return;
    }
    setError(null);
    const r = await deactivateHotelStaffUserAction({ userId: user.id });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  async function onDelete() {
    if (isSelf) return;
    setMenuOpen(false);
    if (
      !confirm(
        `Permanently remove ${user.full_name ?? "this user"} from the property? This deletes their login, profile on this tenant, and HR data.`,
      )
    ) {
      return;
    }
    setError(null);
    const r = await deleteHotelStaffUserAction({ userId: user.id });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="relative flex flex-col items-end" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5",
          )}
          aria-label="User actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => {
            setError(null);
            if (menuOpen) {
              setMenuOpen(false);
              setMenuStyle(undefined);
            } else if (triggerRef.current) {
              setMenuStyle(getFloatingMenuStyle(triggerRef.current));
              setMenuOpen(true);
            }
          }}
        >
          <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {error ? <p className="mt-1 max-w-[10rem] text-right text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      {typeof document !== "undefined" && menuOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="rounded-lg border border-border bg-surface-elevated py-1 text-foreground shadow-lg ring-1 ring-[var(--ring-subtle,transparent)]"
              style={menuStyle}
            >
              <button type="button" role="menuitem" className={menuItemClass} onClick={startEdit}>
                <Pencil className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(menuItemClass, isSelf && "cursor-not-allowed opacity-50")}
                disabled={isSelf}
                title={isSelf ? "You cannot deactivate yourself here" : undefined}
                onClick={onDeactivate}
              >
                <UserX className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Deactivate
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(menuItemClass, "text-red-600 dark:text-red-400", isSelf && "cursor-not-allowed opacity-50")}
                disabled={isSelf}
                title={isSelf ? "You cannot remove yourself here" : undefined}
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}

      {editOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setEditOpen(false)}
            aria-label="Close"
          />
          <form
            onSubmit={onSubmit}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-foreground">Edit user</h2>
            <p className="mt-1 text-sm text-muted">Profile, suite access, and optional HR record.</p>
            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted" htmlFor={`u-name-${user.id}`}>
                  Full name
                </label>
                <Input
                  id={`u-name-${user.id}`}
                  className="mt-1.5"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted" htmlFor={`u-hrms-${user.id}`}>
                    HRMS access
                  </label>
                  <select
                    id={`u-hrms-${user.id}`}
                    className="mt-1.5 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                    value={hrms}
                    onChange={(e) => setHrms(e.target.value as ServiceAccessLevel)}
                  >
                    {HR_LEVELS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted" htmlFor={`u-hrrm-${user.id}`}>
                    HRRM access
                  </label>
                  <select
                    id={`u-hrrm-${user.id}`}
                    className="mt-1.5 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                    value={hrrm}
                    onChange={(e) => setHrrm(e.target.value as ServiceAccessLevel)}
                  >
                    {HR_LEVELS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {user.employee ? (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Employee record</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted" htmlFor={`u-dept-${user.id}`}>
                      Department
                    </label>
                    <select
                      id={`u-dept-${user.id}`}
                      className="mt-1.5 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                      value={deptId}
                      onChange={(e) => setDeptId(e.target.value)}
                    >
                      <option value="">—</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`u-jt-${user.id}`}>
                      Job title
                    </label>
                    <Input
                      id={`u-jt-${user.id}`}
                      className="mt-1.5"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`u-st-${user.id}`}>
                      Status
                    </label>
                    <select
                      id={`u-st-${user.id}`}
                      className="mt-1.5 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`u-hd-${user.id}`}>
                      Hire date
                    </label>
                    <Input
                      id={`u-hd-${user.id}`}
                      className="mt-1.5"
                      type="date"
                      value={hireDate}
                      onChange={(e) => setHireDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`u-sal-${user.id}`}>
                      Monthly salary (ETB)
                    </label>
                    <Input
                      id={`u-sal-${user.id}`}
                      className="mt-1.5"
                      type="text"
                      inputMode="decimal"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(e.target.value)}
                      placeholder="Leave empty to keep current"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`u-code-${user.id}`}>
                      Employee code
                    </label>
                    <Input
                      id={`u-code-${user.id}`}
                      className="mt-1.5"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
