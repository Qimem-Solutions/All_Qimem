"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative } from "@/lib/format";
import type { SubscriptionPlanRequestRow } from "@/lib/queries/plan-change-requests";
import {
  approvePlanChangeRequestAction,
  rejectPlanChangeRequestAction,
} from "@/lib/actions/superadmin-plan-requests";

function capitalizePlan(p: string) {
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : p;
}

export function SuperadminPendingPlanRequests({ rows }: { rows: SubscriptionPlanRequestRow[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hotel has a pending plan change request right now.
      </p>
    );
  }

  async function run(
    id: string,
    fn: (id: string) => Promise<
      { ok: true; message: string } | { ok: false; error: string }
    >,
  ) {
    setErr(null);
    setBusy(id);
    const r = await fn(id);
    setBusy(null);
    if (r.ok) {
      router.refresh();
    } else {
      setErr(r.error);
    }
  }

  return (
    <div className="space-y-4">
      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-zinc-500">
              <th className="pb-3 font-medium">Property</th>
              <th className="pb-3 font-medium">From → To</th>
              <th className="pb-3 font-medium">Note</th>
              <th className="pb-3 font-medium">Requested</th>
              <th className="w-[1%] pb-3 pr-0 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-3 align-top">
                  <p className="font-medium text-white">{r.tenant_name ?? "—"}</p>
                  <p className="font-mono text-xs text-zinc-500">/{r.tenant_slug ?? "—"}</p>
                </td>
                <td className="py-3 align-top text-zinc-300">
                  <span className="text-zinc-500">{capitalizePlan(r.current_plan ?? "—")}</span>
                  <span className="mx-1.5 text-zinc-600">→</span>
                  <span className="font-medium text-gold/90">{capitalizePlan(r.requested_plan)}</span>
                </td>
                <td className="max-w-xs py-3 align-top text-zinc-400">
                  {r.message ? <p className="line-clamp-3 whitespace-pre-wrap">{r.message}</p> : "—"}
                </td>
                <td className="whitespace-nowrap py-3 align-top text-zinc-500">
                  <span title={formatDate(r.created_at)}>{formatRelative(r.created_at)}</span>
                </td>
                <td className="py-3 pl-2 text-right align-top">
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="gap-1"
                      disabled={busy === r.id}
                      onClick={() => void run(r.id, approvePlanChangeRequestAction)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      disabled={busy === r.id}
                      onClick={() => void run(r.id, rejectPlanChangeRequestAction)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
