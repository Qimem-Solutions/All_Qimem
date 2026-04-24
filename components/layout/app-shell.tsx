import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Search,
  Settings,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderProfileMenu } from "@/components/layout/header-profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type AppShellProps = {
  children: React.ReactNode;
  brand: { title: string; subtitle?: string };
  navItems: NavItem[];
  activePath: string;
  headerCenter?: React.ReactNode;
  headerRight?: React.ReactNode;
  propertyTag?: string;
  userBlock?: { name: string; role: string; avatarUrl?: string };
  footerNav?: React.ReactNode;
  primaryAction?: { href: string; label: string };
  /** Default search bar in header when `headerCenter` is not provided */
  searchPlaceholder?: string;
  showAppsShortcut?: boolean;
  /** Read-only mode: shows a banner; nav and primary action still work when they are links (browse-only). */
  readOnly?: boolean;
};

export function AppShell({
  children,
  brand,
  navItems,
  activePath,
  headerCenter,
  headerRight,
  propertyTag,
  userBlock,
  footerNav,
  primaryAction,
  searchPlaceholder = "Search...",
  showAppsShortcut,
  readOnly,
}: AppShellProps) {
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
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active =
              activePath === item.href ||
              (item.href !== "/" && activePath.startsWith(item.href));
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
        {primaryAction ? (
          <div className="px-3 pb-4">
            <Link
              href={primaryAction.href}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors",
                readOnly
                  ? "border border-gold/40 bg-transparent text-gold hover:bg-gold/10"
                  : "bg-gold text-gold-foreground hover:bg-gold-dim",
              )}
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              {primaryAction.label}
            </Link>
          </div>
        ) : null}
        {footerNav}
        {userBlock ? (
          <div className="mt-auto border-t border-border p-4">
            <div className="flex items-center gap-3 rounded-lg bg-surface-elevated/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-xs font-semibold text-white">
                {userBlock.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userBlock.name}</p>
                <p className="truncate text-xs text-muted">{userBlock.role}</p>
              </div>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background px-6">
          {propertyTag ? (
            <span className="text-sm font-semibold text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
              {propertyTag}
            </span>
          ) : (
            <span className="w-24" />
          )}
          <div className="mx-auto flex max-w-xl flex-1 justify-center">
            {headerCenter ?? (
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-full border border-border bg-surface py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/50"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {headerRight}
            {showAppsShortcut ? (
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
                aria-label="Apps"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              className="relative rounded-lg p-2 text-muted hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <ThemeToggle size="sm" />
            <HeaderProfileMenu />
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">
          {readOnly ? (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-100/90 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>View-only access.</strong> You can browse this module but cannot create or edit
              records.
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
