"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { HrrmStaffRow } from "@/lib/queries/hrrm-staff";
import type { HrrmScope } from "@/lib/auth/hrrm-nav";
import { updateUserHrrmScopeAction } from "@/lib/actions/hrrm-staff-roles";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import { cn } from "@/lib/utils";

const SCOPE_LABEL: Record<HrrmScope, string> = {
  all: "All areas",
  front_desk: "Front desk",
  inventory: "Inventory mgmt",
};

export function HrrmStaffTable({
  rows,
  canEditScope,
}: {
  rows: HrrmStaffRow[];
  canEditScope: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | HrrmScope>("all");
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function onChange(userId: string, scope: HrrmScope) {
    setErr(null);
    setPending(userId);
    const r = await updateUserHrrmScopeAction({ userId, hrrmScope: scope });
    setPending(null);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    router.refresh();
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (scopeFilter !== "all" && row.hrrm_scope !== scopeFilter) return false;
      if (!q) return true;
      const blob = [row.full_name ?? "", row.user_id, row.access_level, SCOPE_LABEL[row.hrrm_scope]]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [query, rows, scopeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const offset = (pageSafe - 1) * pageSize;
  const pagedRows = useMemo(
    () => filteredRows.slice(offset, offset + pageSize),
    [filteredRows, offset, pageSize],
  );

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No HRRM staff yet. Grant HRRM access under Hotel → Users.</p>
      ) : null}
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search name, access, scope, or ID…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          aria-label="Search HRRM staff"
        />
        <select
          className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
          value={scopeFilter}
          onChange={(e) => {
            setScopeFilter(e.target.value as "all" | HrrmScope);
            setPage(1);
          }}
          aria-label="Filter HRRM staff by scope"
        >
          <option value="all">All scopes</option>
          {(Object.keys(SCOPE_LABEL) as HrrmScope[]).map((scope) => (
            <option key={scope} value={scope}>
              {SCOPE_LABEL[scope]}
            </option>
          ))}
        </select>
      </div>
      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Access</th>
                  <th className="pb-3">Workstation scope</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.user_id} className="border-b border-border/50">
                    <td className="py-3 font-medium text-foreground">
                      {row.full_name?.trim() || "Unnamed user"}
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{row.user_id}</p>
                    </td>
                    <td className="py-3 text-zinc-400">{row.access_level}</td>
                    <td className="py-3">
                      {canEditScope ? (
                        <select
                          className={cn(
                            "w-full max-w-[12rem] rounded-md border border-border bg-surface px-2 py-1.5 text-foreground",
                            pending === row.user_id && "opacity-50",
                          )}
                          disabled={pending === row.user_id}
                          value={row.hrrm_scope}
                          onChange={(e) => void onChange(row.user_id, e.target.value as HrrmScope)}
                        >
                          {(Object.keys(SCOPE_LABEL) as HrrmScope[]).map((k) => (
                            <option key={k} value={k}>
                              {SCOPE_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-zinc-300">{SCOPE_LABEL[row.hrrm_scope]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            itemLabel="staff"
            totalItems={rows.length}
            filteredItems={filteredRows.length}
            page={pageSafe}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </>
      ) : null}
      {!canEditScope ? (
        <p className="text-xs text-amber-200/80">Only hotel administrators can change workstation scope from this table.</p>
      ) : null}
    </div>
  );
}
