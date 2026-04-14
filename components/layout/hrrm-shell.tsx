import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderProfileMenu } from "@/components/layout/header-profile-menu";

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
};

export function HrrmShell({
  children,
  brand,
  sidebarItems,
  activePath,
  readOnly,
}: HrrmShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="sticky top-0 z-40 border-b border-border bg-[#0c0c0d]/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-wide text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            {brand.title}
          </span>
          <div className="flex items-center gap-3">
            <div className="relative hidden max-w-xs lg:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                placeholder="Search guests..."
                className="h-9 w-56 rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-gold/60"
              />
            </div>
            <button
              type="button"
              className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/5"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <HeaderProfileMenu size="compact" />
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        <aside className="fixed bottom-0 left-0 top-14 z-30 flex w-60 flex-col border-r border-border bg-[#0c0c0d]">
          <div className="border-b border-border px-4 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {brand.subtitle ?? "Operational Suite"}
            </p>
            <p className="mt-1 text-lg font-semibold text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
              Qimem Grand
            </p>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
            {sidebarItems.map((item) => {
              const active =
                activePath === item.href ||
                (item.href !== "/" && activePath.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-gold/10 text-gold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-full before:bg-gold"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex gap-4 border-t border-border px-4 py-3 text-xs text-zinc-500">
            <span className="cursor-pointer hover:text-gold">Support</span>
            <span className="cursor-pointer hover:text-gold">Logs</span>
          </div>
        </aside>

        <div className="flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col pl-60">
          <main className="flex-1 p-6 lg:p-8">
            {readOnly ? (
              <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-100">
                <strong>View-only access.</strong> You can browse HRRM but cannot create bookings or
                change operational data.
              </p>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
