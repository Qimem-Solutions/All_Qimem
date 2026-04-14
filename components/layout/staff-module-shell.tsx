import { HeaderProfileMenu } from "@/components/layout/header-profile-menu";

/**
 * Minimal shell for tenant staff (non–hotel-admin): no sidebar, only header + module picker pages.
 */
export function StaffModuleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-[#0c0c0d]/95 px-6 backdrop-blur-md">
        <span className="text-sm font-semibold tracking-wide text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
          All Qimem
        </span>
        <HeaderProfileMenu />
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
