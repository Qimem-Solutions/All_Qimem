import type { DepartmentCountRow } from "@/lib/queries/tenant-data";
import { Building2, Users } from "lucide-react";

type Props = {
  rows: DepartmentCountRow[];
  totalEmployees: number;
  error: string | null;
};

function hueForIndex(i: number) {
  return (28 + i * 47) % 360;
}

export function OrgStructureBoard({ rows, totalEmployees, error }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.employee_count));
  const deptCount = rows.length;
  const largest =
    rows.length > 0
      ? rows.reduce((a, b) => (b.employee_count > a.employee_count ? b : a), rows[0])
      : null;

  return (
    <div className="space-y-10">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {/* Stats strip — replaces secondary “dashboard” cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-surface-elevated/60 px-5 py-4 backdrop-blur-sm transition hover:border-gold/25">
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.12]"
            style={{ background: `hsl(${hueForIndex(0)}, 45%, 55%)` }}
          />
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-gold">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Departments
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                {deptCount}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">Defined for this property</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-surface-elevated/60 px-5 py-4 backdrop-blur-sm transition hover:border-gold/25">
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.12]"
            style={{ background: `hsl(${hueForIndex(1)}, 45%, 55%)` }}
          />
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-gold">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Headcount
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                {totalEmployees}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">Across all departments</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface-elevated/60 px-5 py-4 backdrop-blur-sm transition hover:border-gold/25">
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.12]"
            style={{ background: `hsl(${hueForIndex(2)}, 45%, 55%)` }}
          />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Largest team
            </p>
            {largest ? (
              <>
                <p className="mt-1 line-clamp-2 text-lg font-semibold leading-snug text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                  {largest.name}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  <span className="tabular-nums text-gold">{largest.employee_count}</span> people
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">Add departments to see this.</p>
            )}
          </div>
        </div>
      </div>

      {/* Department mosaic */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
              Department roster
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Headcount synced from your employee records.</p>
          </div>
        </div>

        {rows.length === 0 && !error ? (
          <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/80 bg-surface/40 px-8 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(232,197,71,0.06),transparent)]" />
            <p className="relative text-sm text-zinc-400">
              No departments yet — create one to start mapping your org.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((d, idx) => {
              const pct =
                totalEmployees > 0 ? Math.round((d.employee_count / totalEmployees) * 100) : 0;
              const h = hueForIndex(idx);
              return (
                <li
                  key={d.id}
                  className="group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-surface to-[#101012] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] transition duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.7)]"
                  style={{ animationDelay: `${idx * 45}ms` }}
                >
                  <div
                    className="absolute left-0 top-0 h-full w-1 rounded-l-2xl opacity-90 transition group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(180deg, hsl(${h}, 55%, 52%) 0%, hsl(${h}, 40%, 38%) 100%)`,
                    }}
                  />
                  <div className="pl-4">
                    <h3 className="pr-8 text-base font-semibold leading-snug text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                      {d.name}
                    </h3>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-4xl font-semibold tabular-nums tracking-tight text-white">
                        {d.employee_count}
                      </span>
                      <span className="text-sm text-zinc-500">
                        {d.employee_count === 1 ? "person" : "people"}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-dim/90 to-gold/70 transition-[width] duration-500"
                        style={{ width: `${Math.min(100, pct || (d.employee_count > 0 ? 8 : 0))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      {pct}% of org
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Distribution — full width, no “vitality” side panel */}
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-[#0e0e11] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        <div className="border-b border-border/60 bg-gradient-to-r from-surface-elevated/80 to-transparent px-6 py-5">
          <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Staff distribution
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Share of headcount by department (live).</p>
        </div>
        <div className="px-4 pb-8 pt-6 sm:px-6">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No data.</p>
          ) : (
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-8 left-0 right-0 border-t border-zinc-800/90"
              />
              <div className="flex min-h-[200px] items-end gap-2 sm:gap-3">
                {rows.map((d, i) => {
                  const barH = Math.max(12, (d.employee_count / max) * 160);
                  const h = hueForIndex(i);
                  return (
                    <div
                      key={d.id}
                      className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    >
                      <span className="text-[10px] font-medium tabular-nums text-zinc-400 sm:text-xs">
                        {d.employee_count}
                      </span>
                      <div
                        className="w-full max-w-[72px] rounded-t-lg shadow-[0_-8px_24px_-8px_rgba(232,197,71,0.15)] transition hover:brightness-110"
                        style={{
                          height: `${barH}px`,
                          background: `linear-gradient(180deg, hsl(${h}, 48%, 48%) 0%, hsl(${h}, 35%, 28%) 100%)`,
                        }}
                      />
                      <span
                        className="line-clamp-2 w-full text-center text-[9px] leading-tight text-zinc-500 sm:text-[10px]"
                        title={d.name}
                      >
                        {d.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
