"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import type { GuestDirectoryRow } from "@/lib/hrrm-guest-directory";
import { GuestDetailsDialog } from "@/components/hrrm/guest-details-dialog";
import { ListPagination } from "@/components/ui/list-pagination";
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
  const [stayFilter, setStayFilter] = useState<"all" | "in_house" | "upcoming" | "past" | "none">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        row.stay?.label ?? "",
        row.stay?.roomNumber ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [query, rows]);

  const visibleRows = useMemo(() => {
    return filteredRows.filter((row) => {
      const label = (row.stay?.label ?? "").toLowerCase();
      if (stayFilter === "in_house") return label.includes("in-house") || label.includes("checked in");
      if (stayFilter === "upcoming") return label.includes("upcoming");
      if (stayFilter === "past") return label.includes("completed") || label.includes("checked out") || label.includes("past");
      if (stayFilter === "none") return !row.stay;
      return true;
    });
  }, [filteredRows, stayFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const offset = (pageSafe - 1) * pageSize;
  const pagedRows = useMemo(
    () => visibleRows.slice(offset, offset + pageSize),
    [visibleRows, offset, pageSize],
  );

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
                {visibleRows.length} guest{visibleRows.length === 1 ? "" : "s"} shown. Click a row for details.
              </CardDescription>
            </div>
            <div className="flex w-full max-w-3xl flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="pl-10"
                  placeholder="Search by name, phone, or ID"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Search guests"
                />
              </div>
              <select
                className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                value={stayFilter}
                onChange={(e) => {
                  setStayFilter(e.target.value as "all" | "in_house" | "upcoming" | "past" | "none");
                  setPage(1);
                }}
                aria-label="Filter guests by stay"
              >
                <option value="all">All stays</option>
                <option value="in_house">In house</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past stays</option>
                <option value="none">No stay summary</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visibleRows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-muted">
                {rows.length === 0 ? "No guests yet. Register at Front desk." : "No guests match your search or filter."}
              </p>
            </div>
          ) : (
            <>
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
                  {pagedRows.map((row) => (
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
            <div className="px-6 pb-6">
              <ListPagination
                itemLabel="guests"
                totalItems={rows.length}
                filteredItems={visibleRows.length}
                page={pageSafe}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(1);
                }}
              />
            </div>
            </>
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
