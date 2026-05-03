"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  itemLabel: string;
  totalItems: number;
  filteredItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

export function ListPagination({
  itemLabel,
  totalItems,
  filteredItems,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  className,
}: Props) {
  if (filteredItems <= 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredItems);
  const normalizedOptions = [...new Set([...pageSizeOptions, pageSize])]
    .filter((option) => Number.isFinite(option) && option > 0)
    .sort((a, b) => a - b);

  return (
    <div className={className ?? "mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"}>
      <div className="flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:gap-3">
        <p>
          Showing <span className="tabular-nums text-foreground/90">{start}–{end}</span> of{" "}
          <span className="tabular-nums text-foreground/90">{filteredItems}</span> {itemLabel}
          {filteredItems !== totalItems ? ` (filtered from ${totalItems})` : ""}
          {totalPages > 1 ? (
            <>
              {" "}
              · page <span className="tabular-nums text-foreground/90">{page}</span> of{" "}
              <span className="tabular-nums text-foreground/90">{totalPages}</span>
            </>
          ) : null}
        </p>
        <label className="flex items-center gap-2">
          <span>Per page</span>
          <select
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number.parseInt(e.target.value, 10))}
            aria-label={`Items per page for ${itemLabel}`}
          >
            {normalizedOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
