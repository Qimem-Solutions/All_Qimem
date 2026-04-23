"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HrrmStaffRow } from "@/lib/queries/hrrm-staff";
import type { HrrmScope } from "@/lib/auth/hrrm-nav";
import { updateUserHrrmScopeAction } from "@/lib/actions/hrrm-staff-roles";
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
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No HRRM staff yet. Grant HRRM access under Hotel → Users.</p>;
  }

  return (
    <div className="space-y-3">
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
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
            {rows.map((row) => (
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
      {!canEditScope ? (
        <p className="text-xs text-amber-200/80">Only hotel administrators can change workstation scope from this table.</p>
      ) : null}
    </div>
  );
}
