"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import type { GuestDirectoryRow } from "@/lib/hrrm-guest-directory";
import { GuestDetailsDialog } from "@/components/hrrm/guest-details-dialog";
import { Search, Users } from "lucide-react";

type Props = {
  rows: GuestDirectoryRow[];
  columns: "full" | "basic";
  canManage: boolean;
};

export function GuestsDirectoryClient({ rows, columns, canManage }: Props) {
  const [dialogRow, setDialogRow] = useState<GuestDirectoryRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");

  function openRow(r: GuestDirectoryRow) {
    setDialogRow(r);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setDialogRow(null);
  }

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.full_name,
        row.phone ?? "",
        row.national_id_number ?? "",
        row.payment_method ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [query, rows]);

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Guest list
              </div>
              <CardTitle className="mt-4">Directory</CardTitle>
              <CardDescription className="mt-2">
                {filteredRows.length} guest{filteredRows.length === 1 ? "" : "s"} shown. Click a row for details.
              </CardDescription>
            </div>
            <div className="w-full max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="pl-10"
                  placeholder="Search by name, phone, or ID"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search guests"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-muted">
                {rows.length === 0 ? "No guests yet. Register at Front desk." : "No guests match your search."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                    <th className="px-6 py-4 pr-2">Name</th>
                    <th className="py-4 pr-2">Phone</th>
                    <th className="py-4 pr-2">Registered</th>
                    {columns === "full" ? (
                      <>
                        <th className="py-4 pr-2">National ID</th>
                        <th className="py-4 pr-6">Age</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                      onClick={() => openRow(row)}
                    >
                      <td className="px-6 py-4 pr-2">
                        <span className="block text-sm font-medium text-foreground">{row.full_name}</span>
                        <p className="mt-1 font-mono text-[10px] text-muted">{row.id}</p>
                      </td>
                      <td className="py-4 pr-2 text-foreground/90">{row.phone ?? "—"}</td>
                      <td className="py-4 pr-2 text-muted">{row.created_at ? formatDate(row.created_at) : "—"}</td>
                      {columns === "full" ? (
                        <>
                          <td className="py-4 pr-2 text-foreground/90">{row.national_id_number ?? "—"}</td>
                          <td className="py-4 pr-6 text-foreground/90">{row.age ?? "—"}</td>
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
