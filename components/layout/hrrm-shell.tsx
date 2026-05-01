import Link from "next/link";
import { House, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderProfileMenu } from "@/components/layout/header-profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export type HrrmNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type HrrmShellProps = {
  children: React.ReactNode;
  brand: { title: string; subtitle?: string };
  sidebarItems: HrrmNavItem[];
  activePath: string;
  readOnly?: boolean;
  /** Sticky workstation (Front desk / Inventory / All) for HRRM */
  stationControls?: React.ReactNode;
  /** Hotel admins return to portfolio; module-only staff do not see this control. */
  showBackToHome?: boolean;
};

export function HrrmShell({
  children,
  brand,
  sidebarItems,
  activePath,
  readOnly,
  stationControls,
  showBackToHome = false,
}: HrrmShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="border-b border-border px-5 py-6">
          <p className="text-xl font-semibold tracking-tight text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            {brand.title}
          </p>
          {brand.subtitle ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-muted">
              {brand.subtitle}
            </p>
          ) : null}
        </div>
        {stationControls ? (
          <div className="border-b border-border px-3 py-4">{stationControls}</div>
        ) : null}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {sidebarItems.map((item) => {
            const active =
              activePath === item.href || (item.href !== "/" && activePath.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-gold text-gold-foreground"
                    : "text-muted hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-gold">Support</span>
            <span className="cursor-pointer hover:text-gold">Logs</span>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pl-64">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
          <span className="text-sm font-semibold tracking-wide text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            HRRM
          </span>
          <div className="flex flex-1 justify-end">
            <div className="flex items-center gap-3">
              {showBackToHome ? (
                <Link
                  href="/hotel/dashboard"
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-transparent px-3 py-1.5 text-xs font-medium text-gold transition-colors",
                    "hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                  )}
                >
                  <House className="h-4 w-4" aria-hidden />
                  Back to Home
                </Link>
              ) : null}
              <ThemeToggle size="sm" />
              <HeaderProfileMenu size="compact" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">
          {readOnly ? (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-100/90 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>View-only access.</strong> You can browse HRRM but cannot create bookings or
              change operational data.
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
