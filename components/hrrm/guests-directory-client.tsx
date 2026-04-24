"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { formatGuestRowPayment, type GuestDirectoryRow } from "@/lib/hrrm-guest-directory";
import { GuestDetailsDialog } from "@/components/hrrm/guest-details-dialog";

function formatStayStatus(r: { stay: GuestDirectoryRow["stay"] }): string {
  if (!r.stay) return "—";
  if (r.stay.rawStatus && r.stay.label !== r.stay.rawStatus) {
    return `${r.stay.label} (${r.stay.rawStatus})`;
  }
  return r.stay.label;
}

type Props = {
  rows: GuestDirectoryRow[];
  columns: "full" | "basic";
  canManage: boolean;
};

export function GuestsDirectoryClient({ rows, columns, canManage }: Props) {
  const [dialogRow, setDialogRow] = useState<GuestDirectoryRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openRow(r: GuestDirectoryRow) {
    setDialogRow(r);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setDialogRow(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>{rows.length} guest{rows.length === 1 ? "" : "s"} loaded (max 500). Click a row for details.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No guests yet. Register at Front desk.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-3 pr-2">Name</th>
                    <th className="pb-3 pr-2">Phone</th>
                    <th className="pb-3 pr-2">Registered</th>
                    <th className="pb-3 pr-2">Stay status</th>
                    <th className="pb-3 pr-2">Room</th>
                    <th className="pb-3 pr-2">Check-in</th>
                    <th className="pb-3 pr-2">Check-out</th>
                    <th className="pb-3 pr-2">Nights</th>
                    {columns === "full" ? (
                      <>
                        <th className="pb-3 pr-2">Age</th>
                        <th className="pb-3 pr-2">Party</th>
                        <th className="pb-3 pr-2">Payment</th>
                        <th className="pb-3">Method</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-border/50 hover:bg-foreground/[0.04]"
                      onClick={() => openRow(r)}
                    >
                      <td className="py-3 pr-2 font-medium text-foreground">
                        {r.full_name}
                        <p className="font-mono text-[10px] text-zinc-500">{r.id}</p>
                      </td>
                      <td className="py-3 pr-2 text-zinc-300">{r.phone ?? "—"}</td>
                      <td className="py-3 pr-2 text-zinc-400">
                        {r.created_at ? formatDate(r.created_at) : "—"}
                      </td>
                      <td className="py-3 pr-2 text-zinc-300">{formatStayStatus(r)}</td>
                      <td className="py-3 pr-2 text-zinc-300">{r.stay?.roomNumber ?? "—"}</td>
                      <td className="py-3 pr-2 text-zinc-400">
                        {r.stay?.checkIn ? formatDate(r.stay.checkIn) : "—"}
                      </td>
                      <td className="py-3 pr-2 text-zinc-400">
                        {r.stay?.checkOut ? formatDate(r.stay.checkOut) : "—"}
                      </td>
                      <td className="py-3 pr-2 text-zinc-300">{r.stay?.nights != null ? r.stay.nights : "—"}</td>
                      {columns === "full" ? (
                        <>
                          <td className="py-3 pr-2 text-zinc-300">{r.age ?? "—"}</td>
                          <td className="py-3 pr-2 text-zinc-300">{r.party_size ?? "—"}</td>
                          <td className="py-3 pr-2 text-gold">{formatGuestRowPayment(r)}</td>
                          <td className="py-3 text-zinc-400">{r.payment_method ?? "—"}</td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <GuestDetailsDialog
        open={dialogOpen}
        onClose={closeDialog}
        initialRow={dialogRow}
        loadGuestId={dialogOpen && dialogRow ? dialogRow.id : null}
        canManage={canManage}
        columns={columns}
      />
    </>
  );
}
