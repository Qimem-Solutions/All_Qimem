import { Badge } from "@/components/ui/badge";
import { OrgStructureBoard } from "@/components/hrms/org-structure-board";
import { Network } from "lucide-react";
import type { DepartmentCountRow } from "@/lib/queries/tenant-data";

type Props = {
  rows: DepartmentCountRow[];
  totalEmployees: number;
  error: string | null;
};

/**
 * Organization structure: hero + department board. Used on the HRMS dashboard (no sidebar route).
 */
export function OrgStructureSection({ rows, totalEmployees, error }: Props) {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-[#0c0c0e] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_10%_-30%,rgba(232,197,71,0.14),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_100%,rgba(80,120,180,0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full border border-white/[0.06] opacity-60" />
        <div className="relative px-6 py-10 md:px-10 md:py-12">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
              <Network className="h-3.5 w-3.5 text-gold" aria-hidden />
              HRMS · Structure
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl [font-family:var(--font-outfit),system-ui,sans-serif]">
              Organization structure
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              A live map of departments and how your workforce is distributed. Counts come straight from
              Supabase — add departments and assign employees to see the picture sharpen.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Badge tone="gold" className="border-gold/30 bg-gold/10 text-gold">
                {totalEmployees} people
              </Badge>
              <span className="text-xs text-zinc-600">
                {rows.length} department{rows.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <OrgStructureBoard rows={rows} totalEmployees={totalEmployees} error={error} />
    </div>
  );
}
