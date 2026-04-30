"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative } from "@/lib/format";
import type { HotelAdminProfileChangeRequestListRow } from "@/lib/queries/hotel-admin-profile-requests";
import type { HotelStaffUserUpdatePayload } from "@/lib/actions/hotel-users";
import {
  approveHotelAdminProfileChangeRequestAction,
  rejectHotelAdminProfileChangeRequestAction,
} from "@/lib/actions/superadmin-hotel-admin-profile-requests";

function summarizePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const p = payload as Partial<HotelStaffUserUpdatePayload>;
  const parts: string[] = [];
  if (typeof p.fullName === "string" && p.fullName.trim()) {
    parts.push(`Name → ${p.fullName.trim()}`);
  }
  if (typeof p.hrmsAccess === "string") {
    parts.push(`HRMS ${p.hrmsAccess}`);
  }
  if (typeof p.hrrmAccess === "string") {
    parts.push(`HRRM ${p.hrrmAccess}`);
  }
  if (p.employee && typeof p.employee === "object") {
    parts.push("Employee record included");
  }
  return parts.length ? parts.join(" · ") : "—";
}

export function SuperadminHotelAdminProfileRequests({
  rows,
}: {
  rows: HotelAdminProfileChangeRequestListRow[];
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No pending hotel administrator profile requests.
      </p>
    );
  }

  async function run(
    id: string,
    fn: (id: string) => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
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
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-zinc-500">
              <th className="pb-3 font-medium">Property</th>
              <th className="pb-3 font-medium">Administrator</th>
              <th className="pb-3 font-medium">Proposed changes</th>
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
                  <p>{r.requester_full_name?.trim() || "—"}</p>
                  <p className="font-mono text-xs text-zinc-500">{r.requester_user_id.slice(0, 8)}…</p>
                </td>
                <td className="max-w-md py-3 align-top text-zinc-400">
                  <p className="line-clamp-3">{summarizePayload(r.payload)}</p>
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
                      onClick={() => void run(r.id, approveHotelAdminProfileChangeRequestAction)}
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
                      onClick={() => void run(r.id, rejectHotelAdminProfileChangeRequestAction)}
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
